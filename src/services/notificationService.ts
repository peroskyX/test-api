// src/services/notificationService.ts
import { ITask } from '../models';

/**
 * Notification types that can be sent
 */
export enum NotificationType {
  NO_OPTIMAL_TIME = 'no_optimal_time',
  TASK_RESCHEDULED = 'task_rescheduled',
  TASK_DEADLINE_APPROACHING = 'task_deadline_approaching',
  TASK_DISPLACED = 'task_displaced',
  LATE_WIND_DOWN_CONFLICT = 'late_wind_down_conflict'
}

/**
 * Service for handling notifications
 */
export class NotificationService {
  /**
   * Send a notification
   * @param type The type of notification
   * @param userId The user ID to send notification to
   * @param data Any additional data to include
   * @returns A promise resolving to true if notification was sent successfully
   */
  async sendNotification(
    type: NotificationType,
    userId: string,
    data: any = {}
  ): Promise<boolean> {
    try {
      console.log(`[NotificationService] Sending notification of type ${type} to user ${userId}`);
      console.log('[NotificationService] Notification data:', data);
      
      // In a real implementation, this would send to a notification service
      // For now, we'll just log and return success
      
      // Format notification message based on type
      let message = '';
      switch (type) {
        case NotificationType.NO_OPTIMAL_TIME:
          message = this.formatNoOptimalTimeMessage(data);
          break;
        case NotificationType.TASK_RESCHEDULED:
          message = this.formatTaskRescheduledMessage(data);
          break;
        case NotificationType.TASK_DISPLACED:
          message = this.formatTaskDisplacedMessage(data);
          break;
        case NotificationType.LATE_WIND_DOWN_CONFLICT:
          message = this.formatLateWindDownMessage(data);
          break;
        case NotificationType.TASK_DEADLINE_APPROACHING:
          message = this.formatDeadlineMessage(data);
          break;
        default:
          message = 'Task notification';
      }
      
      console.log('[NotificationService] Formatted message:', message);
      
      // Here you would integrate with your actual notification system
      // e.g., push notifications, email, in-app notifications, etc.
      
      return true;
    } catch (error) {
      console.error('[NotificationService] Error sending notification:', error);
      return false;
    }
  }
  
  /**
   * Format no optimal time notification message
   */
  private formatNoOptimalTimeMessage(data: any): string {
    const { taskTitle, reason } = data;
    if (reason) {
      return `Could not schedule "${taskTitle}": ${reason}`;
    }
    return `Could not find an optimal time to schedule "${taskTitle}". Please try adjusting the task priority, deadline, or manually schedule it.`;
  }
  
  /**
   * Format task rescheduled notification message
   */
  private formatTaskRescheduledMessage(data: any): string {
    const { taskTitle, oldTime, newTime, reason } = data;
    const oldTimeStr = oldTime?.startTime ? new Date(oldTime.startTime).toLocaleString() : 'previous time';
    const newTimeStr = newTime?.startTime ? new Date(newTime.startTime).toLocaleString() : 'new time';
    
    if (reason) {
      return `Task "${taskTitle}" has been rescheduled from ${oldTimeStr} to ${newTimeStr}. Reason: ${reason}`;
    }
    return `Task "${taskTitle}" has been rescheduled from ${oldTimeStr} to ${newTimeStr}`;
  }
  
  /**
   * Format task displaced notification message
   */
  private formatTaskDisplacedMessage(data: any): string {
    const { taskTitle, displacedBy, newTime } = data;
    const newTimeStr = newTime ? new Date(newTime.startTime).toLocaleString() : 'a later time';
    return `Task "${taskTitle}" has been displaced by higher priority task "${displacedBy}" and moved to ${newTimeStr}`;
  }
  
  /**
   * Format late wind-down conflict message
   */
  private formatLateWindDownMessage(data: any): string {
    const { taskTitle } = data;
    return `Task "${taskTitle}" cannot be scheduled during the late wind-down period (2 hours before bedtime). Only personal tasks with high priority and today's deadline can be scheduled during this time.`;
  }
  
  /**
   * Format deadline approaching message
   */
  private formatDeadlineMessage(data: any): string {
    const { taskTitle, deadline, hoursRemaining } = data;
    return `Task "${taskTitle}" deadline is approaching in ${hoursRemaining} hours (${new Date(deadline).toLocaleString()})`;
  }
  
  /**
   * Specifically handles the case when no optimal time is found for a task
   */
  async notifyNoOptimalTime(task: ITask): Promise<boolean> {
    return this.sendNotification(
      NotificationType.NO_OPTIMAL_TIME,
      task.userId,
      {
        taskId: task._id || task.id,
        taskTitle: task.title,
        tag: task.tag,
        priority: task.priority,
        deadline: task.endTime
      }
    );
  }
  
  /**
   * Notify when a task is displaced by a higher priority task
   */
  async notifyTaskDisplaced(
    displacedTask: ITask,
    displacingTask: ITask,
    newTime?: { startTime: Date; endTime: Date }
  ): Promise<boolean> {
    return this.sendNotification(
      NotificationType.TASK_DISPLACED,
      displacedTask.userId,
      {
        taskId: displacedTask._id || displacedTask.id,
        taskTitle: displacedTask.title,
        displacedBy: displacingTask.title,
        newTime
      }
    );
  }
  
  /**
   * Notify when a task conflicts with late wind-down period
   */
  async notifyLateWindDownConflict(task: ITask): Promise<boolean> {
    return this.sendNotification(
      NotificationType.LATE_WIND_DOWN_CONFLICT,
      task.userId,
      {
        taskId: task._id || task.id,
        taskTitle: task.title
      }
    );
  }
}