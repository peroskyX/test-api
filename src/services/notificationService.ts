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
  LATE_WIND_DOWN_CONFLICT = 'late_wind_down_conflict',
  TASK_CONFLICT = 'task_conflict',
  EVENT_CONFLICT = 'event_conflict'
}

/**
 * Notification severity levels for UI styling
 */
export enum NotificationSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success'
}

/**
 * Action button for notifications
 */
export interface NotificationAction {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
  data?: any;
}

/**
 * Structured notification object for frontend consumption
 */
export interface NotificationMessage {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: Date;
  userId: string;
  taskId?: string;
  actions?: NotificationAction[];
  metadata?: {
    taskTitle?: string;
    oldTime?: { startTime: Date; endTime: Date };
    newTime?: { startTime: Date; endTime: Date };
    deadline?: Date;
    priority?: number;
    tag?: string;
    reason?: string;
    displacedBy?: string;
    hoursRemaining?: number;
    conflictingTaskTitle?: string;
    conflictingStartTime?: Date;
    conflictingEndTime?: Date;
    eventTitle?: string;
    eventStartTime?: Date;
    eventEndTime?: Date;
  };
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
   * @returns A promise resolving to the notification message object
   */
  async sendNotification(
    type: NotificationType,
    userId: string,
    data: any = {}
  ): Promise<NotificationMessage> {
    try {
      console.log(`[NotificationService] Sending notification of type ${type} to user ${userId}`);
      console.log('[NotificationService] Notification data:', data);
      
      // Create structured notification message
      const notification = this.createNotificationMessage(type, userId, data);
      
      console.log('[NotificationService] Created notification:', notification);
      
      // Here you would integrate with your actual notification system
      // e.g., save to database, send via WebSocket, push notifications, etc.
      
      return notification;
    } catch (error) {
      console.error('[NotificationService] Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Create a structured notification message
   */
  private createNotificationMessage(
    type: NotificationType,
    userId: string,
    data: any
  ): NotificationMessage {
    const id = this.generateNotificationId();
    const timestamp = new Date();

    switch (type) {
      case NotificationType.NO_OPTIMAL_TIME:
        return {
          id,
          type,
          severity: NotificationSeverity.WARNING,
          title: 'Scheduling Conflict',
          message: this.formatNoOptimalTimeMessage(data),
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'Manual Schedule',
              action: 'manual_schedule',
              variant: 'primary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Adjust Priority',
              action: 'adjust_priority',
              variant: 'secondary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            priority: data.priority,
            tag: data.tag,
            deadline: data.deadline,
            reason: data.reason
          }
        };

      case NotificationType.TASK_RESCHEDULED:
        return {
          id,
          type,
          severity: NotificationSeverity.INFO,
          title: 'Task Rescheduled',
          message: this.formatTaskRescheduledMessage(data),
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'View Task',
              action: 'view_task',
              variant: 'primary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Undo',
              action: 'undo_reschedule',
              variant: 'secondary',
              data: { taskId: data.taskId, oldTime: data.oldTime }
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            oldTime: data.oldTime,
            newTime: data.newTime,
            reason: data.reason
          }
        };

      case NotificationType.TASK_CONFLICT:
        return {
          id,
          type,
          severity: NotificationSeverity.WARNING,
          title: 'Conflict With Manually Scheduled Task',
          message: `Your update conflicts with manually scheduled task "${data.conflictingTaskTitle}" from ${new Date(data.conflictingStartTime).toLocaleString()} to ${new Date(data.conflictingEndTime).toLocaleString()}.`,
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            { label: 'Adjust Time', action: 'adjust_time', variant: 'primary', data: { taskId: data.taskId } },
            { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            reason: 'Conflict with manually scheduled task'
          }
        };

      case NotificationType.EVENT_CONFLICT:
        return {
          id,
          type,
          severity: NotificationSeverity.WARNING,
          title: 'Conflict With Event',
          message: `Your update conflicts with event "${data.eventTitle}" from ${new Date(data.eventStartTime).toLocaleString()} to ${new Date(data.eventEndTime).toLocaleString()}.`,
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            { label: 'Adjust Time', action: 'adjust_time', variant: 'primary', data: { taskId: data.taskId } },
            { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            reason: 'Conflict with event'
          }
        };

      case NotificationType.TASK_DISPLACED:
        return {
          id,
          type,
          severity: NotificationSeverity.WARNING,
          title: 'Task Displaced',
          message: this.formatTaskDisplacedMessage(data),
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'View New Time',
              action: 'view_task',
              variant: 'primary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Find Alternative',
              action: 'reschedule_task',
              variant: 'secondary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            displacedBy: data.displacedBy,
            newTime: data.newTime
          }
        };

      case NotificationType.LATE_WIND_DOWN_CONFLICT:
        return {
          id,
          type,
          severity: NotificationSeverity.ERROR,
          title: 'Sleep Schedule Conflict',
          message: this.formatLateWindDownMessage(data),
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'Schedule Earlier',
              action: 'reschedule_earlier',
              variant: 'primary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Manual Override',
              action: 'manual_override',
              variant: 'danger',
              data: { taskId: data.taskId }
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ],
          metadata: {
            taskTitle: data.taskTitle
          }
        };

      case NotificationType.TASK_DEADLINE_APPROACHING:
        return {
          id,
          type,
          severity: NotificationSeverity.WARNING,
          title: 'Deadline Approaching',
          message: this.formatDeadlineMessage(data),
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'Start Now',
              action: 'start_task',
              variant: 'primary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Extend Deadline',
              action: 'extend_deadline',
              variant: 'secondary',
              data: { taskId: data.taskId }
            },
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ],
          metadata: {
            taskTitle: data.taskTitle,
            deadline: data.deadline,
            hoursRemaining: data.hoursRemaining
          }
        };

      default:
        return {
          id,
          type,
          severity: NotificationSeverity.INFO,
          title: 'Task Notification',
          message: 'Task notification',
          timestamp,
          userId,
          taskId: data.taskId,
          actions: [
            {
              label: 'Dismiss',
              action: 'dismiss',
              variant: 'secondary'
            }
          ]
        };
    }
  }

  /**
   * Generate a unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  async notifyNoOptimalTime(task: ITask): Promise<NotificationMessage> {
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
  ): Promise<NotificationMessage> {
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
  async notifyLateWindDownConflict(task: ITask): Promise<NotificationMessage> {
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