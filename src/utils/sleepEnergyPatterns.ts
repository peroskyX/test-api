// src/utils/sleepEnergyPatterns.ts
import type { ISleepSchedule } from '../models/userModel';
import type { HistoricalEnergyPattern } from '../smart';

export interface EnergyPatternOptions {
  sleepSchedule: ISleepSchedule;
  chronotype?: 'morning' | 'evening' | 'neutral';
}

/**
 * Generates personalized energy patterns based on sleep schedule
 */
export function generateEnergyPatternsFromSleep(options: EnergyPatternOptions): HistoricalEnergyPattern[] {
  const { sleepSchedule, chronotype = 'neutral' } = options;
  const { bedtime, wakeHour } = sleepSchedule;
  
  const patterns: HistoricalEnergyPattern[] = [];
  
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
 * Calculate sleep duration accounting for cross-midnight sleep
 */
function calculateSleepDuration(bedtime: number, wakeHour: number): number {
  if (bedtime < wakeHour) {
    // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM)
    return wakeHour - bedtime;
  } else {
    // Sleep crosses midnight (e.g., bed at 11 PM, wake at 7 AM)
    return (24 - bedtime) + wakeHour;
  }
}

/**
 * Calculate the middle of the wake period
 */
function calculateMidDay(wakeHour: number, bedtime: number): number {
  let wakeWindow: number;
  
  if (wakeHour < bedtime) {
    // Normal day schedule
    wakeWindow = bedtime - wakeHour;
  } else {
    // Night shift schedule
    wakeWindow = (24 - wakeHour) + bedtime;
  }
  
  const midPoint = wakeHour + (wakeWindow / 2);
  return midPoint >= 24 ? midPoint - 24 : midPoint;
}

/**
 * Calculate energy level for a specific hour
 */
function calculateEnergyForHour(
  hour: number,
  wakeHour: number,
  bedtime: number,
  midDay: number,
  chronotype: 'morning' | 'evening' | 'neutral'
): number {
  // During sleep hours, energy is very low
  if (isAsleep(hour, bedtime, wakeHour)) {
    return 0.1;
  }
  
  // Calculate hours since waking
  let hoursSinceWake = hour - wakeHour;
  if (hoursSinceWake < 0) hoursSinceWake += 24;
  
  // Base energy curve
  let energy = calculateBaseEnergyCurve(hoursSinceWake, wakeHour, bedtime);
  
  // Apply chronotype modifications
  energy = applyChronotypeModification(energy, hour, wakeHour, bedtime, chronotype);
  
  // Ensure energy stays within bounds
  return Math.max(0.1, Math.min(1.0, energy));
}

/**
 * Check if a given hour is during sleep time
 */
function isAsleep(hour: number, bedtime: number, wakeHour: number): boolean {
  if (bedtime < wakeHour) {
    // Sleep doesn't cross midnight
    return hour >= bedtime && hour < wakeHour;
  } else {
    // Sleep crosses midnight
    return hour >= bedtime || hour < wakeHour;
  }
}

/**
 * Calculate base energy curve throughout the day
 */
function calculateBaseEnergyCurve(hoursSinceWake: number, wakeHour: number, bedtime: number): number {
  const awakeHours = calculateSleepDuration(wakeHour, bedtime);
  
  // Key points in the energy curve (as percentage of wake time)
  const morningPeakTime = 0.2;  // 20% into the day
  const postLunchDipTime = 0.5;  // 50% into the day
  const afternoonPeakTime = 0.7; // 70% into the day
  
  const relativeTime = hoursSinceWake / awakeHours;
  
  if (relativeTime <= 0.05) {
    // Just woke up - gradual rise
    return 0.3 + (relativeTime * 4);
  } else if (relativeTime <= morningPeakTime) {
    // Rising to morning peak
    return 0.5 + (0.4 * (relativeTime / morningPeakTime));
  } else if (relativeTime <= postLunchDipTime) {
    // Declining to post-lunch dip
    const progress = (relativeTime - morningPeakTime) / (postLunchDipTime - morningPeakTime);
    return 0.9 - (0.4 * progress);
  } else if (relativeTime <= afternoonPeakTime) {
    // Afternoon rebound
    const progress = (relativeTime - postLunchDipTime) / (afternoonPeakTime - postLunchDipTime);
    return 0.5 + (0.25 * progress);
  } else {
    // Evening decline
    const progress = (relativeTime - afternoonPeakTime) / (1 - afternoonPeakTime);
    return 0.75 - (0.45 * progress);
  }
}

/**
 * Apply chronotype-specific modifications to energy levels
 */
function applyChronotypeModification(
  baseEnergy: number,
  hour: number,
  wakeHour: number,
  bedtime: number,
  chronotype: 'morning' | 'evening' | 'neutral'
): number {
  if (chronotype === 'neutral') return baseEnergy;
  
  let hoursSinceWake = hour - wakeHour;
  if (hoursSinceWake < 0) hoursSinceWake += 24;
  
  const awakeHours = calculateSleepDuration(wakeHour, bedtime);
  const relativeTime = hoursSinceWake / awakeHours;
  
  if (chronotype === 'morning') {
    // Morning types: boost early energy, reduce late energy
    if (relativeTime < 0.3) {
      return baseEnergy * 1.1; // 10% boost in morning
    } else if (relativeTime > 0.7) {
      return baseEnergy * 0.85; // 15% reduction in evening
    }
  } else if (chronotype === 'evening') {
    // Evening types: reduce early energy, boost late energy
    if (relativeTime < 0.3) {
      return baseEnergy * 0.85; // 15% reduction in morning
    } else if (relativeTime > 0.6) {
      return baseEnergy * 1.15; // 15% boost in evening
    }
  }
  
  return baseEnergy;
}

/**
 * Get energy stage name based on energy level and time
 */
export function getEnergyStageFromLevel(
  energyLevel: number,
  hoursSinceWake: number,
  awakeHours: number
): string {
  const relativeTime = hoursSinceWake / awakeHours;
  
  if (energyLevel < 0.3) return 'sleep_phase';
  if (relativeTime < 0.15) return 'morning_rise';
  if (relativeTime < 0.35 && energyLevel > 0.7) return 'morning_peak';
  if (relativeTime < 0.65 && energyLevel < 0.6) return 'midday_dip';
  if (relativeTime < 0.8 && energyLevel > 0.6) return 'afternoon_rebound';
  return 'wind_down';
}

/**
 * Example usage for typical sleep schedules
 */
export const COMMON_SLEEP_SCHEDULES = {
  earlyBird: { bedtime: 22, wakeHour: 6 },   // 10 PM - 6 AM
  standard: { bedtime: 23, wakeHour: 7 },     // 11 PM - 7 AM
  nightOwl: { bedtime: 1, wakeHour: 9 },      // 1 AM - 9 AM
  shiftWorker: { bedtime: 8, wakeHour: 16 },  // 8 AM - 4 PM (night shift)
};