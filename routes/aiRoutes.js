const express = require('express');
const router = express.Router();
const { processVoiceCommand } = require('../controllers/aiController');

router.post('/voice-command', processVoiceCommand);

module.exports = router;