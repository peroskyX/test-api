"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRoutes = void 0;
// src/routes/scheduleRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.scheduleRoutes = (0, express_1.Router)();
const schedulingService = new smartSchedulingService_1.SmartSchedulingService();
exports.scheduleRoutes.use(authMiddleware_1.protect);
exports.scheduleRoutes.post('/', async (req, res) => {
    try {
        const scheduleItem = new models_1.ScheduleItem({
            ...req.body,
            userId: req.userId
        });
        await scheduleItem.save();
        if (scheduleItem.type === 'event') {
            await schedulingService.rescheduleTasksForNewEvent(scheduleItem);
        }
        res.status(201).json(scheduleItem);
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
});
// Get schedule items
exports.scheduleRoutes.get('/', async (req, res) => {
    try {
        const { type, startDate, endDate } = req.query;
        const query = {
            userId: req.userId
        };
        if (type)
            query.type = type;
        if (startDate || endDate) {
            query.startTime = {};
            if (startDate)
                query.startTime.$gte = new Date(startDate);
            if (endDate)
                query.startTime.$lte = new Date(endDate);
        }
        const items = await models_1.ScheduleItem.find(query).sort({ startTime: 1 });
        return res.json(items);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
exports.scheduleRoutes.delete('/:id', async (req, res) => {
    try {
        const item = await models_1.ScheduleItem.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });
        if (!item) {
            return res.status(404).json({ error: 'Schedule item not found' });
        }
        if (item.type === 'event') {
            const tasksToReschedule = await models_1.Task.find({
                userId: item.userId,
                isAutoSchedule: true,
                status: 'pending'
            });
            for (const task of tasksToReschedule) {
                await schedulingService.updateTaskWithRescheduling(task.id, {});
            }
        }
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
