const mongoose = require('mongoose');

const AuthConfigSchema = new mongoose.Schema({
    keyType: {
        type: String,
        required: true,
        unique: true,
        enum: ['public', 'private']
    },
    password: {
        type: String,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('AuthConfig', AuthConfigSchema);