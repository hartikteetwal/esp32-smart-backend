const WebSocket = require('ws');

let relayStates = [false, false, false, false, false, false, false, false];
let currentMode = 0;
let isBoardOnline = false;
let currentSSID = ''; // ✅ Connected Hotspot Name store karne ke liye
let boardWsClient = null;
let lastHeartbeat = Date.now();
let wssInstance = null;

const broadcast = (data) => {
    if (!wssInstance) return;
    const message = JSON.stringify(data);
    wssInstance.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

const initWebSocket = (server) => {
    wssInstance = new WebSocket.Server({ server });

    // Heartbeat watchdog interval
    setInterval(() => {
        if (isBoardOnline && Date.now() - lastHeartbeat > 7000) {
            isBoardOnline = false;
            currentSSID = ''; // ✅ Board offline hote hi SSID clear
            boardWsClient = null;
            console.log('❌ ESP32 Board Went Offline!');
            broadcast({ type: 'BOARD_STATUS', online: false });
        }
    }, 3000);

    wssInstance.on('connection', (ws) => {
        console.log('⚡ New Client Connected');

        // ✅ 1. Frontend refresh hone par currentSSID sath bhejein
        ws.send(JSON.stringify({
            type: 'INIT_STATE',
            states: relayStates,
            mode: currentMode,
            boardOnline: isBoardOnline,
            currentSSID: currentSSID // 👈 Refresh par hotspot name ab 100% milega
        }));

        ws.on('message', (raw) => {
            try {
                const data = JSON.parse(raw);

                if (data.type === 'CLIENT_PING') return;

                if (data.type === 'HEARTBEAT') {
                    lastHeartbeat = Date.now();
                    if (!isBoardOnline) {
                        isBoardOnline = true;
                        boardWsClient = ws;
                        console.log('✅ ESP32 Board is now ONLINE!');
                        broadcast({ type: 'BOARD_STATUS', online: true });
                    }
                }

                if (data.type === 'TOGGLE_RELAY') {
                    const { id, state } = data;
                    if (id >= 0 && id < 8) {
                        currentMode = 0;
                        relayStates[id] = state;
                        broadcast({ type: 'UPDATE_RELAY', id, state });
                        broadcast({ type: 'UPDATE_MODE', mode: 0 });
                    }
                }

                if (data.type === 'ALL_RELAYS') {
                    const { state } = data;
                    currentMode = state ? 1 : 0;
                    relayStates = relayStates.map(() => state);
                    broadcast({ type: 'ALL_UPDATE', state });
                    broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                }

                if (data.type === 'SET_MODE') {
                    currentMode = Number(data.mode);
                    if (currentMode === 0) relayStates = relayStates.map(() => false);
                    if (currentMode === 1) relayStates = relayStates.map(() => true);

                    broadcast({ type: 'UPDATE_MODE', mode: currentMode });
                    broadcast({
                        type: 'INIT_STATE',
                        states: relayStates,
                        mode: currentMode,
                        boardOnline: isBoardOnline,
                        currentSSID: currentSSID
                    });
                }

                // Admin update board Wi-Fi
                if (data.type === 'SET_BOARD_WIFI') {
                    const { ssid, pass } = data;
                    if (ssid && pass) {
                        console.log('📡 Forwarding new Wi-Fi credentials to ESP32...');
                        broadcast({
                            type: 'UPDATE_WIFI',
                            ssid: ssid,
                            pass: pass
                        });
                    }
                }

                // ✅ 2. ESP32 se Hotspot Name receive hote hi backend state me save karein
                if (data.type === 'SYNC_NETWORKS') {
                    if (data.currentSSID) {
                        currentSSID = data.currentSSID; // 👈 Memory me cache ho gaya
                        console.log(`📶 Stored Active Hotspot in Backend: [${currentSSID}]`);
                    }

                    broadcast({
                        type: 'SAVED_NETWORKS_LIST',
                        networks: data.networks || [],
                        currentSSID: currentSSID
                    });
                }

                // Admin wants to delete a network
                if (data.type === 'DELETE_SAVED_WIFI') {
                    console.log(`🗑️ Delete Wi-Fi requested for SSID: ${data.ssid}`);
                    broadcast({
                        type: 'DELETE_SAVED_WIFI',
                        ssid: data.ssid
                    });
                }


                // 🎯 Frontend ne list maangi -> ESP32 ko broadcast karo
                if (data.type === 'GET_SAVED_NETWORKS') {
                    console.log('📤 Forwarding GET_SAVED_NETWORKS request to ESP32...');
                    broadcast({ type: 'GET_SAVED_NETWORKS' });
                }

                // 🎯 ESP32 ne list bheji -> Frontend ko broadcast karo
                if (data.type === 'SAVED_NETWORKS_LIST' || data.type === 'SYNC_NETWORKS') {
                    if (data.currentSSID) {
                        currentSSID = data.currentSSID;
                        console.log(`📶 Active Hotspot Updated: [${currentSSID}]`);
                    }
                    broadcast({
                        type: 'SAVED_NETWORKS_LIST',
                        networks: data.networks || [],
                        currentSSID: currentSSID
                    });
                }
            } catch (err) {
                console.error('Invalid message received:', err.message);
            }
        });

        ws.on('close', () => {
            if (ws === boardWsClient) {
                isBoardOnline = false;
                currentSSID = ''; // ✅ Socket close par SSID clear
                boardWsClient = null;
                console.log('❌ ESP32 Disconnected (Socket Closed)');
                broadcast({ type: 'BOARD_STATUS', online: false });
            }
        });
    });

    return wssInstance;
};

module.exports = {
    initWebSocket,
    broadcast
};