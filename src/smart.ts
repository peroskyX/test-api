import {
  addDays,
  addHours,
  addMinutes,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import * as utc from 'dayjs/plugin/utc' 
import * as timezone from 'dayjs/plugin/timezone';
import * as dayjs from 'dayjs'
dayjs().format()
dayjs.extend(utc)
dayjs.extend(timezone);
import { flow } from "lodash";

export type TAG = "deep" | "creative" | "admin" | "personal";


import {
  ADMIN_WORK_MAX_ENERGY,
  ADMIN_WORK_MIN_ENERGY,
  CREATIVE_WORK_MAX_ENERGY,
  CREATIVE_WORK_MIN_ENERGY,
  DAYS_PER_WEEK,
  DEEP_WORK_MAX_ENERGY,
  DEEP_WORK_MIN_ENERGY,
  DEFAULT_MAX_ENERGY,
  DEFAULT_MIN_ENERGY,
  HOURS_PER_DAY,
  MILLISECONDS_PER_SECOND,
  MINUTES_PER_HOUR,
  PERSONAL_WORK_MAX_ENERGY,
  PERSONAL_WORK_MIN_ENERGY,
  SECONDS_PER_MINUTE,
} from "./constants";

//   import type { ScheduleItem } from "../schedules/dto.schedule";

export type EnergySelect = {
  userId: string;
  _id: string;
  date: string;
  _creationTime: number;
  mood: "happy" | "motivated" | "focused" | "calm" | "grateful" | "confident" | "optimistic" | "inspired" | "indifferent" | "disappointed";
  energyLevel: number;
  energyStage: "morning_rise" | "morning_peak" | "afternoon_rebound" | "midday_dip" | "wind_down" | "sleep_phase";
  hour: number;
  hasManualCheckIn: boolean;
}

export type ScheduleItem = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: "task" | "event";
}

export type TaskSelect = Omit<ScheduleItem, "type"> & {
  isAutoSchedule: boolean;
  priority: number;
  estimatedDuration: number;
  tag: TAG;
  status: "pending" | "completed";
};
export type TaskBody = Omit<TaskSelect, "id" >;

export interface EnergySlot {
  startTime: Date;
  endTime: Date;
  energyLevel: number;
  energyStage: string;
  hasConflict: boolean;
  isToday: boolean;
  isHistorical?: boolean;
}

export interface HistoricalEnergyPattern {
  hour: number;
  averageEnergy: number;
}

export interface SlotAnalysisParams {
  schedule: ScheduleItem[];
  taskDuration: number;
  energyRequirements: { min: number; max: number };
}

export interface SchedulingContext {
  schedule: ScheduleItem[];
  todayEnergyForecast?: EnergySelect[];
  historicalPatterns?: HistoricalEnergyPattern[];
  schedulingStrategy: "today" | "future";
  targetDate?: Date | null;
}


export function buildMultiChunkContext(baseContext: SchedulingContext, allChunks: TaskSelect[]) {
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

export function buildMultiChunkPromptContext(
  allChunks: TaskSelect[],
  context: SchedulingContext,
  availableSlots: EnergySlot[],
) {
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
    constraints: buildTaskConstraints(allChunks[0] || {} as TaskSelect),
    note: `${schedulingNote}. This is a multi-chunk scheduling request - optimize all ${allChunks.length} chunks as a sequence while avoiding conflicts.`,
  };
}

export function shouldAutoReschedule(
  task: TaskSelect,
  changes?: Partial<TaskBody>,
) {
  const autoSchedulingDisabled = !task.isAutoSchedule;
  if (autoSchedulingDisabled) {
    return false;
  }

  const isInitialSchedulingCheck = !changes;
  if (isInitialSchedulingCheck) {
    return needsInitialScheduling(task);
  }

  if (changes?.endTime && task.endTime) {
    if (hasDeadlineConflict(task, changes as TaskSelect)) {
      return true;
    }
  }

  return changesRequireRescheduling(task, changes);
}

export function hasDeadlineConflict(existingTask: TaskSelect, newTask: Partial<TaskSelect>): boolean {
  if (!existingTask.endTime || !newTask.endTime) {
    return false;
  }

  const existingDeadline = new Date(existingTask.endTime);
  const newDeadline = new Date(newTask.endTime);

  return newDeadline.getTime() < existingDeadline.getTime();
}

