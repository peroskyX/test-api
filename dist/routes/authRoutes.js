"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
// src/routes/authRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const authMiddleware_1 = require("../middleware/authMiddleware");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
const authMiddleware_2 = require("../middleware/authMiddleware");
exports.authRoutes = (0, express_1.Router)();
exports.authRoutes.post('/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Please provide username, email and password' });
        }
        const userExists = await models_1.User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ error: 'User with this email or username already exists' });
        }
        const user = new models_1.User({
            username,
            email,
            firstName,
            lastName
        });
        user.setPassword(password);
        await user.save();
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            token: (0, authMiddleware_1.generateToken)(user._id.toString())
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});
exports.authRoutes.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Please provide username and password' });
        }
        const user = await models_1.User.findOne({
            $or: [
                { username: username },
                { email: username }
            ]
        });
        if (!user || !user.validatePassword(password)) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const accessToken = (0, authMiddleware_1.generateAccessToken)(user._id.toString());
        const refreshTokenValue = (0, authMiddleware_1.generateRefreshToken)(user._id.toString());
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accessToken,
            refreshToken: refreshTokenValue,
            token: accessToken, // For backward compatibility
            expiresIn: '15m'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});
exports.authRoutes.get('/profile', authMiddleware_2.protect, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authorized' });
        }
        res.json({
            _id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName
        });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error while getting profile' });
    }
});
exports.authRoutes.put('/sleep-schedule', authMiddleware_2.protect, async (req, res) => {
    try {
        const { bedtime, wakeHour, chronotype, generateEnergyData } = req.body;
        if (bedtime === undefined || wakeHour === undefined) {
            return res.status(400).json({
                error: 'Please provide both bedtime and wakeHour'
            });
        }
        if (bedtime < 0 || bedtime > 23 || wakeHour < 0 || wakeHour > 23) {
            return res.status(400).json({
                error: 'Hours must be between 0 and 23'
            });
        }
        const user = await models_1.User.findByIdAndUpdate(req.user._id, {
            sleepSchedule: {
                bedtime,
                wakeHour
            },
            ...(chronotype && { chronotype })
        }, { new: true }).select('-hashedPassword -salt');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (generateEnergyData) {
            const { seedEnergyDataFromSleep } = await Promise.resolve().then(() => require('../utils/sleepEnergySeeder'));
            await seedEnergyDataFromSleep({
                userId: user._id.toString(),
                sleepSchedule: user.sleepSchedule,
                chronotype: user.chronotype,
                daysToGenerate: 1
            });
            const schedulingService = new smartSchedulingService_1.SmartSchedulingService();
            await schedulingService.updateHistoricalPatterns(req.userId);
            res.json({
                sleepSchedule: user.sleepSchedule,
                chronotype: user.chronotype,
                message: 'Sleep schedule updated and energy data generated',
            });
        }
        else {
            res.json({
                sleepSchedule: user.sleepSchedule,
                chronotype: user.chronotype,
                message: 'Sleep schedule updated',
            });
        }
    }
    catch (error) {
        console.error('Sleep schedule update error:', error);
        res.status(500).json({ error: 'Server error while updating sleep schedule' });
    }
});
exports.authRoutes.get('/sleep-schedule', authMiddleware_2.protect, async (req, res) => {
    try {
        const user = await models_1.User.findById(req.user._id).select('sleepSchedule chronotype');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            sleepSchedule: user.sleepSchedule || null,
            chronotype: user.chronotype || 'neutral'
        });
    }
    catch (error) {
        console.error('Get sleep schedule error:', error);
        res.status(500).json({ error: 'Server error while fetching sleep schedule' });
    }
});
// Refresh token endpoint
exports.authRoutes.post('/refresh-token', authMiddleware_1.refreshToken);
// Optional: Add logout endpoint to invalidate tokens
exports.authRoutes.post('/logout', authMiddleware_2.protect, async (req, res) => {
    // In a production app, you'd typically blacklist the token or store logout info
    // For now, just return success - client should delete tokens
    res.json({ message: 'Logged out successfully' });
});
