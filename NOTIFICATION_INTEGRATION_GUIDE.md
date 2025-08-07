# AI Agent Task: Integrate Backend Notification System with Frontend

## Context
I have a task scheduling app with a backend notification system that needs to be integrated into the existing frontend. The backend returns structured notification objects that should be displayed as dialogs/modals to users.

## Backend API Structure

### Notification Object Format
```typescript
interface NotificationMessage {
  id: string;
  type: 'no_optimal_time' | 'task_rescheduled' | 'task_displaced' | 'late_wind_down_conflict' | 'task_deadline_approaching';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  userId: string;
  taskId?: string;
  actions?: Array<{
    label: string;
    action: string;
    variant: 'primary' | 'secondary' | 'danger';
    data?: any;
  }>;
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
  };
}
```

### Available API Endpoints
- `GET /api/notifications/demo?userId=<userId>` - Get sample notifications for testing
- `POST /api/notifications/action` - Handle notification button actions
- `GET /api/notifications/user/<userId>` - Get user notifications (placeholder)

### Example API Response
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notif_1733508000_abc123def",
      "type": "no_optimal_time",
      "severity": "warning",
      "title": "Scheduling Conflict",
      "message": "Could not schedule 'Complete Project Proposal': No available slots that match energy requirements",
      "timestamp": "2025-08-06T18:32:29.000Z",
      "userId": "user123",
      "taskId": "task-123",
      "actions": [
        {
          "label": "Manual Schedule",
          "action": "manual_schedule",
          "variant": "primary",
          "data": { "taskId": "task-123" }
        },
        {
          "label": "Adjust Priority",
          "action": "adjust_priority",
          "variant": "secondary",
          "data": { "taskId": "task-123" }
        },
        {
          "label": "Dismiss",
          "action": "dismiss",
          "variant": "secondary"
        }
      ],
      "metadata": {
        "taskTitle": "Complete Project Proposal",
        "priority": 4,
        "tag": "work",
        "deadline": "2025-08-07T18:32:29.000Z",
        "reason": "No available slots that match energy requirements"
      }
    }
  ]
}
```

## Requirements

### 1. Create a Notification Dialog Component
The component should:
- Display notification title, message, and timestamp
- Style based on severity level:
  - **info**: Blue theme, informational icon
  - **warning**: Yellow/orange theme, warning icon  
  - **error**: Red theme, error icon
  - **success**: Green theme, success icon
- Render action buttons with appropriate styling:
  - **primary**: Prominent button (usually the main action)
  - **secondary**: Subtle button (alternative actions)
  - **danger**: Red button (destructive actions)
- Handle button clicks by calling the action handler
- Be responsive and mobile-friendly
- Follow accessibility best practices

### 2. Implement Notification Action Handler
The handler should:
- Send POST requests to `/api/notifications/action` with:
  ```json
  {
    "notificationId": "notif_1733508000_abc123def",
    "action": "manual_schedule",
    "data": { "taskId": "task-123" }
  }
  ```
- Handle different response types from the backend:
  - **redirect**: Navigate to specified URL
  - **open_dialog**: Open specific dialog/modal
  - **api_call**: Make additional API calls
  - **confirm_dialog**: Show confirmation dialog
  - **dismiss**: Simply close the notification
- Execute appropriate frontend actions based on backend response
- Handle errors gracefully

### 3. Add Notification Trigger Integration
Integration should:
- Show notifications when tasks are created/scheduled
- Listen for scheduling responses from task creation APIs
- Display notifications immediately when they're received
- Queue multiple notifications if needed
- Prevent notification spam (debounce if necessary)

### 4. Create a Test/Demo Page
The demo page should:
- Fetch demo notifications from `/api/notifications/demo`
- Display each notification type in dialogs
- Allow testing of all action buttons
- Demonstrate the complete notification flow
- Show different severity levels and styling

## Example Implementation Flow

### Fetching and Displaying Notifications
```javascript
// 1. Fetch demo notifications
async function fetchDemoNotifications(userId) {
  try {
    const response = await fetch(`/api/notifications/demo?userId=${userId}`);
    const { notifications } = await response.json();
    
    // Display each notification
    notifications.forEach(notification => {
      showNotificationDialog(notification);
    });
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
  }
}