export function needsInitialScheduling(task: TaskSelect): boolean {
  const hasDateWithoutSpecificTime = task.startTime ? isDateOnlyWithoutTime(task.startTime) : false;
  const hasDeadlineButNoStartTime = !task.startTime && !!task.endTime;

  return hasDateWithoutSpecificTime || hasDeadlineButNoStartTime;
}

function requiresReschedulingDueToTimeChanges(changes: Partial<TaskBody>) {
  const isRemovingStartTime = changes.startTime === null;
  if (isRemovingStartTime)
    return true;
  const hasNoStartTimeChange = !changes.startTime;
  if (hasNoStartTimeChange)
    return null;
  const isSettingDateOnly = isDateOnlyWithoutTime(changes.startTime as Date | null);
  return isSettingDateOnly;
}

function changesRequireRescheduling(task: TaskSelect, changes: Partial<TaskBody>) {
  const timeChangeResult = requiresReschedulingDueToTimeChanges(changes);
  const hasTimeChangeResult = timeChangeResult !== null;
  if (hasTimeChangeResult) {
    return timeChangeResult;
  }

  return hasSignificantChanges(task, changes);
}

function hasSignificantChanges(task: TaskSelect, changes: Partial<TaskBody>) {
  const priorityChangedSignificantly = hasSignificantPriorityChange(task, changes);
  const durationChangedSignificantly = hasSignificantDurationChange(task, changes);

  const requiresRescheduling = priorityChangedSignificantly || durationChangedSignificantly;
  return requiresRescheduling;
}

export function determineTargetDate(task: TaskSelect): Date | null {
  const hasStartTimeWithoutSpecificTime = task.startTime && isDateOnlyWithoutTime(task.startTime);
  if (hasStartTimeWithoutSpecificTime) {
    console.log("hasStartTimeWithoutSpecificTime", task.startTime);
    dayjs(task.startTime).tz("Africa/Lagos");
    const localStartTime = dayjs(task.startTime).tz("Africa/Lagos").toDate();
    console.log("localStartTime", localStartTime);
    return localStartTime;
  }

  const onlYhasDeadline = task.endTime;
  if ( onlYhasDeadline && !task.startTime) {
    // NEW: When only deadline is provided, use today as the target date
    const today = startOfDay(new Date());
    return today;
  }

  const hasDeadline = task.endTime;
  if (hasDeadline) {
    const deadlineBasedDate = calculateDeadlineBasedDate(task.endTime!);
    return deadlineBasedDate;
  }

  return null;
}

