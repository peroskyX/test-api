"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedEnergyDataFromSleep = seedEnergyDataFromSleep;
exports.userHasEnergyData = userHasEnergyData;
exports.seedEnergyDataIfNeeded = seedEnergyDataIfNeeded;
// src/utils/sleepEnergySeeder.ts
const models_1 = require("../models");
const sleepEnergyPatterns_1 = require("./sleepEnergyPatterns");
const date_fns_1 = require("date-fns");
/**
 * Seeds initial energy data based on user's sleep schedule
 * This creates actual Energy entries, not historical patterns
 */
async function seedEnergyDataFromSleep(options) {
    const { userId, sleepSchedule, chronotype = 'neutral', daysToGenerate = 1, startDate = new Date() } = options;
    // Generate the energy pattern template
    const patterns = (0, sleepEnergyPatterns_1.generateEnergyPatternsFromSleep)({
        sleepSchedule,
        chronotype
    });
    const energyEntries = [];
    const baseDate = (0, date_fns_1.startOfDay)(startDate);
    // Generate energy data for the specified number of days
    for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
        const currentDate = (0, date_fns_1.addDays)(baseDate, dayOffset);
        // Only generate for hours when user is typically awake
        for (const pattern of patterns) {
            // Skip very low energy hours (sleep time)
            if (pattern.averageEnergy < 0.2)
                continue;
            const energyDate = (0, date_fns_1.setHours)(currentDate, pattern.hour);
            // Extract hour from the date (using UTC to ensure consistency)
            const hourFromDate = pattern.hour;
            console.log('this is hourFromDate', hourFromDate);
            // Add some random variation to make it more realistic
            const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
            const energyLevel = Math.max(0.1, Math.min(1.0, pattern.averageEnergy + variation));
            const energyEntry = new models_1.Energy({
                userId,
                date: energyDate,
                hour: hourFromDate, // Use the hour extracted from date
                energyLevel,
                energyStage: getEnergyStageForLevel(energyLevel, hourFromDate, sleepSchedule),
                mood: selectMoodBasedOnEnergy(energyLevel),
                hasManualCheckIn: false
            });
            energyEntries.push(energyEntry);
        }
    }
    // Save all energy entries
    const savedEntries = await models_1.Energy.insertMany(energyEntries);
    return savedEntries;
}
/**
 * Determines energy stage based on level and time of day
 */
function getEnergyStageForLevel(energyLevel, hour, sleepSchedule) {
    const { wakeHour, bedtime } = sleepSchedule;
    // Calculate hours since wake
    let hoursSinceWake = hour - wakeHour;
    if (hoursSinceWake < 0)
        hoursSinceWake += 24;
    // Calculate total awake hours
    let awakeHours = bedtime - wakeHour;
    if (awakeHours < 0)
        awakeHours += 24;
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
 * Selects an appropriate mood based on energy level
 */
function selectMoodBasedOnEnergy(energyLevel) {
    if (energyLevel > 0.8) {
        const highEnergyMoods = ['motivated', 'focused', 'confident', 'optimistic'];
        return highEnergyMoods[Math.floor(Math.random() * highEnergyMoods.length)];
    }
    else if (energyLevel > 0.6) {
        const mediumEnergyMoods = ['happy', 'calm', 'grateful', 'inspired'];
        return mediumEnergyMoods[Math.floor(Math.random() * mediumEnergyMoods.length)];
    }
    else if (energyLevel > 0.4) {
        return 'indifferent';
    }
    else {
        return 'disappointed';
    }
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
