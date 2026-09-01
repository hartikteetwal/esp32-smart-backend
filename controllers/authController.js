const AuthConfig = require('../models/AuthConfig');

// Default Auth Keys Seed helper
const initAuthKeys = async () => {
    try {
        const publicExists = await AuthConfig.findOne({ keyType: 'public' });
        if (!publicExists) {
            await AuthConfig.create({ keyType: 'public', password: '1234' });
            console.log('🔑 Default Public Key Seeded: 1234');
        }

        const privateExists = await AuthConfig.findOne({ keyType: 'private' });
        if (!privateExists) {
            await AuthConfig.create({ keyType: 'private', password: 'admin123' });
            console.log('🔑 Default Private Key Seeded: admin123');
        }
    } catch (err) {
        console.error('Error seeding auth keys:', err.message);
    }
};

// Dynamic Login
const login = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required' });
        }

        const adminKey = await AuthConfig.findOne({ keyType: 'private' });
        const publicKey = await AuthConfig.findOne({ keyType: 'public' });

        if (adminKey && password === adminKey.password) {
            return res.status(200).json({
                success: true,
                role: 'admin',
                message: 'Admin authentication verified'
            });
        }

        if (publicKey && password === publicKey.password) {
            return res.status(200).json({
                success: true,
                role: 'user',
                message: 'Public user authentication verified'
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid Access Key' });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Admin-Only Public Password Update with Force-Logout Event
const updatePublicPass = (broadcastFn) => async (req, res) => {
    try {
        const { adminPassword, newPublicPassword } = req.body;

        const adminKey = await AuthConfig.findOne({ keyType: 'private' });
        if (!adminKey || adminPassword !== adminKey.password) {
            return res.status(403).json({ success: false, message: 'Unauthorized! Incorrect Admin Key' });
        }

        if (!newPublicPassword || newPublicPassword.trim().length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 4 characters long'
            });
        }

        await AuthConfig.findOneAndUpdate(
            { keyType: 'public' },
            { password: newPublicPassword.trim(), updatedAt: Date.now() },
            { upsert: true }
        );

        console.log('🔒 Public Password Updated via Admin Panel');

        // ⚡ Sabhi connected clients ko Force Logout signal bhejo
        if (typeof broadcastFn === 'function') {
            broadcastFn({ type: 'FORCE_LOGOUT_PUBLIC' });
        }

        return res.status(200).json({
            success: true,
            message: 'Public key updated successfully in MongoDB'
        });
    } catch (err) {
        console.error('Update Public Pass Error:', err);
        res.status(500).json({ success: false, message: 'Failed to update key' });
    }
};

module.exports = {
    initAuthKeys,
    login,
    updatePublicPass
};