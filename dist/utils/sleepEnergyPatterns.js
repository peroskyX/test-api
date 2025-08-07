"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_SLEEP_SCHEDULES = void 0;
exports.generateEnergyPatternsFromSleep = generateEnergyPatternsFromSleep;
exports.generateEnergyForecastFromSleep = generateEnergyForecastFromSleep;
exports.getEnergyStageFromLevel = getEnergyStageFromLevel;
/**
 * Generates personalized energy patterns based on sleep schedule
 */
function generateEnergyPatternsFromSleep(options) {
    const { sleepSchedule, chronotype = 'neutral' } = options;
    const { bedtime, wakeHour } = sleepSchedule;
    const patterns = [];
    // Calculate sleep duration and key time points
    const sleepDuration = calculateSleepDuration(bedtime, wakeHour);
    const midDay = calculateMidDay(wakeHour, bedtime);
    console.log('[generateEnergyPatternsFromSleep] Sleep duration:', sleepDuration);
    // Generate 24-hour energy pattern
    for (let hour = 0; hour < 24; hour++) {
        const energy = calculateEnergyForHour(hour, wakeHour, bedtime, midDay, chronotype);
        patterns.push({ hour, averageEnergy: energy });
    }
    return patterns;
}
/**
 * Generate comprehensive energy forecast based on sleep schedule
 */
function generateEnergyForecastFromSleep(options) {
    const { sleepSchedule, chronotype = 'neutral' } = options;
    const { bedtime, wakeHour } = sleepSchedule;
    // Calculate sleep duration and key time points
    const sleepDuration = calculateSleepDuration(bedtime, wakeHour);
    const midDay = calculateMidDay(wakeHour, bedtime);
    const awakeHours = calculateSleepDuration(wakeHour, bedtime);
    const energyData = [];
    // Generate 24-hour energy forecast (0-23)
    for (let hour = 0; hour < 24; hour++) {
        const energyLevel = calculateEnergyForHour(hour, wakeHour, bedtime, midDay, chronotype);
        // Debug log to show hour and energy level
        console.log(`Hour ${hour}: energyLevel ${energyLevel}`);
        // Calculate hours since wake for energy stage determination
        let hoursSinceWake = hour - wakeHour;
        if (hoursSinceWake < 0)
            hoursSinceWake += 24;
        // Get energy stage with late_wind_down consideration
        const energyStage = getEnergyStageFromLevelWithBedtime(energyLevel, hoursSinceWake, awakeHours, hour, bedtime);
        // Determine mood based on energy level and stage
        const mood = getMoodFromEnergyAndStage(energyLevel, energyStage);
        energyData.push({
            hour: hour,
            energyLevel: Math.round(energyLevel * 100) / 100, // Round to 2 decimal places
            energyStage,
            mood
        });
    }
    return energyData;
}
/**
 * Get energy stage name based on energy level, time, and bedtime (with late_wind_down)
 */
function getEnergyStageFromLevelWithBedtime(energyLevel, hoursSinceWake, awakeHours, currentHour, bedtime) {
    // Check if we're in the wind down period (6 hours before bedtime)
    const sixHoursBeforeBed = bedtime >= 6 ? bedtime - 6 : bedtime + 18; // Handle cross-midnight
    // Check if current hour is in wind down period
    let isWindDown = false;
    if (bedtime >= 6) {
        // Normal case: bedtime is 6 or later
        isWindDown = currentHour >= sixHoursBeforeBed && currentHour < bedtime;
    }
    else {
        // Cross-midnight case: bedtime is before 6 AM
        isWindDown = currentHour >= sixHoursBeforeBed || currentHour < bedtime;
    }
    if (isWindDown) {
        return 'wind_down';
    }
    // Use existing logic for other stages
    return getEnergyStageFromLevel(energyLevel, hoursSinceWake, awakeHours);
}
/**
 * Get mood based on energy level and stage
 */
