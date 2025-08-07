"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEnergyDataFromSleep = seedEnergyDataFromSleep;
exports.userHasEnergyData = userHasEnergyData;
exports.seedEnergyDataIfNeeded = seedEnergyDataIfNeeded;
exports.previewEnergyPattern = previewEnergyPattern;
// src/utils/sleepEnergySeeder.ts
const models_1 = require("../models");
const date_fns_1 = require("date-fns");
/**
 * Seeds energy data for ALL 24 hours based on user's sleep schedule
 * This creates actual Energy entries for hours 0-23
 */
async function seedEnergyDataFromSleep(options) {
    const { userId, sleepSchedule, chronotype = 'neutral', daysToGenerate = 1, startDate = new Date() } = options;
    console.log('[seedEnergyDataFromSleep] Starting with sleep schedule:', sleepSchedule);
    console.log('[seedEnergyDataFromSleep] Chronotype:', chronotype);
    const energyEntries = [];
    const baseDate = (0, date_fns_1.startOfDay)(startDate);
    // Generate energy data for the specified number of days
    for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
        const currentDate = (0, date_fns_1.addDays)(baseDate, dayOffset);
        // Generate energy pattern for all 24 hours
        const dayPattern = generateDayEnergyPattern(sleepSchedule, chronotype);
        // Create energy entries for each hour (0-23)
        for (const hourData of dayPattern) {
            const energyDate = (0, date_fns_1.setHours)(currentDate, hourData.hour);
            // Add small random variation to make it more realistic (±5%)
            const variation = (Math.random() - 0.5) * 0.1;
            const energyLevel = Math.max(0.04, Math.min(1.0, hourData.energyLevel + variation));
            const energyEntry = new models_1.Energy({
                userId,
                date: energyDate,
                hour: hourData.hour,
                energyLevel,
                energyStage: hourData.energyStage,
                mood: hourData.mood,
                hasManualCheckIn: false
            });
            energyEntries.push(energyEntry);
        }
    }
    console.log(`[seedEnergyDataFromSleep] Created ${energyEntries.length} energy entries`);
    // Save all energy entries
    const savedEntries = await models_1.Energy.insertMany(energyEntries);
    return savedEntries;
}
/**
 * Generate energy pattern for all 24 hours based on sleep schedule
 */
function generateDayEnergyPattern(sleepSchedule, chronotype = 'neutral') {
    const { bedtime, wakeHour } = sleepSchedule;
    const pattern = [];
    console.log(`[generateDayEnergyPattern] Generating for bedtime: ${bedtime}, wakeHour: ${wakeHour}`);
    // Generate for each hour 0-23
    for (let hour = 0; hour < 24; hour++) {
        const hourData = calculateHourEnergyData(hour, bedtime, wakeHour, chronotype);
        pattern.push(hourData);
    }
    return pattern;
}
/**
 * Calculate energy data for a specific hour
 */
function calculateHourEnergyData(hour, bedtime, wakeHour, chronotype) {
    // Check if hour is during sleep time
    const isAsleep = isHourDuringSleep(hour, bedtime, wakeHour);
    if (isAsleep) {
        // Sleep phase - very low energy
        const sleepEnergies = [0.09, 0.07, 0.08, 0.04, 0.08, 0.04, 0.04, 0.06];
        return {
            hour,
            energyLevel: sleepEnergies[hour % sleepEnergies.length],
            energyStage: 'sleep_phase',
            mood: 'disappointed' // Using disappointed as closest to tired in the enum
        };
    }
    // Calculate hours since wake and total awake hours
    let hoursSinceWake = calculateHoursSinceWake(hour, wakeHour);
    let awakeHours = calculateAwakeHours(bedtime, wakeHour);
    // Calculate relative position in wake period (0 to 1)
    const relativeTime = hoursSinceWake / awakeHours;
    // Determine energy stage and level based on relative time
    let energyLevel;
    let energyStage;
    let mood;
    // Morning rise (first 10-15% of wake time)
    if (relativeTime <= 0.15) {
        energyLevel = 0.32 + (relativeTime * 3); // Rise from 0.32 to ~0.5
        energyStage = 'morning_rise';
        mood = relativeTime < 0.08 ? 'calm' : 'calm';
    }
    // Morning peak (15-35% of wake time)
    else if (relativeTime <= 0.35) {
        const peakProgress = (relativeTime - 0.15) / 0.2;
        energyLevel = 0.85 + (Math.sin(peakProgress * Math.PI) * 0.12); // Peak 0.85-0.97
        energyStage = 'morning_peak';
        mood = 'motivated';
    }
    // Midday dip (35-55% of wake time)
    else if (relativeTime <= 0.55) {
        energyLevel = 0.28 + (Math.random() * 0.02); // Low energy 0.28-0.30
        energyStage = 'midday_dip';
        mood = 'indifferent'; // Using indifferent as closest to relaxed
    }
    // Afternoon rebound (55-70% of wake time)
    else if (relativeTime <= 0.70) {
        const reboundProgress = (relativeTime - 0.55) / 0.15;
        energyLevel = 0.62 + (reboundProgress * 0.08); // Rise from 0.62 to 0.70
        energyStage = 'afternoon_rebound';
        mood = 'focused';
    }
    // Wind down (70-100% of wake time)
    else {
        // Check if in last 2 hours before bed (late wind-down)
        const hoursUntilBed = calculateHoursUntilBedtime(hour, bedtime);
        if (hoursUntilBed <= 2) {
            // Late wind-down - very low energy
            energyLevel = 0.13 + (Math.random() * 0.08); // 0.13-0.21
            mood = 'disappointed'; // Tired
        }
        else {
            // Regular wind-down
            energyLevel = 0.20 + (Math.random() * 0.06); // 0.20-0.26
            mood = 'indifferent'; // Relaxed
        }
        energyStage = 'wind_down';
    }
    // Apply chronotype adjustments
    energyLevel = applyChronotypeAdjustment(energyLevel, relativeTime, chronotype);
    // Ensure energy stays within bounds
    energyLevel = Math.max(0.04, Math.min(0.97, energyLevel));
    return {
        hour,
        energyLevel: Math.round(energyLevel * 100) / 100, // Round to 2 decimal places
        energyStage,
        mood
    };
}
/**
 * Check if an hour is during sleep time
 */
