// src/services/smartSchedulingService.ts - FIXED VERSION
import { addDays, startOfDay, setHours, setMinutes, addMinutes } from 'date-fns';
import { Task, Energy, ScheduleItem, HistoricalEnergyPattern, ITask, IEnergy, IScheduleItem, IHistoricalEnergyPattern } from '../models';
import * as SmartScheduling from '../smart';
import { TAG, TaskSelect, EnergySelect, ScheduleItem as SmartScheduleItem, SchedulingContext, TaskBody } from '../smart';

export class SmartSchedulingService {
  /**
   * Create a new task with smart scheduling
   */
  async createTaskWithSmartScheduling(taskData: Partial<ITask>): Promise<ITask> {
    console.log('[SmartSchedulingService] Creating task with data:', {
      title: taskData.title,
      startTime: taskData.startTime,
      isAutoSchedule: taskData.isAutoSchedule,
      tag: taskData.tag
    });

    const task = new Task(taskData);
    
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
      } else {
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
  async findOptimalTimeForTask(
    task: TaskSelect,
    userId: string
  ): Promise<{ startTime: Date; endTime: Date } | null> {
    try {
      const context = await this.buildSchedulingContext(task, userId);
      console.log('[findOptimalTimeForTask] Built context:', {
        schedulingStrategy: context.schedulingStrategy,
        targetDate: context.targetDate,
        hasEnergyForecast: !!context.todayEnergyForecast,
        energyForecastLength: context.todayEnergyForecast?.length || 0,
        historicalPatternsLength: context.historicalPatterns?.length || 0
      });
      
      const energyRequirements = SmartScheduling.getEnergyRequirementsForTask(task.tag);
      const taskDuration = SmartScheduling.extractTaskDuration(task);
      
      console.log('[findOptimalTimeForTask] Task requirements:', {
        tag: task.tag,
        duration: taskDuration,
        energyRequirements
      });
      
      const availableSlots = SmartScheduling.getAvailableSlotsForContext(
        context,
        taskDuration,
        energyRequirements
      );
      
      console.log('[findOptimalTimeForTask] Available slots:', availableSlots.length);
      if (availableSlots.length > 0) {
        console.log('[findOptimalTimeForTask] First few slots:', availableSlots.slice(0, 3).map(s => ({
          time: s.startTime,
          energy: s.energyLevel
        })));
      }
      
      if (availableSlots.length === 0) {
        console.log('[findOptimalTimeForTask] No available slots found');
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
      const endTime = addMinutes(startTime, taskDuration);
      
      console.log('[findOptimalTimeForTask] Selected best slot:', {
        startTime,
        endTime,
        energyLevel: bestSlot.energyLevel
      });
      
      return { startTime, endTime };
    } catch (error) {
      console.error('[findOptimalTimeForTask] Error:', error);
      return null;
    }
  }

  /**
   * Build scheduling context for smart scheduling
   */
  private async buildSchedulingContext(task: TaskSelect, userId: string): Promise<SchedulingContext> {
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
    
    let todayEnergyForecast: EnergySelect[] | undefined;
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
        await HistoricalEnergyPattern.create({
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
  private async getScheduleItems(userId: string, targetDate: Date | null): Promise<SmartScheduleItem[]> {
    const query: any = { userId };
    
    if (targetDate) {
      // Get items for the specific day and a few days around it
      const startOfTargetDay = startOfDay(targetDate);
      const endOfSearchWindow = addDays(startOfTargetDay, 7); // Look ahead 7 days
      query.startTime = { $gte: startOfTargetDay, $lt: endOfSearchWindow };
    } else {
      // Get upcoming items
      const now = new Date();
      const futureLimit = addDays(now, 30);
      query.startTime = { $gte: now, $lt: futureLimit };
    }
    
    const items = await ScheduleItem.find(query).sort({ startTime: 1 });
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
  private async getTodayEnergyForecast(userId: string): Promise<EnergySelect[]> {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    
    const energyData = await Energy.find({
      userId,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ hour: 1 });
    
    console.log('[getTodayEnergyForecast] Found energy data for today:', energyData.length);
    
    return energyData.map(e => this.convertToEnergySelect(e));
  }

  /**
   * Get historical energy patterns
   */
  private async getHistoricalPatterns(userId: string): Promise<SmartScheduling.HistoricalEnergyPattern[]> {
    const patterns = await HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
    return patterns.map(p => ({
      hour: p.hour,
      averageEnergy: p.averageEnergy
    }));
  }

  /**
   * Convert ITask to TaskSelect format
   */
  private convertToTaskSelect(task: ITask): TaskSelect {
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
      tag: task.tag as TAG,
      status: task.status
    } as TaskSelect;
  }

  /**
   * Convert IEnergy to EnergySelect format
   */
  private convertToEnergySelect(energy: IEnergy): EnergySelect {
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
  async updateHistoricalPatterns(userId: string): Promise<void> {
    const energyData = await Energy.find({ userId });
    
    if (energyData.length === 0) {
      console.log('[updateHistoricalPatterns] No energy data to process');
      return;
    }
    
    // Group by hour and calculate averages
    const hourlyData = new Map<number, number[]>();
    
    energyData.forEach(entry => {
      const hour = entry.hour;
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(entry.energyLevel);
    });
    
    // Update patterns
    for (const [hour, levels] of hourlyData.entries()) {
      const averageEnergy = levels.reduce((sum, level) => sum + level, 0) / levels.length;
      
      await HistoricalEnergyPattern.findOneAndUpdate(
        { userId, hour },
        {
          averageEnergy,
          sampleCount: levels.length,
          lastUpdated: new Date()
        },
        { upsert: true }
      );
    }
    
    console.log(`[updateHistoricalPatterns] Updated ${hourlyData.size} hourly patterns for user ${userId}`);
  }

  /**
   * Get energy history for a user
   */
  private async getEnergyHistory(userId: string): Promise<EnergySelect[]> {
    const energyData = await Energy.find({ userId })
      .sort({ date: -1 })
      .limit(100);
    return energyData.map(e => this.convertToEnergySelect(e));
  }

  /**
   * Add task to schedule
   */
  private async addTaskToSchedule(task: ITask): Promise<void> {
    if (!task.startTime || !task.endTime) return;
    
    await ScheduleItem.create({
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
  async updateTaskWithRescheduling(taskId: string, updates: Partial<TaskBody>): Promise<ITask | null> {
    const task = await Task.findById(taskId);
    if (!task) return null;
    
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
        await ScheduleItem.findOneAndUpdate(
          { taskId: task.id, userId: task.userId },
          {
            startTime: task.startTime,
            endTime: task.endTime,
            title: task.title
          }
        );
      }
    }
    
    await task.save();
    return task;
  }

  /**
   * Reschedule tasks when a new calendar event is added
   */
  async rescheduleTasksForNewEvent(event: IScheduleItem): Promise<void> {
    // Find tasks that conflict with the new event
    const conflictingTasks = await Task.find({
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
        await ScheduleItem.findOneAndUpdate(
          { taskId: task.id },
          {
            startTime: task.startTime,
            endTime: task.endTime
          }
        );
      }
    }
  }

  /**
   * Get default energy patterns (fallback when no user data)
   */
  getDefaultEnergyPatterns(): SmartScheduling.HistoricalEnergyPattern[] {
    return [
      { hour: 6, averageEnergy: 0.3 },   // Early morning
      { hour: 7, averageEnergy: 0.5 },   // Morning rise
      { hour: 8, averageEnergy: 0.7 },   // Morning
      { hour: 9, averageEnergy: 0.85 },  // Morning peak
      { hour: 10, averageEnergy: 0.9 },  // Morning peak
      { hour: 11, averageEnergy: 0.85 }, // Late morning
      { hour: 12, averageEnergy: 0.7 },  // Lunch
      { hour: 13, averageEnergy: 0.5 },  // Post-lunch dip
      { hour: 14, averageEnergy: 0.6 },  // Afternoon recovery
      { hour: 15, averageEnergy: 0.75 }, // Afternoon rebound
      { hour: 16, averageEnergy: 0.8 },  // Afternoon peak
      { hour: 17, averageEnergy: 0.7 },  // Late afternoon
      { hour: 18, averageEnergy: 0.6 },  // Early evening
      { hour: 19, averageEnergy: 0.5 },  // Evening
      { hour: 20, averageEnergy: 0.4 },  // Wind down
      { hour: 21, averageEnergy: 0.3 },  // Late evening
      { hour: 22, averageEnergy: 0.2 },  // Pre-sleep
    ];
  }
}