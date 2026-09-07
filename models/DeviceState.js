const mongoose = require('mongoose');

const DeviceStateSchema = new mongoose.Schema({
    // existing fields (states, mode, etc.)
    patternSpeeds: {
        type: Map,
        of: Number,
        default: {
            "2": 350,
            "3": 250,
            "4": 400,
            "5": 600,
            "6": 200,
            "7": 300,
            "8": 450,
            "9": 350
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('DeviceState', DeviceStateSchema);