// src/routes/notificationRoutes.ts
import { Router } from 'express';
import { NotificationService, NotificationMessage, NotificationType, NotificationSeverity } from '../services/notificationService';
import { Task } from '../models';

const router = Router();
const notificationService = new NotificationService();

/**
 * GET /api/notifications/demo
 * Demo endpoint to show different notification types for frontend testing
 */
router.get('/demo', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'demo-user-123';
    
    // Create sample notifications for frontend testing
    const notifications: NotificationMessage[] = [];
    
    // 1. No Optimal Time Notification
    const noOptimalTimeNotification = await notificationService.sendNotification(
      NotificationType.NO_OPTIMAL_TIME,
      userId,
      {
        taskId: 'task-123',
        taskTitle: 'Complete Project Proposal',
        priority: 4,
        tag: 'work',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        reason: 'No available slots that match energy requirements'
      }
    );
    notifications.push(noOptimalTimeNotification);
    
    // 2. Task Rescheduled Notification
    const rescheduledNotification = await notificationService.sendNotification(
      NotificationType.TASK_RESCHEDULED,
      userId,
      {
        taskId: 'task-456',
        taskTitle: 'Team Meeting Preparation',
        oldTime: { 
          startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          endTime: new Date(Date.now() + 3 * 60 * 60 * 1000) // 3 hours from now
        },
        newTime: { 
          startTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          endTime: new Date(Date.now() + 5 * 60 * 60 * 1000) // 5 hours from now
        },
        reason: 'Conflicted with calendar event'
      }
    );
    notifications.push(rescheduledNotification);
    
    // 3. Task Displaced Notification
    const displacedNotification = await notificationService.sendNotification(
      NotificationType.TASK_DISPLACED,
      userId,
      {
        taskId: 'task-789',
        taskTitle: 'Review Documents',
        displacedBy: 'Urgent Client Call',
        newTime: { 
          startTime: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours from now
          endTime: new Date(Date.now() + 7 * 60 * 60 * 1000) // 7 hours from now
        }
      }
    );
    notifications.push(displacedNotification);
    
    // 4. Late Wind-Down Conflict Notification
    const windDownNotification = await notificationService.sendNotification(
      NotificationType.LATE_WIND_DOWN_CONFLICT,
      userId,
      {
        taskId: 'task-101',
        taskTitle: 'Workout Session'
      }
    );
    notifications.push(windDownNotification);
    
    // 5. Deadline Approaching Notification
    const deadlineNotification = await notificationService.sendNotification(
      NotificationType.TASK_DEADLINE_APPROACHING,
      userId,
      {
        taskId: 'task-202',
        taskTitle: 'Submit Tax Documents',
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        hoursRemaining: 4
      }
    );
    notifications.push(deadlineNotification);
    
    res.json({
      success: true,
      message: 'Demo notifications generated',
      notifications,
      frontendUsage: {
        description: 'These notifications can be displayed in dialogs/modals on the frontend',
        structure: {
          id: 'Unique notification ID',
          type: 'Notification type enum',
          severity: 'UI styling level (info, warning, error, success)',
          title: 'Dialog title',
          message: 'Main notification message',
          timestamp: 'When notification was created',
          actions: 'Array of action buttons with labels, actions, and variants',
          metadata: 'Additional data for the notification'
        },
        exampleDialog: {
          title: 'notification.title',
          message: 'notification.message',
          severity: 'notification.severity (for styling)',
          buttons: 'notification.actions (map to dialog buttons)',
          onAction: 'Handle notification.actions[].action with notification.actions[].data'
        }
      }
    });
    
  } catch (error) {
    console.error('[NotificationRoutes] Error generating demo notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate demo notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/notifications/action
 * Handle notification actions from frontend
 */
router.post('/action', async (req, res) => {
  try {
    const { notificationId, action, data } = req.body;
    
    console.log('[NotificationRoutes] Handling notification action:', {
      notificationId,
      action,
      data
    });
    
    // Handle different notification actions
    switch (action) {
      case 'manual_schedule':
        // Redirect to manual scheduling interface
        res.json({
          success: true,
          action: 'redirect',
          url: `/tasks/${data.taskId}/schedule`,
          message: 'Redirecting to manual scheduling'
        });
        break;
        
      case 'adjust_priority':
        // Open priority adjustment dialog
        res.json({
          success: true,
          action: 'open_dialog',
          dialog: 'priority_adjustment',
          data: { taskId: data.taskId },
          message: 'Opening priority adjustment dialog'
        });
        break;
        
      case 'view_task':
        // Redirect to task details
        res.json({
          success: true,
          action: 'redirect',
          url: `/tasks/${data.taskId}`,
          message: 'Redirecting to task details'
        });
        break;
        
      case 'undo_reschedule':
        // Attempt to undo the rescheduling
        res.json({
          success: true,
          action: 'api_call',
          endpoint: `/tasks/${data.taskId}/reschedule`,
          method: 'POST',
          payload: { time: data.oldTime },
          message: 'Attempting to restore original schedule'
        });
        break;
        
      case 'reschedule_task':
        // Open rescheduling interface
        res.json({
          success: true,
          action: 'open_dialog',
          dialog: 'reschedule',
          data: { taskId: data.taskId },
          message: 'Opening rescheduling dialog'
        });
        break;
        
      case 'reschedule_earlier':
        // Try to reschedule to an earlier time
        res.json({
          success: true,
          action: 'api_call',
          endpoint: `/tasks/${data.taskId}/reschedule-earlier`,
          method: 'POST',
          message: 'Attempting to reschedule to earlier time'
        });
        break;
        
      case 'manual_override':
        // Allow manual override of scheduling rules
        res.json({
          success: true,
          action: 'confirm_dialog',
          title: 'Override Sleep Schedule?',
          message: 'This will schedule the task during your wind-down period. Are you sure?',
          confirmAction: 'force_schedule',
          data: { taskId: data.taskId },
          warning: true
        });
        break;
        
      case 'start_task':
        // Mark task as started
        res.json({
          success: true,
          action: 'api_call',
          endpoint: `/tasks/${data.taskId}/start`,
          method: 'POST',
          message: 'Starting task now'
        });
        break;
        
      case 'extend_deadline':
        // Open deadline extension dialog
        res.json({
          success: true,
          action: 'open_dialog',
          dialog: 'extend_deadline',
          data: { taskId: data.taskId },
          message: 'Opening deadline extension dialog'
        });
        break;
        
      case 'dismiss':
        // Simply dismiss the notification
        res.json({
          success: true,
          action: 'dismiss',
          message: 'Notification dismissed'
        });
        break;
        
      default:
        res.status(400).json({
          success: false,
          message: `Unknown action: ${action}`
        });
    }
    
  } catch (error) {
    console.error('[NotificationRoutes] Error handling notification action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to handle notification action',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/notifications/user/:userId
 * Get all notifications for a user (in a real app, this would fetch from database)
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In a real implementation, you would fetch notifications from database
    // For demo purposes, return empty array
    res.json({
      success: true,
      notifications: [],
      message: 'In a real implementation, this would fetch user notifications from database'
    });
    
  } catch (error) {
    console.error('[NotificationRoutes] Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
