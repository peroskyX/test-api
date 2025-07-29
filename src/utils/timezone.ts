// Create a new file: src/utils/timezone.ts
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Configuration - you can make this configurable via environment variable
export const USER_TIMEZONE = process.env.USER_TIMEZONE || 'Africa/Lagos';

/**
 * Convert a UTC date to local timezone
 */
export function toLocalTime(date: Date | string): dayjs.Dayjs {
  return dayjs(date).tz(USER_TIMEZONE);
}

/**
 * Get start of day in local timezone
 */
export function getLocalStartOfDay(date: Date | string): Date {
  return toLocalTime(date).startOf('day').toDate();
}

/**
 * Check if a date represents only a date (no specific time) in local timezone
 */
export function isLocalDateOnly(date: Date | string): boolean {
  const localTime = toLocalTime(date);
  return localTime.format('HH:mm:ss') === '00:00:00';
}

/**
 * Parse a date string in local timezone
 */
export function parseLocalDate(dateString: string): Date {
  // If the date string doesn't include timezone info, parse it as local time
  if (!dateString.includes('T') || !dateString.includes('Z')) {
    return dayjs.tz(dateString, USER_TIMEZONE).toDate();
  }
  return new Date(dateString);
}

/**
 * Format a date in local timezone
 */
export function formatLocalDate(date: Date | string, format: string = 'YYYY-MM-DD HH:mm'): string {
  return toLocalTime(date).format(format);
}

/**
 * Get the current time in local timezone
 */
export function getLocalNow(): Date {
  return dayjs().tz(USER_TIMEZONE).toDate();
}

/**
 * Check if two dates are the same day in local timezone
 */
export function isSameLocalDay(date1: Date | string, date2: Date | string): boolean {
  const local1 = toLocalTime(date1);
  const local2 = toLocalTime(date2);
  return local1.isSame(local2, 'day');
}