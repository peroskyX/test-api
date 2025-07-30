"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.NotificationType = void 0;
/**
 * Notification types that can be sent
 */
var NotificationType;
(function (NotificationType) {
    NotificationType["NO_OPTIMAL_TIME"] = "no_optimal_time";
    NotificationType["TASK_RESCHEDULED"] = "task_rescheduled";
    NotificationType["TASK_DEADLINE_APPROACHING"] = "task_deadline_approaching";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
/**
 * Service for handling notifications
 */
class NotificationService {
    /**
     * Send a notification
     * @param type The type of notification
     * @param userId The user ID to send notification to
     * @param data Any additional data to include
     * @returns A promise resolving to true if notification was sent successfully
     */
    async sendNotification(type, userId, data = {}) {
        try {
            console.log(`[NotificationService] Sending notification of type ${type} to user ${userId}`);
            console.log('[NotificationService] Notification data:', data);
            return true;
        }
        catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
            return false;
        }
    }
    /**
     * Specifically handles the case when no optimal time is found for a task
     */
    async notifyNoOptimalTime(task) {
        return this.sendNotification(NotificationType.NO_OPTIMAL_TIME, task.userId, {
            taskId: task._id || task.id,
            taskTitle: task.title,
            tag: task.tag,
            priority: task.priority,
            deadline: task.endTime
        });
    }
}
exports.NotificationService = NotificationService;
