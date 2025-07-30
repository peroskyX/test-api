"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMultiChunkContext = buildMultiChunkContext;
exports.buildMultiChunkPromptContext = buildMultiChunkPromptContext;
exports.shouldAutoReschedule = shouldAutoReschedule;
exports.hasDeadlineConflict = hasDeadlineConflict;
exports.needsInitialScheduling = needsInitialScheduling;
exports.determineTargetDate = determineTargetDate;
exports.determineSchedulingStrategy = determineSchedulingStrategy;
exports.calculateSchedulingWindow = calculateSchedulingWindow;
exports.isStartTimeSet = isStartTimeSet;
exports.isDateOnlyWithoutTime = isDateOnlyWithoutTime;
exports.getAvailableSlotsForContext = getAvailableSlotsForContext;
exports.generateFlexibleMultiDaySlots = generateFlexibleMultiDaySlots;
exports.getEnergyRequirementsForTask = getEnergyRequirementsForTask;
exports.extractTaskDuration = extractTaskDuration;
exports.analyzeAvailableSlotsToday = analyzeAvailableSlotsToday;
exports.analyzeAvailableSlotsFuture = analyzeAvailableSlotsFuture;
exports.buildPromptContext = buildPromptContext;
exports.analyzeCognitiveLoad = analyzeCognitiveLoad;
exports.countCognitiveTasks = countCognitiveTasks;
exports.getOptimalEnergyStagesForTask = getOptimalEnergyStagesForTask;
const date_fns_1 = require("date-fns");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const dayjs = require("dayjs");
dayjs().format();
dayjs.extend(utc);
dayjs.extend(timezone);
const lodash_1 = require("lodash");
const constants_1 = require("./constants");
function buildMultiChunkContext(baseContext, allChunks) {
    const chunkInfo = {
        isMultiChunkScheduling: true,
        totalChunks: allChunks.length,
        allChunkIds: allChunks.map(c => c.id),
        chunkTitles: allChunks.map(c => c.title),
        chunkDurations: allChunks.map(c => extractTaskDuration(c)),
    };
    return {
        ...baseContext,
        chunkInfo,
    };
}
function buildMultiChunkPromptContext(allChunks, context, availableSlots) {
    const isUsingFutureStrategy = context.schedulingStrategy === "future";
    const schedulingNote = isUsingFutureStrategy
        ? "Using historical energy patterns for future scheduling since forecast is only available for today"
        : "Using today's actual energy forecast";
    const cognitiveLoad = analyzeCognitiveLoad(context.schedule);
    const energyRequirements = getEnergyRequirementsForTask(allChunks[0]?.tag || "admin");
    return {
        currentTime: new Date().toISOString(),
        schedule: context.schedule,
        // energyHistory removed
        todayEnergyForecast: context.todayEnergyForecast,
        historicalPatterns: context.historicalPatterns,
        availableSlots,
        schedulingStrategy: context.schedulingStrategy,
        targetDate: context.targetDate?.toISOString(),
        cognitiveLoad,
        energyRequirements,
        constraints: buildTaskConstraints(allChunks[0] || {}),
        note: `${schedulingNote}. This is a multi-chunk scheduling request - optimize all ${allChunks.length} chunks as a sequence while avoiding conflicts.`,
    };
}
function shouldAutoReschedule(task, changes) {
    const autoSchedulingDisabled = !task.isAutoSchedule;
    if (autoSchedulingDisabled) {
        return false;
    }
    const isInitialSchedulingCheck = !changes;
    if (isInitialSchedulingCheck) {
        return needsInitialScheduling(task);
    }
    if (changes?.endTime && task.endTime) {
        if (hasDeadlineConflict(task, changes)) {
            return true;
        }
    }
    return changesRequireRescheduling(task, changes);
}
function hasDeadlineConflict(existingTask, newTask) {
    if (!existingTask.endTime || !newTask.endTime) {
        return false;
    }
    const existingDeadline = new Date(existingTask.endTime);
    const newDeadline = new Date(newTask.endTime);
    return newDeadline.getTime() < existingDeadline.getTime();
}
function needsInitialScheduling(task) {
    const hasDateWithoutSpecificTime = task.startTime ? isDateOnlyWithoutTime(task.startTime) : false;
    const hasDeadlineButNoStartTime = !task.startTime && !!task.endTime;
    return hasDateWithoutSpecificTime || hasDeadlineButNoStartTime;
}
function requiresReschedulingDueToTimeChanges(changes) {
    const isRemovingStartTime = changes.startTime === null;
    if (isRemovingStartTime)
        return true;
    const hasNoStartTimeChange = !changes.startTime;
    if (hasNoStartTimeChange)
        return null;
    const isSettingDateOnly = isDateOnlyWithoutTime(changes.startTime);
    return isSettingDateOnly;
}
function changesRequireRescheduling(task, changes) {
    const timeChangeResult = requiresReschedulingDueToTimeChanges(changes);
    const hasTimeChangeResult = timeChangeResult !== null;
    if (hasTimeChangeResult) {
        return timeChangeResult;
    }
    return hasSignificantChanges(task, changes);
}
function hasSignificantChanges(task, changes) {
    const priorityChangedSignificantly = hasSignificantPriorityChange(task, changes);
    const durationChangedSignificantly = hasSignificantDurationChange(task, changes);
    const requiresRescheduling = priorityChangedSignificantly || durationChangedSignificantly;
    return requiresRescheduling;
}
function determineTargetDate(task) {
    const hasStartTimeWithoutSpecificTime = task.startTime && isDateOnlyWithoutTime(task.startTime);
    if (hasStartTimeWithoutSpecificTime) {
        console.log("hasStartTimeWithoutSpecificTime", task.startTime);
        dayjs(task.startTime).tz("Africa/Lagos");
        const localStartTime = dayjs(task.startTime).tz("Africa/Lagos").toDate();
        console.log("localStartTime", localStartTime);
        return localStartTime;
    }
    const onlYhasDeadline = task.endTime;
    if (onlYhasDeadline && !task.startTime) {
        // NEW: When only deadline is provided, use today as the target date
        const today = (0, date_fns_1.startOfDay)(new Date());
        return today;
    }
    const hasDeadline = task.endTime;
    if (hasDeadline) {
        const deadlineBasedDate = calculateDeadlineBasedDate(task.endTime);
        return deadlineBasedDate;
    }
    return null;
}
function determineSchedulingStrategy(targetDate) {
    const hasNoTargetDate = !targetDate;
    if (hasNoTargetDate) {
        return {
            isToday: false,
            strategy: "future",
        };
    }
    const isTargetDateToday = dayjs(targetDate).utc().format('YYYY-MM-DD') === dayjs().utc().format('YYYY-MM-DD');
    console.log("isTargetDateToday", isTargetDateToday);
    console.log("targetDate UTC", dayjs(targetDate).utc().format('YYYY-MM-DD'));
    console.log("today UTC", dayjs().utc().format('YYYY-MM-DD'));
    const strategy = isTargetDateToday ? "today" : "future";
    return {
        isToday: isTargetDateToday,
        strategy,
    };
}
/**
 * Calculates the number of days available for scheduling a task.
 * The logic prioritizes the deadline (`endTime`). If no deadline is set, it falls back to the `startTime`.
 * If neither is available, it returns a default scheduling window of 7 days.
 * This ensures tasks are scheduled within the most relevant future timeframe.
 */
