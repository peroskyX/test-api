// src/services/notificationService.ts
import { ITask } from '../models';

/**
 * Notification types that can be sent
 */
export enum NotificationType {
  NO_OPTIMAL_TIME = 'no_optimal_time',
  TASK_RESCHEDULED = 'task_rescheduled',
  TASK_DEADLINE_APPROACHING = 'task_deadline_approaching'
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
      
      return true;
    } catch (error) {
      console.error('[NotificationService] Error sending notification:', error);
      return false;
    }
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
}