function isHourDuringSleep(hour, bedtime, wakeHour) {
    if (bedtime < wakeHour) {
        // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM)
        return hour >= bedtime && hour < wakeHour;
    }
    else {
        // Sleep crosses midnight (e.g., bed at 11 PM, wake at 7 AM)
        return hour >= bedtime || hour < wakeHour;
    }
}
/**
 * Calculate hours since wake time
 */
function calculateHoursSinceWake(currentHour, wakeHour) {
    if (currentHour >= wakeHour) {
        return currentHour - wakeHour;
    }
    else {
        // Crossed midnight
        return (24 - wakeHour) + currentHour;
    }
}
/**
 * Calculate total awake hours
 */
function calculateAwakeHours(bedtime, wakeHour) {
    if (bedtime > wakeHour) {
        return bedtime - wakeHour;
    }
    else {
        // Crosses midnight
        return (24 - wakeHour) + bedtime;
    }
}
/**
 * Calculate hours until bedtime
 */
function calculateHoursUntilBedtime(currentHour, bedtime) {
    if (currentHour <= bedtime) {
        return bedtime - currentHour;
    }
    else {
        // Bedtime is tomorrow
        return (24 - currentHour) + bedtime;
    }
}
/**
 * Apply chronotype-specific adjustments to energy levels
 */
function applyChronotypeAdjustment(baseEnergy, relativeTime, chronotype) {
    if (chronotype === 'neutral')
        return baseEnergy;
    if (chronotype === 'morning') {
        // Morning types: boost early energy, reduce late energy
        if (relativeTime < 0.3) {
            return baseEnergy * 1.15; // 15% boost in morning
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
 * Checks if user already has energy data
 */
async function userHasEnergyData(userId) {
    const count = await models_1.Energy.countDocuments({ userId });
    return count > 0;
}
/**
 * Seeds energy data only if user doesn't have any
 */
async function seedEnergyDataIfNeeded(options) {
    const hasData = await userHasEnergyData(options.userId);
    if (hasData) {
        console.log(`[seedEnergyDataIfNeeded] User ${options.userId} already has energy data`);
        return null;
    }
    console.log(`[seedEnergyDataIfNeeded] Seeding energy data for user ${options.userId}`);
    return seedEnergyDataFromSleep(options);
}
/**
 * Example function to test energy generation
 */
function previewEnergyPattern(sleepSchedule, chronotype = 'neutral') {
    const pattern = generateDayEnergyPattern(sleepSchedule, chronotype);
    console.log('\n=== Energy Pattern Preview ===');
    console.log(`Sleep Schedule: Bed at ${sleepSchedule.bedtime}:00, Wake at ${sleepSchedule.wakeHour}:00`);
    console.log(`Chronotype: ${chronotype}\n`);
    // Group by energy stage for better visualization
    const stages = {
        'sleep_phase': [],
        'morning_rise': [],
        'morning_peak': [],
        'midday_dip': [],
        'afternoon_rebound': [],
        'wind_down': []
    };
    pattern.forEach(hour => {
        stages[hour.energyStage].push(hour);
    });
    // Print grouped results
    Object.entries(stages).forEach(([stage, hours]) => {
        if (hours.length > 0) {
            console.log(`\n${stage.toUpperCase().replace('_', ' ')}:`);
            hours.forEach(h => {
                console.log(`  Hour ${h.hour.toString().padStart(2, '0')}: Energy ${h.energyLevel.toFixed(2)}, Mood: ${h.mood}`);
            });
        }
    });
    return pattern;
}
