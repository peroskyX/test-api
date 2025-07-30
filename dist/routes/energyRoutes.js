"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.energyRoutes = void 0;
// src/routes/energyRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
const sleepEnergySeeder_1 = require("../utils/sleepEnergySeeder");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.energyRoutes = (0, express_1.Router)();
const schedulingService = new smartSchedulingService_1.SmartSchedulingService();
// Get energy data for a user
exports.energyRoutes.get('/', async (req, res) => {
    try {
        const { userId, date, startDate, endDate } = req.query;
        const query = {};
        if (userId)
            query.userId = userId;
        if (date) {
            const targetDate = new Date(date);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);
            query.date = { $gte: targetDate, $lt: nextDay };
        }
        else if (startDate || endDate) {
            query.date = {};
            if (startDate)
                query.date.$gte = new Date(startDate);
            if (endDate)
                query.date.$lte = new Date(endDate);
        }
        const energyData = await models_1.Energy.find(query).sort({ date: 1, hour: 1 });
        res.json(energyData);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.energyRoutes.get('/patterns', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        let patterns = await models_1.HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
        if (patterns.length === 0) {
            patterns = schedulingService.getDefaultEnergyPatterns().map(p => ({
                userId: userId,
                hour: p.hour,
                averageEnergy: p.averageEnergy,
                sampleCount: 0,
                lastUpdated: new Date()
            }));
        }
        res.json(patterns);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.energyRoutes.post('/seed-from-sleep', authMiddleware_1.protect, async (req, res) => {
    try {
        // Get user's sleep schedule
        const user = await models_1.User.findById(req.userId).select('sleepSchedule chronotype');
        if (!user?.sleepSchedule) {
            return res.status(400).json({
                error: 'User must set sleep schedule first'
            });
        }
        const { daysToGenerate = 1, startDate } = req.body;
        // Check if user already has energy data (for informational purposes only)
        const hasExistingData = await (0, sleepEnergySeeder_1.userHasEnergyData)(req.userId);
        // Seed energy data - always generate new data regardless of existing data
        const energyData = await (0, sleepEnergySeeder_1.seedEnergyDataFromSleep)({
            userId: req.userId,
            sleepSchedule: user.sleepSchedule,
            chronotype: user.chronotype,
            daysToGenerate,
            startDate: startDate ? new Date(startDate) : new Date()
        });
        await schedulingService.updateHistoricalPatterns(req.userId);
        res.status(201).json({
            message: `Successfully ${hasExistingData ? 'added' : 'seeded'} ${energyData.length} energy entries`,
            entriesCreated: energyData.length,
            daysGenerated: daysToGenerate,
            hadExistingData: hasExistingData
        });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
