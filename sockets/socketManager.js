const WebSocket = require('ws');

let relayStates = [false, false, false, false, false, false, false, false];
let currentMode = 0;
let isBoardOnline = false;
let boardWsClient = null;
let lastHeartbeat = Date.now();

const initWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    const broadcast = (data) => {
        const message = JSON.stringify(data);
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    };

    // Heartbeat watchdog interval
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

        // Send initial state
        ws.send(JSON.stringify({
            type: 'INIT_STATE',
            states: relayStates,
            mode: currentMode,
            boardOnline: isBoardOnline
        }));

        ws.on('message', (raw) => {
            try {
                const data = JSON.parse(raw);

                // Keep-alive ping from client
                if (data.type === 'CLIENT_PING') return;

                // ESP32 Heartbeat
                if (data.type === 'HEARTBEAT') {
                    lastHeartbeat = Date.now();
                    if (!isBoardOnline) {
                        isBoardOnline = true;
                        boardWsClient = ws;
                        console.log('✅ ESP32 Board is now ONLINE!');
                        broadcast({ type: 'BOARD_STATUS', online: true });
                    }
                }

                // Single Relay Toggle
                if (data.type === 'TOGGLE_RELAY') {
                    const { id, state } = data;
                    if (id >= 0 && id < 8) {
                        currentMode = 0;
                        relayStates[id] = state;
                        broadcast({ type: 'UPDATE_RELAY', id, state });
                        broadcast({ type: 'UPDATE_MODE', mode: 0 });
                    }
                }

                // Master All ON / OFF
                if (data.type === 'ALL_RELAYS') {
                    const { state } = data;
                    currentMode = state ? 1 : 0;
                    relayStates = relayStates.map(() => state);
                    broadcast({ type: 'ALL_UPDATE', state });
                    broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                }

                // Pattern Mode Change
                if (data.type === 'SET_MODE') {
                    currentMode = Number(data.mode);
                    if (currentMode === 0) relayStates = relayStates.map(() => false);
                    if (currentMode === 1) relayStates = relayStates.map(() => true);

                    broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                    broadcast({
                        type: 'INIT_STATE',
                        states: relayStates,
                        mode: currentMode,
                        boardOnline: isBoardOnline
                    });
                }
            } catch (err) {
                console.error('Invalid message received:', err.message);
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

    return wss;
};

module.exports = initWebSocket;