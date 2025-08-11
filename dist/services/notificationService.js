"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = exports.NotificationSeverity = exports.NotificationType = void 0;
/**
 * Notification types that can be sent
 */
var NotificationType;
(function (NotificationType) {
    NotificationType["NO_OPTIMAL_TIME"] = "no_optimal_time";
    NotificationType["TASK_RESCHEDULED"] = "task_rescheduled";
    NotificationType["TASK_DEADLINE_APPROACHING"] = "task_deadline_approaching";
    NotificationType["TASK_DISPLACED"] = "task_displaced";
    NotificationType["LATE_WIND_DOWN_CONFLICT"] = "late_wind_down_conflict";
    NotificationType["TASK_CONFLICT"] = "task_conflict";
    NotificationType["EVENT_CONFLICT"] = "event_conflict";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
/**
 * Notification severity levels for UI styling
 */
var NotificationSeverity;
(function (NotificationSeverity) {
    NotificationSeverity["INFO"] = "info";
    NotificationSeverity["WARNING"] = "warning";
    NotificationSeverity["ERROR"] = "error";
    NotificationSeverity["SUCCESS"] = "success";
})(NotificationSeverity || (exports.NotificationSeverity = NotificationSeverity = {}));
/**
 * Service for handling notifications
 */
class NotificationService {
    /**
     * Send a notification
     * @param type The type of notification
     * @param userId The user ID to send notification to
     * @param data Any additional data to include
     * @returns A promise resolving to the notification message object
     */
    async sendNotification(type, userId, data = {}) {
        try {
            console.log(`[NotificationService] Sending notification of type ${type} to user ${userId}`);
            console.log('[NotificationService] Notification data:', data);
            // Create structured notification message
            const notification = this.createNotificationMessage(type, userId, data);
            console.log('[NotificationService] Created notification:', notification);
            // Here you would integrate with your actual notification system
            // e.g., save to database, send via WebSocket, push notifications, etc.
            return notification;
        }
        catch (error) {
            console.error('[NotificationService] Error sending notification:', error);
            throw error;
        }
    }
    /**
     * Create a structured notification message
     */
    createNotificationMessage(type, userId, data) {
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
    generateNotificationId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Format no optimal time notification message
     */
    formatNoOptimalTimeMessage(data) {
        const { taskTitle, reason } = data;
        if (reason) {
            return `Could not schedule "${taskTitle}": ${reason}`;
        }
        return `Could not find an optimal time to schedule "${taskTitle}". Please try adjusting the task priority, deadline, or manually schedule it.`;
    }
    /**
     * Format task rescheduled notification message
     */
    formatTaskRescheduledMessage(data) {
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
    formatTaskDisplacedMessage(data) {
        const { taskTitle, displacedBy, newTime } = data;
        const newTimeStr = newTime ? new Date(newTime.startTime).toLocaleString() : 'a later time';
        return `Task "${taskTitle}" has been displaced by higher priority task "${displacedBy}" and moved to ${newTimeStr}`;
    }
    /**
     * Format late wind-down conflict message
     */
    formatLateWindDownMessage(data) {
        const { taskTitle } = data;
        return `Task "${taskTitle}" cannot be scheduled during the late wind-down period (2 hours before bedtime). Only personal tasks with high priority and today's deadline can be scheduled during this time.`;
    }
    /**
     * Format deadline approaching message
     */
    formatDeadlineMessage(data) {
        const { taskTitle, deadline, hoursRemaining } = data;
        return `Task "${taskTitle}" deadline is approaching in ${hoursRemaining} hours (${new Date(deadline).toLocaleString()})`;
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
    /**
     * Notify when a task is displaced by a higher priority task
     */
    async notifyTaskDisplaced(displacedTask, displacingTask, newTime) {
        return this.sendNotification(NotificationType.TASK_DISPLACED, displacedTask.userId, {
            taskId: displacedTask._id || displacedTask.id,
            taskTitle: displacedTask.title,
            displacedBy: displacingTask.title,
            newTime
        });
    }
    /**
     * Notify when a task conflicts with late wind-down period
     */
    async notifyLateWindDownConflict(task) {
        return this.sendNotification(NotificationType.LATE_WIND_DOWN_CONFLICT, task.userId, {
            taskId: task._id || task.id,
            taskTitle: task.title
        });
    }
}
exports.NotificationService = NotificationService;
