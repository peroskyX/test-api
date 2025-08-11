// src/services/conflictDetectionService.ts
import { addMinutes, isBefore, isAfter } from 'date-fns';
import { Task, ScheduleItem, ITask, IScheduleItem } from '../models';

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingItems: Array<{
    id: string;
    title: string;
    type: 'task' | 'event';
    isAutoSchedule?: boolean;
    startTime: Date;
    endTime: Date;
  }>;
  conflictType?: 'auto-task' | 'manual-task' | 'event' | 'multiple';
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export class ConflictDetectionService {
  private readonly EVENT_BUFFER_MINUTES = 10;
  
  /**
   * Check if a proposed time slot conflicts with existing schedule items
   */
  async checkForConflicts(
    userId: string,
    proposedSlot: TimeSlot,
    excludeTaskId?: string
  ): Promise<ConflictCheckResult> {
    const conflictingItems: ConflictCheckResult['conflictingItems'] = [];
    
    // Check for task conflicts
    const taskConflicts = await this.findConflictingTasks(
      userId,
      proposedSlot,
      excludeTaskId
    );
    
    // Check for event conflicts (with buffer)
    const eventConflicts = await this.findConflictingEvents(
      userId,
      proposedSlot
    );
    
    conflictingItems.push(...taskConflicts, ...eventConflicts);
    
    // Determine conflict type
    let conflictType: ConflictCheckResult['conflictType'] | undefined;
    if (conflictingItems.length > 0) {
      const hasAutoTask = conflictingItems.some(item => 
        item.type === 'task' && item.isAutoSchedule
      );
      const hasManualTask = conflictingItems.some(item => 
        item.type === 'task' && !item.isAutoSchedule
      );
      const hasEvent = conflictingItems.some(item => item.type === 'event');
      
      if (conflictingItems.length > 1) {
        conflictType = 'multiple';
      } else if (hasAutoTask) {
        conflictType = 'auto-task';
      } else if (hasManualTask) {
        conflictType = 'manual-task';
      } else if (hasEvent) {
        conflictType = 'event';
      }
    }
    
    return {
      hasConflict: conflictingItems.length > 0,
      conflictingItems,
      conflictType
    };
  }
  
  /**
   * Find tasks that conflict with the proposed time slot
   */
  private async findConflictingTasks(
    userId: string,
    proposedSlot: TimeSlot,
    excludeTaskId?: string
  ): Promise<ConflictCheckResult['conflictingItems']> {
    const query: any = {
      userId,
      status: 'pending',
      startTime: { $lt: proposedSlot.endTime },
      endTime: { $gt: proposedSlot.startTime }
    };
    
    if (excludeTaskId) {
      query._id = { $ne: excludeTaskId };
    }
    
    const conflictingTasks = await Task.find(query);
    
    return conflictingTasks.map(task => ({
      id: task._id.toString(),
      title: task.title,
      type: 'task' as const,
      isAutoSchedule: task.isAutoSchedule,
      startTime: task.startTime!,
      endTime: task.endTime!
    }));
  }
  
  /**
   * Find events that conflict with the proposed time slot (including buffer)
   */
  private async findConflictingEvents(
    userId: string,
    proposedSlot: TimeSlot
  ): Promise<ConflictCheckResult['conflictingItems']> {
    // Apply buffer to the proposed slot for event checking
    const bufferedStart = addMinutes(proposedSlot.startTime, -this.EVENT_BUFFER_MINUTES);
    const bufferedEnd = addMinutes(proposedSlot.endTime, this.EVENT_BUFFER_MINUTES);
    
    const conflictingEvents = await ScheduleItem.find({
      userId,
      type: 'event',
      startTime: { $lt: bufferedEnd },
      endTime: { $gt: bufferedStart }
    });
    
    return conflictingEvents.map(event => ({
      id: event._id.toString(),
      title: event.title,
      type: 'event' as const,
      startTime: event.startTime,
      endTime: event.endTime
    }));
  }
  
  /**
   * Check if a specific time slot is available (no conflicts)
   */
  async isTimeSlotAvailable(
    userId: string,
    slot: TimeSlot,
    excludeTaskId?: string
  ): Promise<boolean> {
    const result = await this.checkForConflicts(userId, slot, excludeTaskId);
    return !result.hasConflict;
  }
  
  /**
   * Find all conflicting items for rescheduling purposes
   */
  async findItemsToReschedule(
    userId: string,
    slot: TimeSlot,
    excludeTaskId?: string
  ): Promise<ITask[]> {
    const conflictResult = await this.checkForConflicts(userId, slot, excludeTaskId);
    
    // Only return auto-scheduled tasks that can be rescheduled
    const autoTaskIds = conflictResult.conflictingItems
      .filter(item => item.type === 'task' && item.isAutoSchedule)
      .map(item => item.id);
    
    if (autoTaskIds.length === 0) {
      return [];
    }
    
    return Task.find({
      _id: { $in: autoTaskIds },
      status: 'pending'
    });
  }
  
  /**
   * Check if proposed time violates event buffer requirements
   */
  checkEventBufferViolation(
    proposedSlot: TimeSlot,
    eventSlot: TimeSlot
  ): boolean {
    const eventStartWithBuffer = addMinutes(eventSlot.startTime, -this.EVENT_BUFFER_MINUTES);
    const eventEndWithBuffer = addMinutes(eventSlot.endTime, this.EVENT_BUFFER_MINUTES);
    
    // Check if proposed slot overlaps with buffered event time
    const overlaps = proposedSlot.startTime < eventEndWithBuffer && 
     proposedSlot.endTime > eventStartWithBuffer;
    
    return overlaps;
  }
}