function calculateSchedulingWindow(task) {
    const defaultSchedulingWindowDays = constants_1.DAYS_PER_WEEK;
    const dayInMilliseconds = constants_1.MILLISECONDS_PER_SECOND * constants_1.SECONDS_PER_MINUTE * constants_1.MINUTES_PER_HOUR * constants_1.HOURS_PER_DAY;
    const now = new Date().getTime();
    let daysUntil;
    if (task.endTime) {
        daysUntil = Math.ceil((new Date(task.endTime).getTime() - now) / dayInMilliseconds);
    }
    else if (task.startTime) {
        daysUntil = Math.ceil((new Date(task.startTime).getTime() - now) / dayInMilliseconds);
    }
    else {
        return defaultSchedulingWindowDays;
    }
    return Math.min(defaultSchedulingWindowDays, daysUntil);
}
function isStartTimeSet(task) {
    return task.startTime !== null;
}
function isDateOnlyWithoutTime(date) {
    if (!date)
        return false;
    console.log("task date", date);
    const localTime = dayjs(date).tz("Africa/Lagos");
    return localTime.format("HH:mm:ss") === "00:00:00";
}
function hasSignificantPriorityChange(task, changes) {
    const significantPriorityThreshold = 2;
    const priorityNotProvided = changes?.priority === undefined;
    const taskHasNoPriority = task.priority === null;
    const cannotComparePriority = priorityNotProvided || taskHasNoPriority;
    if (cannotComparePriority) {
        return false;
    }
    const priorityDifference = Math.abs(changes.priority - task.priority);
    const isSignificantChange = priorityDifference >= significantPriorityThreshold;
    return isSignificantChange;
}
function hasSignificantDurationChange(task, changes) {
    const significantDurationThresholdMinutes = 30;
    const changesHasNoDuration = changes?.estimatedDuration == null;
    const taskHasNoDuration = task.estimatedDuration == null;
    const cannotCompareDurations = changesHasNoDuration || taskHasNoDuration;
    if (cannotCompareDurations) {
        return false;
    }
    const durationDifferenceInMinutes = Math.abs(changes.estimatedDuration - task.estimatedDuration);
    const isSignificantChange = durationDifferenceInMinutes >= significantDurationThresholdMinutes;
    return isSignificantChange;
}
function calculateDeadlineBasedDate(endTime) {
    const deadline = new Date(endTime);
    const today = new Date();
    const isDeadlineInFuture = deadline > today;
    if (isDeadlineInFuture) {
        return deadline;
    }
    return null;
}
function shouldUseTodaySlots(context) {
    return context.schedulingStrategy === "today" && context.todayEnergyForecast;
}
function shouldUseFutureSlots(context) {
    return context.schedulingStrategy === "future" && context.historicalPatterns;
}
function getAvailableSlotsForContext(context, taskDuration, energyRequirements, deadline) {
    if (shouldUseTodaySlots(context)) {
        const todaySlots = analyzeAvailableSlotsToday({
            schedule: context.schedule,
            energyForecast: context.todayEnergyForecast,
            taskDuration,
            energyRequirements,
        });
        return todaySlots;
    }
    if (!shouldUseFutureSlots(context)) {
        return generateFlexibleMultiDaySlots(context, taskDuration, energyRequirements);
    }
    if (context.targetDate) {
        const futureSlots = analyzeAvailableSlotsFuture({
            schedule: context.schedule,
            targetDate: context.targetDate,
            taskDuration,
            energyRequirements,
            historicalPatterns: context.historicalPatterns,
        });
        return futureSlots;
    }
    return generateFlexibleMultiDaySlots(context, taskDuration, energyRequirements);
}
function generateFlexibleMultiDaySlots(context, taskDuration, energyRequirements) {
    if (!context.historicalPatterns) {
        return [];
    }
    const daysToGenerate = 7;
    const today = new Date();
    const allSlots = [];
    for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
        const targetDate = (0, date_fns_1.addDays)(today, dayOffset);
        const daySlots = analyzeAvailableSlotsFuture({
            schedule: context.schedule,
            targetDate,
            taskDuration,
            energyRequirements,
            historicalPatterns: context.historicalPatterns,
        });
        allSlots.push(...daySlots);
    }
    return allSlots;
}
function getEnergyRequirementsForTask(taskTag) {
    switch (taskTag) {
        case "deep":
            return { min: constants_1.DEEP_WORK_MIN_ENERGY, max: constants_1.DEEP_WORK_MAX_ENERGY };
        case "creative":
            return { min: constants_1.CREATIVE_WORK_MIN_ENERGY, max: constants_1.CREATIVE_WORK_MAX_ENERGY };
        case "admin":
            return { min: constants_1.ADMIN_WORK_MIN_ENERGY, max: constants_1.ADMIN_WORK_MAX_ENERGY };
        case "personal":
            return { min: constants_1.PERSONAL_WORK_MIN_ENERGY, max: constants_1.PERSONAL_WORK_MAX_ENERGY };
        default:
            return { min: constants_1.DEFAULT_MIN_ENERGY, max: constants_1.DEFAULT_MAX_ENERGY };
    }
}
function extractTaskDuration(task) {
    const defaultTaskDurationMinutes = 60;
    return task.estimatedDuration ?? defaultTaskDurationMinutes;
}
function analyzeAvailableSlotsToday(params) {
    const bufferTimeMinutes = 15;
    const { schedule, energyForecast, taskDuration, energyRequirements } = params;
    const currentTime = new Date();
    const bufferedCurrentTime = (0, date_fns_1.addMinutes)(currentTime, bufferTimeMinutes);
    return (0, lodash_1.flow)((forecast) => forecast.map(mapEnergyToSlot), (slots) => slots.filter((slot) => {
        const slotIsFuture = slot.startTime >= bufferedCurrentTime;
        return slotIsFuture;
    }), processSlots(schedule, taskDuration, energyRequirements))(energyForecast);
}
function analyzeAvailableSlotsFuture(params) {
    const { schedule, targetDate, taskDuration, energyRequirements, historicalPatterns } = params;
    const currentTime = new Date();
    return (0, lodash_1.flow)((patterns) => patterns.filter(isHistoricalEnergyValid(energyRequirements)), (patterns) => patterns.map(mapPatternToSlot(targetDate)), (slots) => slots.filter(slot => slot.startTime > currentTime), addConflictFlag(schedule, taskDuration), (slots) => slots.filter((slot) => !slot.hasConflict))(historicalPatterns);
}
function buildPromptContext(task, context, availableSlots) {
    const isUsingFutureStrategy = context.schedulingStrategy === "future";
    const schedulingNote = isUsingFutureStrategy
        ? "Using historical energy patterns for future scheduling since forecast is only available for today"
        : "Using today's actual energy forecast";
    const cognitiveLoad = analyzeCognitiveLoad(context.schedule);
    const energyRequirements = getEnergyRequirementsForTask(task.tag);
    return {
        currentTime: new Date().toISOString(),
        schedule: context.schedule,
        // energyHistory removed
        todayEnergyForecast: context.todayEnergyForecast,
        historicalPatterns: context.historicalPatterns,
        availableSlots,
        schedulingStrategy: context.schedulingStrategy,
        targetDate: context.targetDate?.toISOString(),
        cognitiveLoad,
        energyRequirements,
        constraints: buildTaskConstraints(task),
        note: schedulingNote,
    };
}
function mapEnergyToSlot(energy) {
    const startTime = new Date(energy.date);
    const endTime = (0, date_fns_1.addHours)(startTime, energy.hour);
    startTime.setSeconds(0, 0);
    endTime.setSeconds(0, 0);
    return {
        startTime,
        endTime,
        energyLevel: energy.energyLevel,
        energyStage: energy.energyStage,
        hasConflict: false,
        isToday: true,
    };
}
function processSlots(schedule, duration, requirements) {
    return (0, lodash_1.flow)((slots) => slots.filter(isEnergyValid(requirements)), addConflictFlag(schedule, duration), (slots) => slots.filter((slot) => !slot.hasConflict));
}
function isHistoricalEnergyValid(requirements) {
    return (pattern) => {
        const meetsMinimumEnergy = pattern.averageEnergy >= requirements.min;
        const meetsMaximumEnergy = pattern.averageEnergy <= requirements.max;
        const isWithinEnergyRange = meetsMinimumEnergy && meetsMaximumEnergy;
        return isWithinEnergyRange;
    };
}
function mapPatternToSlot(targetDate) {
    console.log("targetDate", targetDate);
    return (pattern) => {
        const slotDurationMinutes = 60;
        const slotStartTime = dayjs(targetDate)
            .tz('Africa/Lagos') // Convert to user timezone
            .hour(pattern.hour) // Set the hour in user timezone
            .minute(0) // Reset to start of hour
            .second(0)
            .millisecond(0)
            .utc() // Convert back to UTC
            .toDate(); // Get JavaScript Date
        const slotEndTime = (0, date_fns_1.addMinutes)(slotStartTime, slotDurationMinutes);
        console.log("slotStartTime", slotStartTime);
        console.log("slotEndTime", slotEndTime);
        return {
            startTime: slotStartTime,
            endTime: slotEndTime,
            energyLevel: pattern.averageEnergy,
            energyStage: "historical",
            hasConflict: false,
            isToday: false,
            isHistorical: true,
        };
    };
}
function addConflictFlag(schedule, duration) {
    return (slots) => slots.map((slot) => ({
        ...slot,
        hasConflict: hasScheduleConflict(schedule, duration)(slot),
    }));
}
function analyzeCognitiveLoad(schedule) {
    const highCognitiveLoadThreshold = 2;
    const tasks = schedule.filter(item => item.type === "task");
    const cognitiveTasks = countCognitiveTasks(tasks);
    const cognitiveTaskCount = cognitiveTasks.length;
    const hasHighCognitiveLoad = cognitiveTaskCount >= highCognitiveLoadThreshold;
    const recommendedBuffer = hasHighCognitiveLoad
        ? "At least 30 minutes between demanding tasks"
        : "No buffer needed";
    return {
        recentDeepTaskCount: cognitiveTaskCount,
        recommendedBuffer,
    };
}
function buildTaskConstraints(task) {
    const hasDeadline = !!task.endTime;
    const hasStartDateWithoutTime = task.startTime && isDateOnlyWithoutTime(task.startTime);
    return {
        hasDeadline,
        deadlineUrgency: getDeadlineUrgency(task),
        hasStartDateOnly: hasStartDateWithoutTime,
        mustScheduleInFuture: "CRITICAL: Never schedule tasks in the past or within 15 minutes of current time",
    };
}
function isEnergyValid(requirements) {
    return (item) => {
        const meetsMinimumEnergy = item.energyLevel >= requirements.min;
        const meetsMaximumEnergy = item.energyLevel <= requirements.max;
        const isWithinEnergyRange = meetsMinimumEnergy && meetsMaximumEnergy;
        return isWithinEnergyRange;
    };
}
function hasScheduleConflict(schedule, duration) {
    // Buffer time in minutes to maintain before and after meetings
    const bufferMinutes = 10;
    return (slot) => schedule.some((item) => {
        const itemHasNoEndTime = !item.endTime;
        if (itemHasNoEndTime) {
            return false;
        }
        const slotEndTime = (0, date_fns_1.addMinutes)(slot.startTime, duration);
        const normalizedItemStart = new Date(item.startTime);
        const normalizedItemEnd = new Date(item.endTime);
        normalizedItemStart.setSeconds(0, 0);
        normalizedItemEnd.setSeconds(0, 0);
        // Apply buffer only for events/meetings (not for tasks)
        if (item.type === "event") {
            // Add buffer before and after meetings
            normalizedItemStart.setTime(normalizedItemStart.getTime() - bufferMinutes * 60 * 1000);
            normalizedItemEnd.setTime(normalizedItemEnd.getTime() + bufferMinutes * 60 * 1000);
        }
        const slotStartsBeforeItemEnds = slot.startTime < normalizedItemEnd;
        const slotEndsAfterItemStarts = slotEndTime > normalizedItemStart;
        const hasTimeConflict = slotStartsBeforeItemEnds && slotEndsAfterItemStarts;
        return hasTimeConflict;
    });
}
function countCognitiveTasks(recentTasks) {
    const isDeepTask = (task) => task.tag === "deep";
    const isCreativeTask = (task) => task.tag === "creative";
    const isCognitiveTask = (task) => isDeepTask(task) || isCreativeTask(task);
    return recentTasks.filter(isCognitiveTask);
}
function getDeadlineUrgency(task) {
    const hasNoDeadline = !task.endTime;
    if (hasNoDeadline) {
        return "none";
    }
    const oneDayFromNow = (0, date_fns_1.addDays)(new Date(), 1);
    const deadlineIsWithin24Hours = new Date(task.endTime) < oneDayFromNow;
    return deadlineIsWithin24Hours ? "urgent" : "normal";
}
function getOptimalEnergyStagesForTask(taskTag) {
    switch (taskTag) {
        case "deep":
            return ["morning_peak"];
        case "creative":
            return ["morning_peak", "afternoon_rebound"];
        case "admin":
            return ["midday_dip"];
        case "personal":
            return ["midday_dip", "wind_down"];
        default:
            return ["midday_dip", "wind_down"];
    }
}