// 2. Show notification dialog
function showNotificationDialog(notification) {
  const dialog = {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    severity: notification.severity,
    timestamp: notification.timestamp,
    buttons: notification.actions?.map(action => ({
      label: action.label,
      variant: action.variant,
      onClick: () => handleNotificationAction(notification.id, action)
    })) || []
  };
  
  // Use your existing modal/dialog system
  openDialog(dialog);
}
```

### Handling Notification Actions
```javascript
async function handleNotificationAction(notificationId, action) {
  try {
    const response = await fetch('/api/notifications/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId,
        action: action.action,
        data: action.data
      })
    });
    
    const result = await response.json();
    
    // Handle different response types
    switch (result.action) {
      case 'redirect':
        window.location.href = result.url;
        break;
        
      case 'open_dialog':
        openSpecificDialog(result.dialog, result.data);
        break;
        
      case 'api_call':
        await makeApiCall(result.endpoint, result.method, result.payload);
        break;
        
      case 'confirm_dialog':
        showConfirmDialog(result.title, result.message, result.confirmAction, result.data);
        break;
        
      case 'dismiss':
        closeNotificationDialog(notificationId);
        break;
        
      default:
        console.warn('Unknown action type:', result.action);
    }
  } catch (error) {
    console.error('Failed to handle notification action:', error);
  }
}
```

### Integration with Task Scheduling
```javascript
// Example: Integrate with task creation
async function createTask(taskData) {
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskData)
    });
    
    const result = await response.json();
    
    // Check if there are any notifications in the response
    if (result.notification) {
      showNotificationDialog(result.notification);
    }
    
    return result;
  } catch (error) {
    console.error('Failed to create task:', error);
  }
}
```

## Notification Types and Expected Actions

### 1. No Optimal Time (`no_optimal_time`)
- **Severity**: Warning
- **Actions**: Manual Schedule, Adjust Priority, Dismiss
- **Use Case**: When smart scheduling can't find a suitable time slot

### 2. Task Rescheduled (`task_rescheduled`)
- **Severity**: Info
- **Actions**: View Task, Undo, Dismiss
- **Use Case**: When a task is automatically moved to a different time

### 3. Task Displaced (`task_displaced`)
- **Severity**: Warning
- **Actions**: View New Time, Find Alternative, Dismiss
- **Use Case**: When a task is moved due to a higher priority task

### 4. Late Wind-Down Conflict (`late_wind_down_conflict`)
- **Severity**: Error
- **Actions**: Schedule Earlier, Manual Override, Dismiss
- **Use Case**: When scheduling conflicts with sleep wind-down period

### 5. Deadline Approaching (`task_deadline_approaching`)
- **Severity**: Warning
- **Actions**: Start Now, Extend Deadline, Dismiss
- **Use Case**: When a task deadline is coming up soon

## Styling Guidelines

### Severity-Based Styling
```css
.notification-dialog {
  /* Base styles */
}

.notification-dialog.info {
  border-left: 4px solid #2196F3;
  background-color: #E3F2FD;
}

.notification-dialog.warning {
  border-left: 4px solid #FF9800;
  background-color: #FFF3E0;
}

.notification-dialog.error {
  border-left: 4px solid #F44336;
  background-color: #FFEBEE;
}

.notification-dialog.success {
  border-left: 4px solid #4CAF50;
  background-color: #E8F5E8;
}
```

### Button Variants
```css
.notification-button.primary {
  background-color: #2196F3;
  color: white;
}

.notification-button.secondary {
  background-color: #f5f5f5;
  color: #333;
}

.notification-button.danger {
  background-color: #F44336;
  color: white;
}
```

## Integration Points

1. **Hook into existing task creation/scheduling flows**
   - Modify task creation APIs to return notifications
   - Listen for scheduling events and display notifications

2. **Use existing modal/dialog system**
   - Adapt notification dialogs to your current modal framework
   - Maintain consistent styling with existing dialogs

3. **Follow current app's design system**
   - Use existing color schemes, fonts, and spacing
   - Maintain consistency with current UI patterns

4. **Ensure accessibility**
   - Add proper ARIA labels and roles
   - Support keyboard navigation
   - Provide screen reader compatibility

5. **Mobile-friendly design**
   - Responsive dialog sizing
   - Touch-friendly button sizes
   - Proper viewport handling

## Expected Deliverables

1. **Notification Dialog Component**
   - Reusable component for displaying notifications
   - Proper styling for all severity levels
   - Action button handling

2. **Action Handler Service/Utility**
   - Centralized notification action handling
   - API communication logic
   - Error handling and fallbacks

3. **Integration with Task Scheduling Flows**
   - Modified task creation/scheduling to show notifications
   - Real-time notification display
   - Proper notification queuing

4. **Demo/Test Page**
   - Page showing all notification types
   - Interactive testing of all actions
   - Documentation of notification flow

5. **Documentation**
   - How to trigger notifications from other parts of the app
   - Component usage examples
   - API integration guide

## Testing Instructions

1. **Test with Demo Endpoint**
   ```javascript
   // Fetch demo notifications
   fetch('/api/notifications/demo?userId=test-user')
     .then(response => response.json())
     .then(data => {
       data.notifications.forEach(notification => {
         showNotificationDialog(notification);
       });
     });
   ```

2. **Test Each Notification Type**
   - Verify all 5 notification types display correctly
   - Test all action buttons work as expected
   - Confirm styling matches severity levels

3. **Test Action Handling**
   - Verify POST requests to `/api/notifications/action`
   - Test all response types (redirect, open_dialog, etc.)
   - Confirm error handling works properly

4. **Integration Testing**
   - Test notifications appear during task creation
   - Verify notifications don't interfere with normal app flow
   - Test on mobile devices and different screen sizes

## Success Criteria

- [ ] All notification types display correctly with proper styling
- [ ] Action buttons work and communicate with backend properly
- [ ] Notifications integrate seamlessly with existing task flows
- [ ] Demo page shows complete notification functionality
- [ ] Mobile-responsive and accessible implementation
- [ ] Error handling prevents app crashes
- [ ] Consistent with existing app design and patterns

Please implement this notification system integration, ensuring it follows the existing frontend architecture and design patterns. Test thoroughly with the demo endpoint to verify all notification types display and function correctly.
