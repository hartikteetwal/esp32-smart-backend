const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Server State
let relayStates = [false, false, false, false, false, false, false, false];
let currentMode = 0; // 0 = Manual, 1-8 = Patterns, 9 = Auto Cycle

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('⚡ New Client Connected (ESP32 or React App)');

    // Connection bante hi initial state bhejo
    ws.send(JSON.stringify({
        type: 'INIT_STATE',
        states: relayStates,
        mode: currentMode
    }));

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);

            // 1. Single Relay Toggle
            if (data.type === 'TOGGLE_RELAY') {
                const { id, state } = data;
                if (id >= 0 && id < 8) {
                    currentMode = 0; // Manual mode activate
                    relayStates[id] = state;
                    broadcast({ type: 'UPDATE_RELAY', id, state });
                    broadcast({ type: 'UPDATE_MODE', mode: 0 });
                }
            }

            // 2. Master All ON / OFF
            if (data.type === 'ALL_RELAYS') {
                const { state } = data;
                currentMode = state ? 1 : 0;
                relayStates = relayStates.map(() => state);
                broadcast({ type: 'ALL_UPDATE', state });
                broadcast({ type: 'UPDATE_MODE', mode: currentMode });
            }

            // 3. Chasing Animation Mode Change
            if (data.type === 'SET_MODE') {
                currentMode = Number(data.mode);
                if (currentMode === 0) relayStates = relayStates.map(() => false);
                if (currentMode === 1) relayStates = relayStates.map(() => true);

                broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                broadcast({ type: 'INIT_STATE', states: relayStates, mode: currentMode });
            }
        } catch (err) {
            console.error('Invalid message received:', err);
        }
    });

    ws.on('close', () => console.log('Client disconnected'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 WebSocket Server running on port ${PORT}`);
});