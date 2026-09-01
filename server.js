require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const https = require('https');

const connectDB = require('./config/db');
const { initAuthKeys } = require('./controllers/authController');
const authRoutes = require('./routes/authRoutes');
const {initWebSocket} = require('./sockets/socketManager');

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors());
app.use(express.json());

// Connect DB & Seed Auth Keys
connectDB().then(() => {
    initAuthKeys();
});

// Initialize WebSocket Engine
initWebSocket(server);

// API Routes
app.use('/api/auth', authRoutes);

// Health Route for Render
app.get('/', (req, res) => {
    res.status(200).send('ESP32 Smart Gateway Active');
});

// Self-ping to prevent sleep mode (Every 10 min)
const SERVER_URL = process.env.SERVER_URL || 'https://esp32-smart-backend.onrender.com/';
setInterval(() => {
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