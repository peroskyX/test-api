"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.energyRoutes = void 0;
// src/routes/energyRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
exports.energyRoutes = (0, express_1.Router)();
const schedulingService = new smartSchedulingService_1.SmartSchedulingService();
// Add energy data
exports.energyRoutes.post('/', async (req, res) => {
    try {
        const energyData = new models_1.Energy(req.body);
        await energyData.save();
        // Update historical patterns
        await schedulingService.updateHistoricalPatterns(energyData.userId);
        res.status(201).json(energyData);
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
});
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
// Get historical energy patterns
exports.energyRoutes.get('/patterns', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        let patterns = await models_1.HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
        // If no patterns exist, return default patterns
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
