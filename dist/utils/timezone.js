"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_TIMEZONE = void 0;
exports.toLocalTime = toLocalTime;
exports.getLocalStartOfDay = getLocalStartOfDay;
exports.isLocalDateOnly = isLocalDateOnly;
exports.parseLocalDate = parseLocalDate;
exports.formatLocalDate = formatLocalDate;
exports.getLocalNow = getLocalNow;
exports.isSameLocalDay = isSameLocalDay;
// Create a new file: src/utils/timezone.ts
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
// Configuration - you can make this configurable via environment variable
exports.USER_TIMEZONE = process.env.USER_TIMEZONE || 'Africa/Lagos';
/**
 * Convert a UTC date to local timezone
 */
function toLocalTime(date) {
    return dayjs(date).tz(exports.USER_TIMEZONE);
}
/**
 * Get start of day in local timezone
 */
function getLocalStartOfDay(date) {
    return toLocalTime(date).startOf('day').toDate();
}
/**
 * Check if a date represents only a date (no specific time) in local timezone
 */
function isLocalDateOnly(date) {
    const localTime = toLocalTime(date);
    return localTime.format('HH:mm:ss') === '00:00:00';
}
/**
 * Parse a date string in local timezone
 */
function parseLocalDate(dateString) {
    // If the date string doesn't include timezone info, parse it as local time
    if (!dateString.includes('T') || !dateString.includes('Z')) {
        return dayjs.tz(dateString, exports.USER_TIMEZONE).toDate();
    }
    return new Date(dateString);
}
/**
 * Format a date in local timezone
 */
function formatLocalDate(date, format = 'YYYY-MM-DD HH:mm') {
    return toLocalTime(date).format(format);
}
/**
 * Get the current time in local timezone
 */
function getLocalNow() {
    return dayjs().tz(exports.USER_TIMEZONE).toDate();
}
/**
 * Check if two dates are the same day in local timezone
 */
function isSameLocalDay(date1, date2) {
    const local1 = toLocalTime(date1);
    const local2 = toLocalTime(date2);
    return local1.isSame(local2, 'day');
}
