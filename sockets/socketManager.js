const WebSocket = require('ws');

let relayStates = [false, false, false, false, false, false, false, false];
let currentMode = 0;
let activeAutoMode = 2; // 👈 Auto-cycle ka running pattern track karne ke liye
let isBoardOnline = false;
let currentSSID = '';
let boardWsClient = null;
let lastHeartbeat = Date.now();
let wssInstance = null;
// patternSpeeds ke theek neeche add karein:
let autoCycleDuration = 60000; // Default 60 seconds

// ✅ Global Pattern Speeds Cache (Har mode ki apni speed)
let patternSpeeds = {
    2: 350,
    3: 250,
    4: 400,
    5: 600,
    6: 200,
    7: 300,
    8: 450,
    9: 350
};

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
            currentSSID = '';
            boardWsClient = null;
            console.log('❌ ESP32 Board Went Offline!');
            broadcast({ type: 'BOARD_STATUS', online: false });
        }
    }, 3000);

    wssInstance.on('connection', (ws) => {
        console.log('⚡ New Client Connected');

        // ✅ Naye phone/tab ko states + latest patternSpeeds bhejo
        ws.send(JSON.stringify({
            type: 'INIT_STATE',
            states: relayStates,
            mode: currentMode,
            activeAutoMode: activeAutoMode, // 👈 Naye phone ko exact pattern milega
            boardOnline: isBoardOnline,
            currentSSID: currentSSID,
            patternSpeeds: patternSpeeds, // 👈 Hydrates UI with current speeds
            cycleDuration: autoCycleDuration
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
                        currentSSID: currentSSID,
                        patternSpeeds: patternSpeeds
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

                // Hotspot sync packets
                if (data.type === 'SYNC_NETWORKS') {
                    if (data.currentSSID) {
                        currentSSID = data.currentSSID;
                        console.log(`📶 Stored Active Hotspot in Backend: [${currentSSID}]`);
                    }

                    broadcast({
                        type: 'SAVED_NETWORKS_LIST',
                        networks: data.networks || [],
                        currentSSID: currentSSID
                    });
                }

                // Delete saved Wi-Fi
                if (data.type === 'DELETE_SAVED_WIFI') {
                    console.log(`🗑️ Delete Wi-Fi requested for SSID: ${data.ssid}`);
                    broadcast({
                        type: 'DELETE_SAVED_WIFI',
                        ssid: data.ssid
                    });
                }

                // Forward list requests
                if (data.type === 'GET_SAVED_NETWORKS') {
                    console.log('📤 Forwarding GET_SAVED_NETWORKS request to ESP32...');
                    broadcast({ type: 'GET_SAVED_NETWORKS' });
                }

                if (data.type === 'SAVED_NETWORKS_LIST') {
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

                // Switch Hotspot
                if (data.type === 'SWITCH_HOTSPOT') {
                    console.log(`🔀 Manual Switch command for SSID: ${data.ssid}`);
                    broadcast({
                        type: 'SWITCH_HOTSPOT',
                        ssid: data.ssid
                    });
                }

                // ⚡ Pattern Speed Adjustment Handler
                if (data.type === 'SET_PATTERN_SPEED') {
                    const mode = Number(data.mode);
                    const speed = Number(data.speed);

                    if (mode >= 2 && mode <= 9 && speed >= 100 && speed <= 1000) {
                        patternSpeeds[mode] = speed;
                        console.log(`⚡ Saved speed for Mode ${mode}: ${speed}ms`);

                        broadcast({
                            type: 'SET_PATTERN_SPEED',
                            mode: mode,
                            speed: speed
                        });
                    }
                }
                // ⏱️ Auto-Cycle Interval Forwarder (ESP32 + Sabhi Frontends ko forward karo)
                if (data.type === 'SET_CYCLE_DURATION') {
                    const duration = Number(data.duration);
                    if (duration >= 30000 && duration <= 300000) {
                        autoCycleDuration = duration;
                        console.log(`⏱️ Auto-Cycle Duration updated: ${duration / 1000}s`);

                        broadcast({
                            type: 'SET_CYCLE_DURATION',
                            duration: duration
                        });
                    }
                }
                // ws.on('message') ke andar:
                if (data.type === 'AUTO_CYCLE_TICK') {
                    activeAutoMode = Number(data.activeMode);
                    // Sabhi connected phones ko live tick broadcast karo
                    broadcast({
                        type: 'AUTO_CYCLE_TICK',
                        activeMode: activeAutoMode
                    });
                }
            } catch (err) {
                console.error('Invalid message received:', err.message);
            }
        });

        ws.on('close', () => {
            if (ws === boardWsClient) {
                isBoardOnline = false;
                currentSSID = '';
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