export function determineSchedulingStrategy(targetDate: Date | null) {
  const hasNoTargetDate = !targetDate;

  if (hasNoTargetDate) {
    return {
      isToday: false,
      strategy: "future" as const,
    };
  }

  const isTargetDateToday = targetDate < new Date();
  console.log("isTargetDateToday", isTargetDateToday);
  console.log("targetDate", targetDate);
  console.log("new Date()", new Date());
  const strategy = isTargetDateToday ? ("today" as const) : ("future" as const);

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
export function calculateSchedulingWindow(task: TaskSelect): number {
  const defaultSchedulingWindowDays = DAYS_PER_WEEK;
  const dayInMilliseconds = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
  const now = new Date().getTime();

  let daysUntil;

  if (task.endTime) {
    daysUntil = Math.ceil((new Date(task.endTime).getTime() - now) / dayInMilliseconds);
  } else if (task.startTime) {
    daysUntil = Math.ceil((new Date(task.startTime).getTime() - now) / dayInMilliseconds);
  } else {
    return defaultSchedulingWindowDays;
  }

  return Math.min(defaultSchedulingWindowDays, daysUntil);
}

export function isStartTimeSet(task: TaskSelect) {
  return task.startTime !== null;
}


export function isDateOnlyWithoutTime(date: Date | null) {
  if (!date) return false;
  
  console.log("task date", date);
  const localTime = dayjs(date).tz("Africa/Lagos");
  
  return localTime.format("HH:mm:ss") === "00:00:00";
}

function hasSignificantPriorityChange(task: TaskSelect, changes: Partial<TaskBody>) {
  const significantPriorityThreshold = 2;

  const priorityNotProvided = changes?.priority === undefined;
  const taskHasNoPriority = task.priority === null;

  const cannotComparePriority = priorityNotProvided || taskHasNoPriority;
  if (cannotComparePriority) {
    return false;
  }

  const priorityDifference = Math.abs(changes.priority! - task.priority);
  const isSignificantChange = priorityDifference >= significantPriorityThreshold;

  return isSignificantChange;
}

function hasSignificantDurationChange(task: TaskSelect, changes: Partial<TaskBody>) {
  const significantDurationThresholdMinutes = 30;

  const changesHasNoDuration = changes?.estimatedDuration == null;
  const taskHasNoDuration = task.estimatedDuration == null;

  const cannotCompareDurations = changesHasNoDuration || taskHasNoDuration;
  if (cannotCompareDurations) {
    return false;
  }

  const durationDifferenceInMinutes = Math.abs(changes.estimatedDuration! - task.estimatedDuration!);
  const isSignificantChange = durationDifferenceInMinutes >= significantDurationThresholdMinutes;

  return isSignificantChange;
}

function calculateDeadlineBasedDate(endTime: Date) {
  const deadline = new Date(endTime);
  const today = new Date();
  const isDeadlineInFuture = deadline > today;

  if (isDeadlineInFuture) {
    return deadline;
  }

  return null;
}

function shouldUseTodaySlots(context: SchedulingContext) {
  return context.schedulingStrategy === "today" && context.todayEnergyForecast;
}

function shouldUseFutureSlots(context: SchedulingContext) {
  return context.schedulingStrategy === "future" && context.historicalPatterns;
}

/**
 * Generate energy forecast for today with fallback logic:
 * 1. Use actual energy data if available
 * 2. Fall back to historical patterns if no energy data
 * 3. Fall back to hardcoded defaults if no historical patterns
 */
function generateTodayEnergyForecast(context: SchedulingContext): EnergySelect[] {
  // First priority: Use actual energy data if available
  if (context.todayEnergyForecast && context.todayEnergyForecast.length > 0) {
    console.log('[generateTodayEnergyForecast] Using actual energy data for today');
    return context.todayEnergyForecast;
  }

  // Second priority: Use historical patterns to generate synthetic energy data
  if (context.historicalPatterns && context.historicalPatterns.length > 0) {
    console.log('[generateTodayEnergyForecast] No energy data for today, using historical patterns');
    return generateSyntheticEnergyFromPatterns(context.historicalPatterns);
  }

  // Third priority: Use hardcoded default patterns
  console.log('[generateTodayEnergyForecast] No energy data or historical patterns, using hardcoded defaults');
  return generateSyntheticEnergyFromDefaults();
}

/**
 * Generate synthetic energy data from historical patterns for today
 */
function generateSyntheticEnergyFromPatterns(patterns: HistoricalEnergyPattern[]): EnergySelect[] {
  const today = new Date();
  const syntheticEnergy: EnergySelect[] = [];

  patterns.forEach(pattern => {
    const energyDate = new Date(today);
    energyDate.setHours(pattern.hour, 0, 0, 0);

    syntheticEnergy.push({
      userId: 'synthetic',
      _id: `synthetic_${pattern.hour}`,
      date: energyDate.toISOString(),
      _creationTime: Date.now(),
      mood: 'indifferent',
      energyLevel: pattern.averageEnergy,
      energyStage: 'wind_down',
      hour: pattern.hour,
      hasManualCheckIn: false
    });
  });

  return syntheticEnergy;
}

/**
 * Generate synthetic energy data from hardcoded default patterns
 */
function generateSyntheticEnergyFromDefaults(): EnergySelect[] {
  const defaultPatterns = [
    { hour: 0, averageEnergy: 0.01 },   // Sleep
    { hour: 1, averageEnergy: 0.01 },   // Sleep
    { hour: 2, averageEnergy: 0.01 },   // Sleep
    { hour: 3, averageEnergy: 0.01 },   // Sleep
    { hour: 4, averageEnergy: 0.01 },   // Sleep
    { hour: 5, averageEnergy: 0.01 },   // Sleep
    { hour: 6, averageEnergy: 0.26 },   // Early morning
    { hour: 7, averageEnergy: 0.4 },    // Morning rise
    { hour: 8, averageEnergy: 0.6 },    // Morning peak
    { hour: 9, averageEnergy: 0.8 },    // Peak energy
    { hour: 10, averageEnergy: 0.85 },  // Peak continues
    { hour: 11, averageEnergy: 0.7 },   // Pre-lunch
    { hour: 12, averageEnergy: 0.5 },   // Midday dip
    { hour: 13, averageEnergy: 0.45 },  // Post-lunch dip
    { hour: 14, averageEnergy: 0.6 },   // Afternoon recovery
    { hour: 15, averageEnergy: 0.75 },  // Afternoon rebound
    { hour: 16, averageEnergy: 0.8 },   // Afternoon peak
    { hour: 17, averageEnergy: 0.7 },   // Late afternoon
    { hour: 18, averageEnergy: 0.6 },   // Early evening
    { hour: 19, averageEnergy: 0.5 },   // Evening
    { hour: 20, averageEnergy: 0.4 },   // Wind down
    { hour: 21, averageEnergy: 0.26 },  // Late evening
    { hour: 22, averageEnergy: 0.2 },   // Pre-sleep
    { hour: 23, averageEnergy: 0.01 },  // Sleep
  ];

  return generateSyntheticEnergyFromPatterns(defaultPatterns);
}

export function getAvailableSlotsForContext(
  context: SchedulingContext,
  taskDuration: number,
  energyRequirements: { min: number; max: number },
  deadline?: Date | null  
) {
  if (shouldUseTodaySlots(context)) {
    // Generate energy forecast for today with fallback logic
    const energyForecast = generateTodayEnergyForecast(context);
    const todaySlots = analyzeAvailableSlotsToday({
      schedule: context.schedule,
      energyForecast,
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
      historicalPatterns: context.historicalPatterns!,
    });
    return futureSlots;
  }

  return generateFlexibleMultiDaySlots(context, taskDuration, energyRequirements);
}

export function generateFlexibleMultiDaySlots(
  context: SchedulingContext,
  taskDuration: number,
  energyRequirements: { min: number; max: number },
): EnergySlot[] {
  if (!context.historicalPatterns) {
    return [];
  }

  const daysToGenerate = 7;
  const today = new Date();
  const allSlots: EnergySlot[] = [];

  for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
    const targetDate = addDays(today, dayOffset);

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

export function getEnergyRequirementsForTask(taskTag: TAG) {
  switch (taskTag) {
    case "deep":
      return { min: DEEP_WORK_MIN_ENERGY, max: DEEP_WORK_MAX_ENERGY };
    case "creative":
      return { min: CREATIVE_WORK_MIN_ENERGY, max: CREATIVE_WORK_MAX_ENERGY };
    case "admin":
      return { min: ADMIN_WORK_MIN_ENERGY, max: ADMIN_WORK_MAX_ENERGY };
    case "personal":
      return { min: PERSONAL_WORK_MIN_ENERGY, max: PERSONAL_WORK_MAX_ENERGY };
    default:
      return { min: DEFAULT_MIN_ENERGY, max: DEFAULT_MAX_ENERGY };
  }
}

export function extractTaskDuration(task: TaskSelect): number {
  const defaultTaskDurationMinutes = 60;
  return task.estimatedDuration ?? defaultTaskDurationMinutes;
}

export function analyzeAvailableSlotsToday(
  params: SlotAnalysisParams & { energyForecast: EnergySelect[] },
) {
  const bufferTimeMinutes = 15;

  const { schedule, energyForecast, taskDuration, energyRequirements } = params;
  const currentTime = new Date();
  const bufferedCurrentTime = addMinutes(currentTime, bufferTimeMinutes);

  return flow(
    (forecast: EnergySelect[]) => forecast.map(mapEnergyToSlot),

    (slots: EnergySlot[]) => slots.filter((slot) => {
      const slotIsFuture = slot.startTime >= bufferedCurrentTime;
      return slotIsFuture;
    }),

    processSlots(schedule, taskDuration, energyRequirements),
  )(energyForecast);
}

export function analyzeAvailableSlotsFuture(
  params: SlotAnalysisParams & {
    targetDate: Date;
    historicalPatterns: HistoricalEnergyPattern[];
  },
) {
  const { schedule, targetDate, taskDuration, energyRequirements, historicalPatterns } = params;
  const currentTime = new Date();

  return flow(
    (patterns: HistoricalEnergyPattern[]) =>
      patterns.filter(isHistoricalEnergyValid(energyRequirements)),
    (patterns: HistoricalEnergyPattern[]) =>
      patterns.map(mapPatternToSlot(targetDate)),

    (slots: EnergySlot[]) => slots.filter(slot => slot.startTime > currentTime),
    addConflictFlag(schedule, taskDuration),
    (slots: EnergySlot[]) => slots.filter((slot: EnergySlot) => !slot.hasConflict),
  )(historicalPatterns);
}

export function buildPromptContext(
  task: TaskSelect,
  context: SchedulingContext,
  availableSlots: EnergySlot[],
) {
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

function mapEnergyToSlot(energy: EnergySelect): EnergySlot {
  const startTime = new Date(energy.date);
  const endTime = addHours(startTime, energy.hour);

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

function processSlots(
  schedule: ScheduleItem[],
  duration: number,
  requirements: { min: number; max: number },
) {
  return flow(
    (slots: EnergySlot[]) => slots.filter(isEnergyValid(requirements)),
    addConflictFlag(schedule, duration),
    (slots: EnergySlot[]) => slots.filter((slot: EnergySlot) => !slot.hasConflict),
  );
}

function isHistoricalEnergyValid(requirements: { min: number; max: number }) {
  return (pattern: { averageEnergy: number }) => {
    const meetsMinimumEnergy = pattern.averageEnergy >= requirements.min;
    const meetsMaximumEnergy = pattern.averageEnergy <= requirements.max;
    const isWithinEnergyRange = meetsMinimumEnergy && meetsMaximumEnergy;
    return isWithinEnergyRange;
  };
}

function mapPatternToSlot(targetDate: Date) {
  console.log("targetDate", targetDate);
  return (pattern: HistoricalEnergyPattern): EnergySlot => {
    const slotDurationMinutes = 60;

    const slotStartTime = dayjs(targetDate)
    .tz('Africa/Lagos')           // Convert to user timezone
    .hour(pattern.hour)         // Set the hour in user timezone
    .minute(0)                  // Reset to start of hour
    .second(0)
    .millisecond(0)
    .utc()                      // Convert back to UTC
    .toDate();                  // Get JavaScript Date

  const slotEndTime = addMinutes(slotStartTime, slotDurationMinutes);
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

function addConflictFlag(schedule: ScheduleItem[], duration: number) {
  return (slots: EnergySlot[]) =>
    slots.map((slot: EnergySlot) => ({
      ...slot,
      hasConflict: hasScheduleConflict(schedule, duration)(slot),
    }));
}

export function analyzeCognitiveLoad(schedule: ScheduleItem[]) {
  const highCognitiveLoadThreshold = 2;
  const tasks = schedule.filter(item => item.type === "task") as unknown as TaskSelect[];
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

function buildTaskConstraints(task: TaskSelect) {
  const hasDeadline = !!task.endTime;
  const hasStartDateWithoutTime = task.startTime && isDateOnlyWithoutTime(task.startTime);

  return {
    hasDeadline,
    deadlineUrgency: getDeadlineUrgency(task),
    hasStartDateOnly: hasStartDateWithoutTime,
    mustScheduleInFuture:
      "CRITICAL: Never schedule tasks in the past or within 15 minutes of current time",
  };
}

function isEnergyValid(requirements: { min: number; max: number }) {
  return (item: { energyLevel: number }) => {
    const meetsMinimumEnergy = item.energyLevel >= requirements.min;
    const meetsMaximumEnergy = item.energyLevel <= requirements.max;
    const isWithinEnergyRange = meetsMinimumEnergy && meetsMaximumEnergy;
    return isWithinEnergyRange;
  };
}

function hasScheduleConflict(schedule: ScheduleItem[], duration: number) {
  // Buffer time in minutes to maintain before and after meetings
  const bufferMinutes = 10;

  return (slot: { startTime: Date }) =>
    schedule.some((item: ScheduleItem) => {
      const itemHasNoEndTime = !item.endTime;
      if (itemHasNoEndTime) {
        return false;
      }

      const slotEndTime = addMinutes(slot.startTime, duration);

      const normalizedItemStart = new Date(item.startTime);
      const normalizedItemEnd = new Date(item.endTime!);
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

export function countCognitiveTasks(recentTasks: TaskSelect[]) {
  const isDeepTask = (task: TaskSelect) => task.tag === "deep";
  const isCreativeTask = (task: TaskSelect) => task.tag === "creative";
  const isCognitiveTask = (task: TaskSelect) => isDeepTask(task) || isCreativeTask(task);

  return recentTasks.filter(isCognitiveTask);
}

function getDeadlineUrgency(task: TaskSelect): string {
  const hasNoDeadline = !task.endTime;
  if (hasNoDeadline) {
    return "none";
  }

  const oneDayFromNow = addDays(new Date(), 1);
  const deadlineIsWithin24Hours = new Date(task.endTime!) < oneDayFromNow;

  return deadlineIsWithin24Hours ? "urgent" : "normal";
}

export function getOptimalEnergyStagesForTask(taskTag: TAG) {
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
