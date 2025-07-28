"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRoutes = void 0;
// src/routes/taskRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.taskRoutes = (0, express_1.Router)();
const schedulingService = new smartSchedulingService_1.SmartSchedulingService();
// Apply protection middleware to all task routes
exports.taskRoutes.use(authMiddleware_1.protect);
// Create a new task
exports.taskRoutes.post('/', async (req, res) => {
    try {
        // Ensure the task belongs to the authenticated user
        const taskData = {
            ...req.body,
            userId: req.userId
        };
        const task = await schedulingService.createTaskWithSmartScheduling(taskData);
        res.status(201).json(task);
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
});
// Get all tasks for a user
exports.taskRoutes.get('/', async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const query = {
            // Always filter by the authenticated user's ID
            userId: req.userId
        };
        if (status)
            query.status = status;
        if (startDate || endDate) {
            query.startTime = {};
            if (startDate)
                query.startTime.$gte = new Date(startDate);
            if (endDate)
                query.startTime.$lte = new Date(endDate);
        }
        const tasks = await models_1.Task.find(query).sort({ startTime: 1 });
        res.json(tasks);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Get a specific task
exports.taskRoutes.get('/:id', async (req, res) => {
    try {
        // Only allow access to the user's own tasks
        const task = await models_1.Task.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Update a task
exports.taskRoutes.put('/:id', async (req, res) => {
    try {
        // First verify this is the user's task
        const existingTask = await models_1.Task.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const updates = req.body;
        // Prevent changing the userId
        delete updates.userId;
        const task = await schedulingService.updateTaskWithRescheduling(req.params.id, updates);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
});
// Delete a task
exports.taskRoutes.delete('/:id', async (req, res) => {
    try {
        // Only allow deletion of the user's own tasks
        const task = await models_1.Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        // Also remove from schedule
        await models_1.ScheduleItem.findOneAndDelete({ taskId: task.id });
        res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Manually trigger rescheduling
exports.taskRoutes.post('/:id/reschedule', async (req, res) => {
    try {
        // Only allow rescheduling of the user's own tasks
        const task = await models_1.Task.findOne({
            _id: req.params.id,
            userId: req.userId
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const taskSelect = schedulingService['convertToTaskSelect'](task);
        const scheduledTime = await schedulingService.findOptimalTimeForTask(taskSelect, task.userId);
        if (scheduledTime) {
            task.startTime = scheduledTime.startTime;
            task.endTime = scheduledTime.endTime;
            await task.save();
            // Update schedule item
            await models_1.ScheduleItem.findOneAndUpdate({ taskId: task.id }, {
                startTime: task.startTime,
                endTime: task.endTime
            });
            res.json(task);
        }
        else {
            // If no optimal time found, send a specific message
            return res.status(409).json({ message: 'Could not find an optimal time to reschedule the task.' });
        }
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
