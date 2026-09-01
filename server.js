const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let relayStates = [false, false, false, false, false, false, false, false];
let currentMode = 0;

let isBoardOnline = false;
let boardWsClient = null;
let lastHeartbeat = Date.now();
const SERVER_URL = 'https://esp32-smart-backend.onrender.com/';

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Har 3 second mein check karega ki ESP32 ka ping aaya ya nahi
setInterval(() => {
    if (isBoardOnline && Date.now() - lastHeartbeat > 7000) {
        isBoardOnline = false;
        boardWsClient = null;
        console.log('❌ ESP32 Board Went Offline!');
        broadcast({ type: 'BOARD_STATUS', online: false });
    }
}, 3000);

wss.on('connection', (ws) => {
    console.log('⚡ New Client Connected');

    // Naye client ko current states bhejo
    ws.send(JSON.stringify({
        type: 'INIT_STATE',
        states: relayStates,
        mode: currentMode,
        boardOnline: isBoardOnline
    }));

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);

            // Frontend client keep-alive ping
            if (data.type === 'CLIENT_PING') {
                return; // No action needed, keeps the socket tunnel active
            }

            // 1. ESP32 Identity & Heartbeat Ping
            if (data.type === 'HEARTBEAT') {
                lastHeartbeat = Date.now();
                if (!isBoardOnline) {
                    isBoardOnline = true;
                    boardWsClient = ws;
                    console.log('✅ ESP32 Board is now ONLINE!');
                    broadcast({ type: 'BOARD_STATUS', online: true });
                }
            }

            // 2. Single Relay Toggle
            if (data.type === 'TOGGLE_RELAY') {
                const { id, state } = data;
                if (id >= 0 && id < 8) {
                    currentMode = 0;
                    relayStates[id] = state;
                    broadcast({ type: 'UPDATE_RELAY', id, state });
                    broadcast({ type: 'UPDATE_MODE', mode: 0 });
                }
            }

            // 3. Master All ON / OFF
            if (data.type === 'ALL_RELAYS') {
                const { state } = data;
                currentMode = state ? 1 : 0;
                relayStates = relayStates.map(() => state);
                broadcast({ type: 'ALL_UPDATE', state });
                broadcast({ type: 'UPDATE_MODE', mode: currentMode });
            }

            // 4. Pattern Mode Change
            if (data.type === 'SET_MODE') {
                currentMode = Number(data.mode);
                if (currentMode === 0) relayStates = relayStates.map(() => false);
                if (currentMode === 1) relayStates = relayStates.map(() => true);

                broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                broadcast({ type: 'INIT_STATE', states: relayStates, mode: currentMode, boardOnline: isBoardOnline });
            }
        } catch (err) {
            console.error('Invalid message received:', err);
        }
    });

    ws.on('close', () => {
        if (ws === boardWsClient) {
            isBoardOnline = false;
            boardWsClient = null;
            console.log('❌ ESP32 Disconnected (Socket Closed)');
            broadcast({ type: 'BOARD_STATUS', online: false });
        }
    });
});


setInterval( () => {
    https.get(SERVER_URL, (res) => {
        console.log(`⏱️ Self-ping sent. Status Code: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('Self-ping error:', err.message);
    });
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});