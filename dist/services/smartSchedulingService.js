"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSchedulingService = void 0;
// src/services/smartSchedulingService.ts - FIXED VERSION
const date_fns_1 = require("date-fns");
const models_1 = require("../models");
const SmartScheduling = require("../smart");
class SmartSchedulingService {
    /**
     * Create a new task with smart scheduling
     */
    async createTaskWithSmartScheduling(taskData) {
        console.log('[SmartSchedulingService] Creating task with data:', {
            title: taskData.title,
            startTime: taskData.startTime,
            isAutoSchedule: taskData.isAutoSchedule,
            tag: taskData.tag
        });
        const task = new models_1.Task(taskData);
        // Convert to TaskSelect format for smart scheduling logic
        const taskSelect = this.convertToTaskSelect(task);
        console.log('[SmartSchedulingService] Converted to TaskSelect:', {
            id: taskSelect.id,
            startTime: taskSelect.startTime,
            isDateOnly: taskSelect.startTime ? SmartScheduling.isDateOnlyWithoutTime(taskSelect.startTime) : false
        });
        // Check if task needs smart scheduling
        const needsScheduling = SmartScheduling.shouldAutoReschedule(taskSelect);
        console.log('[SmartSchedulingService] Needs scheduling?', needsScheduling);
        if (needsScheduling) {
            console.log('[SmartSchedulingService] Finding optimal time for task...');
            const scheduledTime = await this.findOptimalTimeForTask(taskSelect, task.userId);
            if (scheduledTime) {
                console.log('[SmartSchedulingService] Found optimal time:', scheduledTime);
                task.startTime = scheduledTime.startTime;
                task.endTime = scheduledTime.endTime;
            }
            else {
                console.log('[SmartSchedulingService] No optimal time found, using original time');
            }
        }
        await task.save();
        // Add to schedule if task has a start time
        if (task.startTime && task.endTime) {
            await this.addTaskToSchedule(task);
        }
        console.log('[SmartSchedulingService] Task created with final time:', {
            startTime: task.startTime,
            endTime: task.endTime
        });
        return task;
    }
    /**
     * Find optimal time for a task based on energy and schedule
     */
    async findOptimalTimeForTask(task, userId, daysToLookAhead = 0) {
        try {
            // First try with current target date
            const context = await this.buildSchedulingContext(task, userId);
            console.log('[findOptimalTimeForTask] Built context:', {
                schedulingStrategy: context.schedulingStrategy,
                targetDate: context.targetDate,
                hasEnergyForecast: !!context.todayEnergyForecast,
                energyForecastLength: context.todayEnergyForecast?.length || 0,
                historicalPatternsLength: context.historicalPatterns?.length || 0,
                daysToLookAhead
            });
            const energyRequirements = SmartScheduling.getEnergyRequirementsForTask(task.tag);
            const taskDuration = SmartScheduling.extractTaskDuration(task);
            console.log('[findOptimalTimeForTask] Task requirements:', {
                tag: task.tag,
                duration: taskDuration,
                energyRequirements
            });
            const availableSlots = SmartScheduling.getAvailableSlotsForContext(context, taskDuration, energyRequirements);
            console.log('[findOptimalTimeForTask] Available slots:', availableSlots.length);
            if (availableSlots.length > 0) {
                console.log('[findOptimalTimeForTask] First few slots:', availableSlots.slice(0, 3).map(s => ({
                    time: s.startTime,
                    energy: s.energyLevel
                })));
            }
            if (availableSlots.length === 0) {
                console.log('[findOptimalTimeForTask] No available slots found on current day');
                // Check if we should look ahead based on deadline constraints
                const nextDay = task.startTime ? (0, date_fns_1.addDays)(task.startTime, 3) : (0, date_fns_1.addDays)(new Date(), 3);
                console.log('[findOptimalTimeForTask] Next day:', nextDay);
                console.log('[findOptimalTimeForTask] Task deadline:', task.endTime);
                console.log('[findOptimalTimeForTask] Next day start:', task.startTime);
                const nextDayStart = (0, date_fns_1.startOfDay)(nextDay);
                // Don't look ahead if there's a deadline and the next day would exceed it
                if (task.endTime && nextDayStart >= task.endTime) {
                    console.log('[findOptimalTimeForTask] Cannot look ahead: would exceed task deadline', {
                        deadline: task.endTime,
                        nextDay: nextDayStart
                    });
                    return null;
                }
                // If no slots found and we haven't looked too far ahead, try the next day
                if (daysToLookAhead < 7) { // Limit to 7 days of looking ahead to prevent excessive recursion
                    console.log(`[findOptimalTimeForTask] Looking ahead to day ${daysToLookAhead + 1}`);
                    // Create a modified task with target date shifted to the next day
                    const nextDayTask = { ...task };
                    // Set the start time to the next day
                    nextDayTask.startTime = nextDayStart;
                    console.log('[findOptimalTimeForTask] Next day task:', nextDayTask);
                    // Recursively call this function with the incremented daysToLookAhead counter
                    return this.findOptimalTimeForTask(nextDayTask, userId, daysToLookAhead + 1);
                }
                console.log('[findOptimalTimeForTask] Reached maximum days to look ahead, no slots found');
                return null;
            }
            // Sort slots by energy level and pick the best one
            const sortedSlots = availableSlots.sort((a, b) => b.energyLevel - a.energyLevel);
            // // Sort slots by energy (desc), then by earliest time (asc)
            // const sortedSlots = availableSlots.sort((a, b) => {
            //   if (b.energyLevel !== a.energyLevel) return b.energyLevel - a.energyLevel;
            //   return a.startTime.getTime() - b.startTime.getTime();
            // });
            const bestSlot = sortedSlots[0];
            const startTime = bestSlot.startTime;
            const endTime = (0, date_fns_1.addMinutes)(startTime, taskDuration);
            console.log('[findOptimalTimeForTask] Selected best slot:', {
                startTime,
                endTime,
                energyLevel: bestSlot.energyLevel
            });
            return { startTime, endTime };
        }
        catch (error) {
            console.error('[findOptimalTimeForTask] Error:', error);
            return null;
        }
    }
    /**
     * Build scheduling context for smart scheduling
     */
    async buildSchedulingContext(task, userId) {
        const targetDate = SmartScheduling.determineTargetDate(task);
        const strategy = SmartScheduling.determineSchedulingStrategy(targetDate);
        console.log('[buildSchedulingContext] Strategy:', {
            targetDate,
            strategy: strategy.strategy,
            isToday: strategy.isToday
        });
        // Get schedule items
        const schedule = await this.getScheduleItems(userId, targetDate);
        console.log('[buildSchedulingContext] Schedule items:', schedule.length);
        // Get energy data
        const energyHistory = await this.getEnergyHistory(userId);
        console.log('[buildSchedulingContext] Energy history entries:', energyHistory.length);
        let todayEnergyForecast;
        if (strategy.isToday) {
            todayEnergyForecast = await this.getTodayEnergyForecast(userId);
            console.log('[buildSchedulingContext] Today energy forecast entries:', todayEnergyForecast.length);
        }
        // Get historical patterns - ALWAYS include these as fallback
        let historicalPatterns = await this.getHistoricalPatterns(userId);
        console.log('[buildSchedulingContext] Historical patterns:', historicalPatterns.length);
        // If no patterns exist, use default patterns
        if (historicalPatterns.length === 0) {
            console.log('[buildSchedulingContext] Using default energy patterns');
            historicalPatterns = this.getDefaultEnergyPatterns();
            // Optionally save these as the user's initial patterns
            for (const pattern of historicalPatterns) {
                await models_1.HistoricalEnergyPattern.create({
                    userId,
                    hour: pattern.hour,
                    averageEnergy: pattern.averageEnergy,
                    sampleCount: 0,
                    lastUpdated: new Date()
                });
            }
        }
        return {
            schedule,
            energyHistory,
            todayEnergyForecast,
            historicalPatterns,
            schedulingStrategy: strategy.strategy,
            targetDate
        };
    }
    /**
     * Get schedule items for a user
     */
    async getScheduleItems(userId, targetDate) {
        const query = { userId };
        if (targetDate) {
            // Get items for the specific day and a few days around it
            const startOfTargetDay = (0, date_fns_1.startOfDay)(targetDate);
            const endOfSearchWindow = (0, date_fns_1.addDays)(startOfTargetDay, 7); // Look ahead 7 days
            query.startTime = { $gte: startOfTargetDay, $lt: endOfSearchWindow };
        }
        else {
            // Get upcoming items
            const now = new Date();
            const futureLimit = (0, date_fns_1.addDays)(now, 30);
            query.startTime = { $gte: now, $lt: futureLimit };
        }
        const items = await models_1.ScheduleItem.find(query).sort({ startTime: 1 });
        return items.map(item => ({
            id: item.id,
            title: item.title,
            startTime: item.startTime,
            endTime: item.endTime,
            type: item.type
        }));
    }
    /**
     * Get today's energy forecast
     */
    async getTodayEnergyForecast(userId) {
        const today = (0, date_fns_1.startOfDay)(new Date());
        const tomorrow = (0, date_fns_1.addDays)(today, 1);
        const energyData = await models_1.Energy.find({
            userId,
            date: { $gte: today, $lt: tomorrow }
        }).sort({ hour: 1 });
        console.log('[getTodayEnergyForecast] Found energy data for today:', energyData.length);
        return energyData.map(e => this.convertToEnergySelect(e));
    }
    /**
     * Get historical energy patterns
     */
    async getHistoricalPatterns(userId) {
        const patterns = await models_1.HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
        return patterns.map(p => ({
            hour: p.hour,
            averageEnergy: p.averageEnergy
        }));
    }
    /**
     * Convert ITask to TaskSelect format
     */
    convertToTaskSelect(task) {
        // Ensure dates are properly handled
        const startTime = task.startTime ? new Date(task.startTime) : null;
        const endTime = task.endTime ? new Date(task.endTime) : null;
        return {
            id: task.id || task._id?.toString() || 'temp-id',
            title: task.title,
            startTime: startTime,
            endTime: endTime,
            isAutoSchedule: task.isAutoSchedule,
            priority: task.priority,
            estimatedDuration: task.estimatedDuration,
            tag: task.tag,
            status: task.status
        };
    }
    /**
     * Convert IEnergy to EnergySelect format
     */
    convertToEnergySelect(energy) {
        // Create the date at the specific hour
        const energyDate = new Date(energy.date);
        energyDate.setHours(energy.hour, 0, 0, 0);
        return {
            userId: energy.userId,
            _id: energy.id || energy._id?.toString() || '',
            date: energyDate.toISOString(),
            _creationTime: energy.createdAt?.getTime() || Date.now(),
            mood: energy.mood,
            energyLevel: energy.energyLevel,
            energyStage: energy.energyStage,
            hour: energy.hour,
            hasManualCheckIn: energy.hasManualCheckIn
        };
    }
    /**
     * Update historical energy patterns based on new energy data
     */
    async updateHistoricalPatterns(userId) {
        const energyData = await models_1.Energy.find({ userId });
        if (energyData.length === 0) {
            console.log('[updateHistoricalPatterns] No energy data to process');
            return;
        }
        // Group by hour and calculate averages
        const hourlyData = new Map();
        energyData.forEach(entry => {
            const hour = entry.hour;
            if (!hourlyData.has(hour)) {
                hourlyData.set(hour, []);
            }
            hourlyData.get(hour).push(entry.energyLevel);
        });
        // Update patterns
        for (const [hour, levels] of hourlyData.entries()) {
            const averageEnergy = levels.reduce((sum, level) => sum + level, 0) / levels.length;
            await models_1.HistoricalEnergyPattern.findOneAndUpdate({ userId, hour }, {
                averageEnergy,
                sampleCount: levels.length,
                lastUpdated: new Date()
            }, { upsert: true });
        }
        console.log(`[updateHistoricalPatterns] Updated ${hourlyData.size} hourly patterns for user ${userId}`);
    }
    /**
     * Get energy history for a user
     */
    async getEnergyHistory(userId) {
        const energyData = await models_1.Energy.find({ userId })
            .sort({ date: -1 })
            .limit(100);
        return energyData.map(e => this.convertToEnergySelect(e));
    }
    /**
     * Add task to schedule
     */
    async addTaskToSchedule(task) {
        if (!task.startTime || !task.endTime)
            return;
        await models_1.ScheduleItem.create({
            userId: task.userId,
            title: task.title,
            startTime: task.startTime,
            endTime: task.endTime,
            type: 'task',
            taskId: task.id || task._id?.toString()
        });
    }
    /**
     * Update a task and reschedule if necessary
     */
    async updateTaskWithRescheduling(taskId, updates) {
        const task = await models_1.Task.findById(taskId);
        if (!task)
            return null;
        const oldTaskSelect = this.convertToTaskSelect(task);
        // Apply updates
        Object.assign(task, updates);
        // Check if rescheduling is needed
        if (SmartScheduling.shouldAutoReschedule(oldTaskSelect, updates)) {
            const scheduledTime = await this.findOptimalTimeForTask(this.convertToTaskSelect(task), task.userId);
            if (scheduledTime) {
                task.startTime = scheduledTime.startTime;
                task.endTime = scheduledTime.endTime;
                // Update schedule item
                await models_1.ScheduleItem.findOneAndUpdate({ taskId: task.id, userId: task.userId }, {
                    startTime: task.startTime,
                    endTime: task.endTime,
                    title: task.title
                });
            }
        }
        await task.save();
        return task;
    }
    /**
     * Reschedule tasks when a new calendar event is added
     */
    async rescheduleTasksForNewEvent(event) {
        // Find tasks that conflict with the new event
        const conflictingTasks = await models_1.Task.find({
            userId: event.userId,
            isAutoSchedule: true,
            startTime: { $lt: event.endTime },
            endTime: { $gt: event.startTime }
        });
        // Reschedule each conflicting task
        for (const task of conflictingTasks) {
            const taskSelect = this.convertToTaskSelect(task);
            const newTime = await this.findOptimalTimeForTask(taskSelect, task.userId);
            if (newTime) {
                task.startTime = newTime.startTime;
                task.endTime = newTime.endTime;
                await task.save();
                // Update schedule item
                await models_1.ScheduleItem.findOneAndUpdate({ taskId: task.id }, {
                    startTime: task.startTime,
                    endTime: task.endTime
                });
            }
        }
    }
    /**
     * Get default energy patterns (fallback when no user data)
     */
    getDefaultEnergyPatterns() {
        return [
            { hour: 6, averageEnergy: 0.3 }, // Early morning
            { hour: 7, averageEnergy: 0.5 }, // Morning rise
            { hour: 8, averageEnergy: 0.7 }, // Morning
            { hour: 9, averageEnergy: 0.85 }, // Morning peak
            { hour: 10, averageEnergy: 0.9 }, // Morning peak
            { hour: 11, averageEnergy: 0.85 }, // Late morning
            { hour: 12, averageEnergy: 0.7 }, // Lunch
            { hour: 13, averageEnergy: 0.5 }, // Post-lunch dip
            { hour: 14, averageEnergy: 0.6 }, // Afternoon recovery
            { hour: 15, averageEnergy: 0.75 }, // Afternoon rebound
            { hour: 16, averageEnergy: 0.8 }, // Afternoon peak
            { hour: 17, averageEnergy: 0.7 }, // Late afternoon
            { hour: 18, averageEnergy: 0.6 }, // Early evening
            { hour: 19, averageEnergy: 0.5 }, // Evening
            { hour: 20, averageEnergy: 0.4 }, // Wind down
            { hour: 21, averageEnergy: 0.3 }, // Late evening
            { hour: 22, averageEnergy: 0.2 }, // Pre-sleep
        ];
    }
}
exports.SmartSchedulingService = SmartSchedulingService;