function getMoodFromEnergyAndStage(energyLevel, energyStage) {
    if (energyStage === 'sleep_phase') {
        return 'tired';
    }
    if (energyStage === 'late_wind_down') {
        return 'tired';
    }
    if (energyLevel >= 0.8) {
        return 'motivated';
    }
    else if (energyLevel >= 0.6) {
        return 'focused';
    }
    else if (energyLevel >= 0.4) {
        return energyStage === 'morning_rise' ? 'calm' : 'relaxed';
    }
    else {
        return 'tired';
    }
}
/**
 * Calculate sleep duration accounting for cross-midnight sleep
 */
function calculateSleepDuration(bedtime, wakeHour) {
    if (bedtime < wakeHour) {
        // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM)
        return wakeHour - bedtime;
    }
    else {
        // Sleep crosses midnight (e.g., bed at 11 PM, wake at 7 AM)
        return (24 - bedtime) + wakeHour;
    }
}
/**
 * Calculate the middle of the wake period
 */
function calculateMidDay(wakeHour, bedtime) {
    let wakeWindow;
    if (wakeHour < bedtime) {
        // Normal day schedule
        wakeWindow = bedtime - wakeHour;
    }
    else {
        // Night shift schedule
        wakeWindow = (24 - wakeHour) + bedtime;
    }
    const midPoint = wakeHour + (wakeWindow / 2);
    return midPoint >= 24 ? midPoint - 24 : midPoint;
}
/**
 * Calculate energy level for a specific hour
 */
function calculateEnergyForHour(hour, wakeHour, bedtime, midDay, chronotype) {
    // During sleep hours, energy is very low (0.04-0.09 range)
    if (isAsleep(hour, bedtime, wakeHour)) {
        const sleepEnergyLevels = [0.09, 0.07, 0.08, 0.04, 0.08, 0.04, 0.04, 0.06];
        return sleepEnergyLevels[hour % sleepEnergyLevels.length];
    }
    // Calculate hours since waking
    let hoursSinceWake = hour - wakeHour;
    if (hoursSinceWake < 0)
        hoursSinceWake += 24;
    const awakeHours = calculateSleepDuration(wakeHour, bedtime);
    const relativeTime = hoursSinceWake / awakeHours;
    // Define energy patterns based on time of day relative to wake/sleep cycle
    let energy = 0.5; // Default
    if (relativeTime <= 0.1) {
        // Just woke up - morning rise (0.32-0.5)
        energy = 0.32 + (relativeTime * 10 * 0.18); // Gradual rise
    }
    else if (relativeTime <= 0.35) {
        // Morning peak (0.86-0.97)
        energy = 0.86 + (Math.sin((relativeTime - 0.1) * 4) * 0.11);
    }
    else if (relativeTime <= 0.6) {
        // Midday dip (0.28-0.3)
        energy = 0.28 + (Math.random() * 0.02);
    }
    else if (relativeTime <= 0.75) {
        // Afternoon rebound (0.62-0.7)
        energy = 0.62 + ((relativeTime - 0.6) * 0.53);
    }
    else {
        // Wind down (0.12-0.26)
        const windDownLevels = [0.13, 0.12, 0.26, 0.2, 0.16, 0.21];
        energy = windDownLevels[Math.floor(Math.random() * windDownLevels.length)];
    }
    // Apply chronotype modifications
    energy = applyChronotypeModification(energy, hour, wakeHour, bedtime, chronotype);
    // Ensure energy stays within realistic bounds
    return Math.max(0.04, Math.min(0.97, energy));
}
/**
 * Check if a given hour is during sleep time
 */
function isAsleep(hour, bedtime, wakeHour) {
    if (bedtime < wakeHour) {
        // Sleep doesn't cross midnight
        return hour >= bedtime && hour < wakeHour;
    }
    else {
        // Sleep crosses midnight
        return hour >= bedtime || hour < wakeHour;
    }
}
/**
 * Calculate base energy curve throughout the day
 */
