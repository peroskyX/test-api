// src/utils/deadlineUtils.ts
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const USER_TIMEZONE = 'Africa/Lagos';

/**
 * Sets a deadline to 11:59 PM on the given date in the user's timezone
 */
export function setDeadlineToEndOfDay(date: Date | string): Date {
  const deadlineDate = dayjs(date)
    .tz(USER_TIMEZONE)           // Convert to user timezone
    .hour(23)                    // Set to 11 PM
    .minute(59)                  // Set to 59 minutes
    .second(59)                  // Set to 59 seconds
    .millisecond(999)            // Set to 999 milliseconds
    .utc()                       // Convert back to UTC for storage
    .toDate();                   // Get JavaScript Date

  return deadlineDate;
}

/**
 * Processes task data to ensure proper deadline handling
 */
export function processTaskDeadline(taskData: any): any {
  const processed = { ...taskData };

  // If endTime (deadline) is provided as date-only, set it to end of day
  if (processed.endTime) {
    const endTimeDate = new Date(processed.endTime);
    
    // Check if the time is 00:00:00 (indicating date-only input)
    if (endTimeDate.getUTCHours() === 0 && 
        endTimeDate.getUTCMinutes() === 0 && 
        endTimeDate.getUTCSeconds() === 0) {
      
      console.log('[processTaskDeadline] Converting date-only deadline to end of day');
      processed.endTime = setDeadlineToEndOfDay(processed.endTime);
    }
  }

  return processed;
}

/**
 * Validates that a deadline is properly set to end of day
 */
export function isEndOfDayDeadline(date: Date): boolean {
  const local = dayjs(date).tz(USER_TIMEZONE);
  return local.hour() === 23 && local.minute() === 59;
}