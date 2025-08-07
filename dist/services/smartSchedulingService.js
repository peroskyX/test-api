"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSchedulingService = void 0;
// src/services/smartSchedulingService.ts - UPDATED VERSION
const date_fns_1 = require("date-fns");
const models_1 = require("../models");
const SmartScheduling = require("../smart");
const notificationService_1 = require("./notificationService");
class SmartSchedulingService {
    notificationService;
    constructor() {
        this.notificationService = new notificationService_1.NotificationService();
    }
    async createTaskWithSmartScheduling(taskData) {
        console.log('[SmartSchedulingService] Creating task with data:', {
            title: taskData.title,
            startTime: taskData.startTime,
            endTime: taskData.endTime,
            estimatedDuration: taskData.estimatedDuration,
            isAutoSchedule: taskData.isAutoSchedule,
            tag: taskData.tag,
            priority: taskData.priority
        });
        // ACCEPTANCE CRITERIA: Always use duration to calculate endTime
        // If user provides startTime and endTime, ignore endTime and use duration
        const task = new models_1.Task(taskData);
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
                // Check if we need to displace other tasks
                await this.handleTaskDisplacement(task);
                // Save the task since we found an optimal time
                await task.save();
                // Add to schedule if task has a start time
                if (task.startTime && task.endTime) {
                    await this.addTaskToSchedule(task);
                }
            }
            else {
                console.log('[SmartSchedulingService] No optimal time found for task');
                // Send notification about no optimal time found
                const notification = await this.notificationService.notifyNoOptimalTime(task);
                console.log('[SmartSchedulingService] Notification sent:', notification.id);
                // Do NOT save the task when no optimal time is found
                // User must take action via notification (manual schedule, adjust priority, etc.)
                throw new Error(`Could not schedule task "${task.title}": No optimal time slot available`);
            }
        }
        else {
            // For tasks that don't need smart scheduling (manual tasks or tasks with no dates)
            console.log('[SmartSchedulingService] No smart scheduling needed');
            // ACCEPTANCE CRITERIA: Always use duration to calculate endTime when available
            // This applies even to manual tasks that already have both startTime and endTime
            if (task.startTime && taskData.estimatedDuration) {
                const calculatedEndTime = (0, date_fns_1.addMinutes)(new Date(taskData.startTime), taskData.estimatedDuration);
                console.log('[SmartSchedulingService] Overriding endTime with duration calculation:', {
                    original: task.endTime,
                    calculated: calculatedEndTime
                });
                task.endTime = calculatedEndTime;
            }
            // Save the task (whether it has dates or not)
            await task.save();
            // Add to schedule only if task has both start and end times
            if (task.startTime && task.endTime) {
                await this.addTaskToSchedule(task);
            }
        }
        console.log('[SmartSchedulingService] Task created with final time:', {
            startTime: task.startTime,
            endTime: task.endTime
        });
        return task;
    }
    /**
     * Check if a task can be scheduled in late wind-down period
     * Only personal tasks with high priority and deadline today are allowed
     */
    canScheduleInLateWindDown(task) {
        if (task.tag !== 'personal')
            return false;
        if (task.priority !== 5)
            return false; // Priority 5 is highest
        // Check if deadline is today
        if (!task.endTime)
            return false;
        const today = (0, date_fns_1.startOfDay)(new Date());
        const tomorrow = (0, date_fns_1.addDays)(today, 1);
        const deadline = new Date(task.endTime);
        return deadline >= today && deadline < tomorrow;
    }
    /**
     * Check if a time falls within the late wind-down period (2 hours before bedtime)
     */
    async isInLateWindDownPeriod(time, userId, task) {
        const user = await models_1.User.findById(userId).select('sleepSchedule');
        if (!user?.sleepSchedule)
            return false;
        const { bedtime } = user.sleepSchedule;
        const hour = time.getHours();
        // Calculate 2 hours before bedtime
        let lateWindDownStart = bedtime - 2;
        if (lateWindDownStart < 0)
            lateWindDownStart += 24;
        // Check if hour falls in late wind-down period
        let isInLateWindDown = false;
        if (bedtime >= 2) {
            // Normal case: bedtime is 2 or later
            isInLateWindDown = hour >= lateWindDownStart && hour < bedtime;
        }
        else {
            // Cross-midnight case
            isInLateWindDown = hour >= lateWindDownStart || hour < bedtime;
        }
        // If in late wind-down, only allow if task meets special criteria
        if (isInLateWindDown) {
            // Only personal tasks with high priority and deadline today
            if (task.tag !== 'personal')
                return false;
            if (task.priority !== 5)
                return false;
            // Check if deadline is today
            if (!task.endTime)
                return false;
            const today = (0, date_fns_1.startOfDay)(new Date());
            const tomorrow = (0, date_fns_1.addDays)(today, 1);
            const deadline = new Date(task.endTime);
            const isDeadlineToday = deadline >= today && deadline < tomorrow;
            return isDeadlineToday;
        }
        return true;
    }
    /**
     * Check if a time falls within actual sleep hours (bedtime to wake time)
     */
    async isInSleepHours(time, userId) {
        const user = await models_1.User.findById(userId).select('sleepSchedule');
        if (!user?.sleepSchedule)
            return false;
        const { bedtime, wakeHour } = user.sleepSchedule;
        const hour = time.getHours();
        // Check if hour falls during sleep time
        let isInSleepHours = false;
        if (bedtime < wakeHour) {
            // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM - unusual but possible)
            isInSleepHours = hour >= bedtime && hour < wakeHour;
        }
        else {
            // Sleep crosses midnight (normal case: e.g., bed at 11 PM, wake at 7 AM)
            isInSleepHours = hour >= bedtime || hour < wakeHour;
        }
        // Never allow scheduling during sleep hours
        return !isInSleepHours;
    }
    /**
     * Handle task displacement when a higher priority task needs the slot
     */
    async handleTaskDisplacement(newTask) {
        if (!newTask.startTime || !newTask.endTime)
            return;
        // Find conflicting smart-scheduled tasks
        const conflictingTasks = await models_1.Task.find({
            userId: newTask.userId,
            isAutoSchedule: true,
            _id: { $ne: newTask._id },
            startTime: { $lt: newTask.endTime },
            endTime: { $gt: newTask.startTime },
            status: 'pending'
        });
        for (const existingTask of conflictingTasks) {
            const shouldDisplace = this.shouldDisplaceTask(newTask, existingTask);
            if (shouldDisplace) {
                console.log('[SmartSchedulingService] Displacing task:', existingTask.title);
                // Find new time for displaced task
                const taskSelect = this.convertToTaskSelect(existingTask);
                const newTime = await this.findOptimalTimeForTask(taskSelect, existingTask.userId, 0, [newTask._id?.toString() || '']);
                if (newTime) {
                    existingTask.startTime = newTime.startTime;
                    existingTask.endTime = newTime.endTime;
                    await existingTask.save();
                    // Update schedule item
                    await models_1.ScheduleItem.findOneAndUpdate({ taskId: existingTask._id?.toString() }, {
                        startTime: existingTask.startTime,
                        endTime: existingTask.endTime
                    });
                    // Send notification about displacement
                    const notification = await this.notificationService.sendNotification(notificationService_1.NotificationType.TASK_RESCHEDULED, existingTask.userId, {
                        taskTitle: existingTask.title,
                        oldTime: { startTime: existingTask.startTime, endTime: existingTask.endTime },
                        newTime: { startTime: newTime.startTime, endTime: newTime.endTime },
                        reason: `Displaced by higher priority task: ${newTask.title}`
                    });
                    console.log('[SmartSchedulingService] Notification sent:', notification.id);
                }
                else {
                    // Could not find alternative time for displaced task
                    const notification = await this.notificationService.sendNotification(notificationService_1.NotificationType.NO_OPTIMAL_TIME, existingTask.userId, {
                        taskTitle: existingTask.title,
                        reason: `Displaced by ${newTask.title} but no alternative slot available`
                    });
                    console.log('[SmartSchedulingService] Notification sent:', notification.id);
                }
            }
        }
    }
    /**
     * Determine if a new task should displace an existing task
     */
    shouldDisplaceTask(newTask, existingTask) {
        // Higher priority wins
        if (newTask.priority > existingTask.priority)
            return true;
        // Earlier deadline wins (if same priority)
        if (newTask.priority === existingTask.priority) {
            if (newTask.endTime && existingTask.endTime) {
                return new Date(newTask.endTime) < new Date(existingTask.endTime);
            }
        }
        return false;
    }
    /**
     * Find optimal time for a task based on energy and schedule
     */
    async findOptimalTimeForTask(task, userId, daysToLookAhead = 0, excludeTaskIds = []) {
        try {
            // Check if we've exceeded the scheduling window (6 days for planner)
            if (daysToLookAhead > 6) {
                console.log('[findOptimalTimeForTask] Exceeded 6-day planner window');
                return null;
            }
            // First try with current target date
            const context = await this.buildSchedulingContext(task, userId, excludeTaskIds);
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
                energyRequirements,
                priority: task.priority
            });
            // Get user's sleep schedule for late wind-down filtering
            const user = await models_1.User.findById(userId).select('sleepSchedule');
            let availableSlots = SmartScheduling.getAvailableSlotsForContext(context, taskDuration, energyRequirements, task.endTime);
            if (!user?.sleepSchedule) {
                console.log('[removing wind_down_slots] User has no sleep schedule');
            }
            // Filter out late wind-down period slots (2 hours before bedtime)
            if (user?.sleepSchedule) {
                console.log('[removing wind_down_slots] User has sleep schedule:', user.sleepSchedule);
                availableSlots = await this.filterLateWindDownSlots(availableSlots, user.sleepSchedule, task);
            }
            // Filter out sleep hour slots (bedtime to wake time)
            if (user?.sleepSchedule) {
                availableSlots = await this.filterSleepHourSlots(availableSlots, user.sleepSchedule);
            }
            console.log('[findOptimalTimeForTask] Available slots after filtering:', availableSlots.length);
            if (availableSlots.length > 0) {
                console.log('[findOptimalTimeForTask] First few slots:', availableSlots.slice(0, 3).map(s => ({
                    time: s.startTime,
                    energy: s.energyLevel
                })));
            }
            if (availableSlots.length === 0) {
                console.log('[findOptimalTimeForTask] No available slots found on current day');
                // Check if we should look ahead based on deadline constraints
                const nextDay = task.startTime ? (0, date_fns_1.addDays)(task.startTime, 1) : (0, date_fns_1.addDays)(new Date(), 1);
                console.log('[findOptimalTimeForTask] Next day:', nextDay);
                console.log('[findOptimalTimeForTask] Task deadline:', task.endTime);
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
                if (daysToLookAhead < 6) { // Limit to 6 days for planner
                    console.log(`[findOptimalTimeForTask] Looking ahead to day ${daysToLookAhead + 1}`);
                    // Create a modified task with target date shifted to the next day
                    const nextDayTask = { ...task };
                    nextDayTask.startTime = nextDayStart;
                    // Recursively call this function with the incremented daysToLookAhead counter
                    return this.findOptimalTimeForTask(nextDayTask, userId, daysToLookAhead + 1, excludeTaskIds);
                }
                console.log('[findOptimalTimeForTask] Reached maximum days to look ahead (6 days), no slots found');
                return null;
            }
            // ACCEPTANCE CRITERIA: Optimize for best energy match within the window
            // Sort slots by energy level (descending) and then by time (ascending)
            const sortedSlots = availableSlots.sort((a, b) => {
                // First sort by energy level (higher is better)
                const energyDiff = b.energyLevel - a.energyLevel;
                if (Math.abs(energyDiff) > 0.1)
                    return energyDiff;
                // If energy levels are similar, prefer earlier times
                return a.startTime.getTime() - b.startTime.getTime();
            });
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
     * Filter out slots that fall in the late wind-down period
     */
    async filterLateWindDownSlots(slots, sleepSchedule, task) {
        const { bedtime } = sleepSchedule;
        // Calculate 2 hours before bedtime
        let lateWindDownStart = bedtime - 2;
        if (lateWindDownStart < 0)
            lateWindDownStart += 24;
        return slots.filter(slot => {
            const hour = slot.startTime.getHours();
            // Check if slot is in late wind-down period
            let isInLateWindDown = false;
            if (bedtime >= 2) {
                // Normal case: bedtime is 2 or later
                isInLateWindDown = hour >= lateWindDownStart && hour < bedtime;
            }
            else {
                // Cross-midnight case
                isInLateWindDown = hour >= lateWindDownStart || hour < bedtime;
            }
            console.log('[isInLateWindDownPeriod] Hour:', hour, 'Is in late wind-down:', isInLateWindDown);
            // If in late wind-down, only allow if task meets special criteria
            if (isInLateWindDown) {
                // Only personal tasks with high priority and deadline today
                if (task.tag !== 'personal')
                    return false;
                if (task.priority !== 5)
                    return false;
                // Check if deadline is today
                if (!task.endTime)
                    return false;
                const today = (0, date_fns_1.startOfDay)(new Date());
                const tomorrow = (0, date_fns_1.addDays)(today, 1);
                const deadline = new Date(task.endTime);
                const isDeadlineToday = deadline >= today && deadline < tomorrow;
                return isDeadlineToday;
            }
            return true;
        });
    }
    /**
     * Filter out slots that fall during sleep hours (bedtime to wake time)
     */
    async filterSleepHourSlots(slots, sleepSchedule) {
        const { bedtime, wakeHour } = sleepSchedule;
        return slots.filter(slot => {
            const hour = slot.startTime.getHours();
            // Check if hour falls during sleep time
            let isInSleepHours = false;
            if (bedtime < wakeHour) {
                // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM - unusual but possible)
                isInSleepHours = hour >= bedtime && hour < wakeHour;
            }
            else {
                // Sleep crosses midnight (normal case: e.g., bed at 11 PM, wake at 7 AM)
                isInSleepHours = hour >= bedtime || hour < wakeHour;
            }
            // Never allow scheduling during sleep hours
            return !isInSleepHours;
        });
    }
    /**
     * Build scheduling context for smart scheduling
     */
    async buildSchedulingContext(task, userId, excludeTaskIds = []) {
        const targetDate = SmartScheduling.determineTargetDate(task);
        const strategy = SmartScheduling.determineSchedulingStrategy(targetDate);
        console.log('[buildSchedulingContext] Strategy:', {
            targetDate,
            strategy: strategy.strategy,
            isToday: strategy.isToday
        });
        // Get schedule items (with buffer consideration)
        const schedule = await this.getScheduleItemsWithBuffer(userId, targetDate, task, excludeTaskIds);
        console.log('[buildSchedulingContext] Schedule items with buffer:', schedule.length);
        // Get today's energy forecast if scheduling for today
        let todayEnergyForecast;
        if (strategy.isToday) {
            todayEnergyForecast = await this.getTodayEnergyForecast(userId);
            console.log('[buildSchedulingContext] Today energy forecast entries:', todayEnergyForecast.length);
        }
        // Get historical patterns - ALWAYS include these as fallback
        let historicalPatterns = await this.getHistoricalPatterns(userId);
        console.log('[buildSchedulingContext] Historical patterns:', historicalPatterns.length);
        // If no patterns exist, generate based on user's sleep schedule
        if (historicalPatterns.length === 0) {
            console.log('[buildSchedulingContext] No historical patterns found');
            // Check if user has a sleep schedule to generate defaults
            const user = await models_1.User.findById(userId).select('sleepSchedule');
            if (user?.sleepSchedule) {
                console.log('[buildSchedulingContext] Using default patterns based on sleep schedule');
                // Generate patterns based on sleep schedule
                historicalPatterns = this.getDefaultEnergyPatternsWithSleep(user.sleepSchedule);
            }
            else {
                console.log('[buildSchedulingContext] Using generic default patterns');
                historicalPatterns = this.getDefaultEnergyPatterns();
            }
        }
        return {
            schedule,
            todayEnergyForecast,
            historicalPatterns,
            schedulingStrategy: strategy.strategy,
            targetDate
        };
    }
    /**
     * Get schedule items with 10-minute buffer for events
     */
    async getScheduleItemsWithBuffer(userId, targetDate, task, excludeTaskIds = []) {
        const query = { userId };
        if (excludeTaskIds.length > 0) {
            query.taskId = { $nin: excludeTaskIds };
        }
        if (targetDate) {
            const endOfSearchWindow = task.endTime ? task.endTime : (0, date_fns_1.addDays)(targetDate, 7);
            query.startTime = { $gte: targetDate, $lt: endOfSearchWindow };
            console.log('[getScheduleItemsWithBuffer] Date-only query:', {
                targetDate,
                endOfSearchWindow,
                query: JSON.stringify(query),
                isDateOnly: task.startTime ? SmartScheduling.isDateOnlyWithoutTime(task.startTime) : false
            });
        }
        else {
            // Get upcoming items
            const now = new Date();
            const futureLimit = (0, date_fns_1.addDays)(now, 30);
            query.startTime = { $gte: now, $lt: futureLimit };
            console.log('[getScheduleItemsWithBuffer] No target date query:', {
                now,
                futureLimit,
                query: JSON.stringify(query)
            });
        }
        const items = await models_1.ScheduleItem.find(query).sort({ startTime: 1 });
        console.log('[getScheduleItemsWithBuffer] Found items:', {
            count: items.length,
            items: items.map(item => ({
                title: item.title,
                startTime: item.startTime,
                endTime: item.endTime,
                type: item.type
            }))
        });
        // ACCEPTANCE CRITERIA: Add 10-minute buffer to events
        return items.map(item => {
            const scheduleItem = {
                id: item.id,
                title: item.title,
                startTime: item.startTime,
                endTime: item.endTime,
                type: item.type
            };
            // Add buffer for events (meetings)
            if (item.type === 'event') {
                // Extend the event time by 10 minutes on each side for conflict checking
                scheduleItem.startTime = (0, date_fns_1.addMinutes)(item.startTime, -10);
                scheduleItem.endTime = (0, date_fns_1.addMinutes)(item.endTime, 10);
            }
            return scheduleItem;
        });
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
        // Get user's sleep schedule for filling missing hours
        const user = await models_1.User.findById(userId).select('sleepSchedule');
        // Group by hour and calculate averages
        const hourlyData = new Map();
        energyData.forEach(entry => {
            const hour = entry.hour;
            if (!hourlyData.has(hour)) {
                hourlyData.set(hour, []);
            }
            hourlyData.get(hour).push(entry.energyLevel);
        });
        // Ensure all 24 hours have patterns
        for (let hour = 0; hour < 24; hour++) {
            if (hourlyData.has(hour)) {
                // Update with actual data
                const levels = hourlyData.get(hour);
                const averageEnergy = levels.reduce((sum, level) => sum + level, 0) / levels.length;
                await models_1.HistoricalEnergyPattern.findOneAndUpdate({ userId, hour }, {
                    averageEnergy,
                    sampleCount: levels.length,
                    lastUpdated: new Date()
                }, { upsert: true });
            }
            else {
                // Fill missing hour with default based on sleep schedule
                let defaultEnergy = 0.1; // Default sleep energy
                if (user?.sleepSchedule) {
                    const { bedtime, wakeHour } = user.sleepSchedule;
                    const isAwake = bedtime > wakeHour
                        ? (hour >= wakeHour && hour < bedtime)
                        : (hour >= wakeHour || hour < bedtime);
                    if (isAwake) {
                        // Use default awake energy patterns
                        const defaultPatterns = this.getDefaultEnergyPatternsWithSleep(user.sleepSchedule);
                        const pattern = defaultPatterns.find(p => p.hour === hour);
                        defaultEnergy = pattern?.averageEnergy || 0.5;
                    }
                }
                await models_1.HistoricalEnergyPattern.findOneAndUpdate({ userId, hour }, {
                    averageEnergy: defaultEnergy,
                    sampleCount: 0, // Mark as default/estimated
                    lastUpdated: new Date()
                }, { upsert: true });
            }
        }
        console.log(`[updateHistoricalPatterns] Updated all 24 hourly patterns for user ${userId} (${hourlyData.size} with actual data, ${24 - hourlyData.size} with defaults)`);
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
        // ACCEPTANCE CRITERIA: Always use duration to calculate endTime
        if (updates.startTime && updates.estimatedDuration) {
            updates.endTime = (0, date_fns_1.addMinutes)(new Date(updates.startTime), updates.estimatedDuration);
            console.log('[updateTaskWithRescheduling] Overriding endTime with duration');
        }
        else if (updates.estimatedDuration && task.startTime) {
            // If only duration is updated, recalculate endTime
            updates.endTime = (0, date_fns_1.addMinutes)(task.startTime, updates.estimatedDuration);
        }
        // Apply updates
        Object.assign(task, updates);
        // Check if rescheduling is needed
        if (SmartScheduling.shouldAutoReschedule(oldTaskSelect, updates)) {
            const scheduledTime = await this.findOptimalTimeForTask(this.convertToTaskSelect(task), task.userId);
            if (scheduledTime) {
                task.startTime = scheduledTime.startTime;
                task.endTime = scheduledTime.endTime;
                // Check for and handle any displacements
                await this.handleTaskDisplacement(task);
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
        // Add buffer to event for conflict detection
        const bufferedEventStart = (0, date_fns_1.addMinutes)(event.startTime, -10);
        const bufferedEventEnd = (0, date_fns_1.addMinutes)(event.endTime, 10);
        // Find tasks that conflict with the new event (including buffer)
        const conflictingTasks = await models_1.Task.find({
            userId: event.userId,
            isAutoSchedule: true,
            startTime: { $lt: bufferedEventEnd },
            endTime: { $gt: bufferedEventStart },
            status: 'pending'
        });
        console.log(`[rescheduleTasksForNewEvent] Found ${conflictingTasks.length} conflicting tasks`);
        // Reschedule each conflicting task
        for (const task of conflictingTasks) {
            const taskSelect = this.convertToTaskSelect(task);
            const newTime = await this.findOptimalTimeForTask(taskSelect, task.userId);
            if (newTime) {
                const oldTime = { startTime: task.startTime, endTime: task.endTime };
                task.startTime = newTime.startTime;
                task.endTime = newTime.endTime;
                await task.save();
                // Update schedule item
                await models_1.ScheduleItem.findOneAndUpdate({ taskId: task.id }, {
                    startTime: task.startTime,
                    endTime: task.endTime
                });
                // Send notification about rescheduling
                const notification = await this.notificationService.sendNotification(notificationService_1.NotificationType.TASK_RESCHEDULED, task.userId, {
                    taskTitle: task.title,
                    oldTime,
                    newTime,
                    reason: `Calendar event "${event.title}" was added`
                });
                console.log('[rescheduleTasksForNewEvent] Notification sent:', notification.id);
            }
            else {
                // Could not find alternative time
                const notification = await this.notificationService.sendNotification(notificationService_1.NotificationType.NO_OPTIMAL_TIME, task.userId, {
                    taskTitle: task.title,
                    reason: `Conflicted with event "${event.title}" but no alternative slot available`
                });
                console.log('[rescheduleTasksForNewEvent] Notification sent:', notification.id);
            }
        }
    }
    /**
     * Get default energy patterns with sleep schedule consideration
     */
    getDefaultEnergyPatternsWithSleep(sleepSchedule) {
        const patterns = [];
        const { bedtime, wakeHour } = sleepSchedule;
        for (let hour = 0; hour < 24; hour++) {
            let energy = 0.05; // Default sleep energy (always < 0.1)
            // Check if hour is during wake time
            const isAwake = bedtime > wakeHour
                ? (hour >= wakeHour && hour < bedtime)
                : (hour >= wakeHour || hour < bedtime);
            if (isAwake) {
                // Calculate hours since wake
                let hoursSinceWake = hour >= wakeHour ? hour - wakeHour : (24 - wakeHour + hour);
                const awakeHours = bedtime > wakeHour ? bedtime - wakeHour : (24 - wakeHour + bedtime);
                const relativeTime = hoursSinceWake / awakeHours;
                // Check if this is late wind-down period (2 hours before bedtime)
                let hoursBeforeBed;
                if (bedtime > hour) {
                    hoursBeforeBed = bedtime - hour;
                }
                else {
                    hoursBeforeBed = (24 - hour) + bedtime;
                }
                if (hoursBeforeBed <= 2 && hoursBeforeBed > 0) {
                    // Late wind-down: between 0.1 and 0.3
                    energy = 0.15 + (Math.random() * 0.1); // 0.15-0.25 range
                }
                else {
                    // Generate energy based on relative time in wake period
                    if (relativeTime < 0.1) {
                        energy = 0.3 + (relativeTime * 5); // Morning rise
                    }
                    else if (relativeTime < 0.35) {
                        energy = 0.8 + (Math.sin((relativeTime - 0.1) * 4) * 0.1); // Morning peak
                    }
                    else if (relativeTime < 0.6) {
                        energy = 0.5 + (Math.random() * 0.2); // Midday dip
                    }
                    else if (relativeTime < 0.75) {
                        energy = 0.7 + (Math.random() * 0.1); // Afternoon rebound
                    }
                    else {
                        // Regular wind down (not late wind-down)
                        energy = 0.4 + (Math.random() * 0.2); // Regular wind down
                    }
                }
            }
            else {
                // Sleep hours: always < 0.1
                energy = 0.01 + (Math.random() * 0.05); // 0.01-0.06 range
            }
            patterns.push({ hour, averageEnergy: Math.max(0.01, Math.min(1.0, energy)) });
        }
        return patterns;
    }
    /**
     * Get default energy patterns (fallback when no user data)
     */
    getDefaultEnergyPatterns() {
        console.log('[getDefaultEnergyPatterns] Using default patterns');
        return [
            { hour: 0, averageEnergy: 0.01 }, // Sleep
            { hour: 1, averageEnergy: 0.01 }, // Sleep
            { hour: 2, averageEnergy: 0.01 }, // Sleep
            { hour: 3, averageEnergy: 0.01 }, // Sleep
            { hour: 4, averageEnergy: 0.01 }, // Sleep
            { hour: 5, averageEnergy: 0.01 }, // Sleep
            { hour: 6, averageEnergy: 0.26 }, // Early morning
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
            { hour: 21, averageEnergy: 0.26 }, // Late evening (late wind-down starts here for 11pm bedtime)
            { hour: 22, averageEnergy: 0.2 }, // Pre-sleep (late wind-down)
            { hour: 23, averageEnergy: 0.01 }, // Sleep
        ];
    }
}
exports.SmartSchedulingService = SmartSchedulingService;