function calculateBaseEnergyCurve(hoursSinceWake, wakeHour, bedtime) {
    const awakeHours = calculateSleepDuration(wakeHour, bedtime);
    // Key points in the energy curve (as percentage of wake time)
    const morningPeakTime = 0.2; // 20% into the day
    const postLunchDipTime = 0.5; // 50% into the day
    const afternoonPeakTime = 0.7; // 70% into the day
    const relativeTime = hoursSinceWake / awakeHours;
    if (relativeTime <= 0.05) {
        // Just woke up - gradual rise
        return 0.3 + (relativeTime * 4);
    }
    else if (relativeTime <= morningPeakTime) {
        // Rising to morning peak
        return 0.5 + (0.4 * (relativeTime / morningPeakTime));
    }
    else if (relativeTime <= postLunchDipTime) {
        // Declining to post-lunch dip
        const progress = (relativeTime - morningPeakTime) / (postLunchDipTime - morningPeakTime);
        return 0.9 - (0.4 * progress);
    }
    else if (relativeTime <= afternoonPeakTime) {
        // Afternoon rebound
        const progress = (relativeTime - postLunchDipTime) / (afternoonPeakTime - postLunchDipTime);
        return 0.5 + (0.25 * progress);
    }
    else {
        // Evening decline
        const progress = (relativeTime - afternoonPeakTime) / (1 - afternoonPeakTime);
        return 0.75 - (0.45 * progress);
    }
}
/**
 * Apply chronotype-specific modifications to energy levels
 */
function applyChronotypeModification(baseEnergy, hour, wakeHour, bedtime, chronotype) {
    if (chronotype === 'neutral')
        return baseEnergy;
    let hoursSinceWake = hour - wakeHour;
    if (hoursSinceWake < 0)
        hoursSinceWake += 24;
    const awakeHours = calculateSleepDuration(wakeHour, bedtime);
    const relativeTime = hoursSinceWake / awakeHours;
    if (chronotype === 'morning') {
        // Morning types: boost early energy, reduce late energy
        if (relativeTime < 0.3) {
            return baseEnergy * 1.1; // 10% boost in morning
        }
        else if (relativeTime > 0.7) {
            return baseEnergy * 0.85; // 15% reduction in evening
        }
    }
    else if (chronotype === 'evening') {
        // Evening types: reduce early energy, boost late energy
        if (relativeTime < 0.3) {
            return baseEnergy * 0.85; // 15% reduction in morning
        }
        else if (relativeTime > 0.6) {
            return baseEnergy * 1.15; // 15% boost in evening
        }
    }
    return baseEnergy;
}
/**
 * Get energy stage name based on energy level and time
 */
function getEnergyStageFromLevel(energyLevel, hoursSinceWake, awakeHours) {
    const relativeTime = hoursSinceWake / awakeHours;
    if (energyLevel < 0.3)
        return 'sleep_phase';
    if (relativeTime < 0.15)
        return 'morning_rise';
    if (relativeTime < 0.35 && energyLevel > 0.7)
        return 'morning_peak';
    if (relativeTime < 0.65 && energyLevel < 0.6)
        return 'midday_dip';
    if (relativeTime < 0.8 && energyLevel > 0.6)
        return 'afternoon_rebound';
    return 'wind_down';
}
/**
 * Example usage for typical sleep schedules
 */
exports.COMMON_SLEEP_SCHEDULES = {
    earlyBird: { bedtime: 22, wakeHour: 6 }, // 10 PM - 6 AM
    standard: { bedtime: 23, wakeHour: 7 }, // 11 PM - 7 AM
    nightOwl: { bedtime: 1, wakeHour: 9 }, // 1 AM - 9 AM
    shiftWorker: { bedtime: 8, wakeHour: 16 }, // 8 AM - 4 PM (night shift)
};
