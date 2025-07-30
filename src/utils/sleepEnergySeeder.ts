// src/utils/sleepEnergySeeder.ts
import { Energy, IEnergy } from '../models';
import { generateEnergyPatternsFromSleep } from './sleepEnergyPatterns';
import { ISleepSchedule } from '../models/userModel';
import { startOfDay, addDays, setHours } from 'date-fns';

export interface SeedEnergyOptions {
  userId: string;
  sleepSchedule: ISleepSchedule;
  chronotype?: 'morning' | 'evening' | 'neutral';
  daysToGenerate?: number;
  startDate?: Date;
}

/**
 * Seeds initial energy data based on user's sleep schedule
 * This creates actual Energy entries, not historical patterns
 */
export async function seedEnergyDataFromSleep(options: SeedEnergyOptions): Promise<IEnergy[]> {
  const {
    userId,
    sleepSchedule,
    chronotype = 'neutral',
    daysToGenerate = 1,
    startDate = new Date()
  } = options;

  // Generate the energy pattern template
  const patterns = generateEnergyPatternsFromSleep({
    sleepSchedule,
    chronotype
  });

  const energyEntries: IEnergy[] = [];
  const baseDate = startOfDay(startDate);

  // Generate energy data for the specified number of days
  for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
    const currentDate = addDays(baseDate, dayOffset);
    
    // Only generate for hours when user is typically awake
    for (const pattern of patterns) {
      // Skip very low energy hours (sleep time)
      if (pattern.averageEnergy < 0.2) continue;
      
      const energyDate = setHours(currentDate, pattern.hour);
      
      // Extract hour from the date (using UTC to ensure consistency)
      const hourFromDate = pattern.hour;
      console.log('this is hourFromDate', hourFromDate);
      
      // Add some random variation to make it more realistic
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const energyLevel = Math.max(0.1, Math.min(1.0, pattern.averageEnergy + variation));
      
      const energyEntry = new Energy({
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
  const savedEntries = await Energy.insertMany(energyEntries);
  return savedEntries;
}

/**
 * Determines energy stage based on level and time of day
 */
function getEnergyStageForLevel(
  energyLevel: number, 
  hour: number, 
  sleepSchedule: ISleepSchedule
): IEnergy['energyStage'] {
  const { wakeHour, bedtime } = sleepSchedule;
  
  // Calculate hours since wake
  let hoursSinceWake = hour - wakeHour;
  if (hoursSinceWake < 0) hoursSinceWake += 24;
  
  // Calculate total awake hours
  let awakeHours = bedtime - wakeHour;
  if (awakeHours < 0) awakeHours += 24;
  
  const relativeTime = hoursSinceWake / awakeHours;
  
  if (energyLevel < 0.3) return 'sleep_phase';
  if (relativeTime < 0.15) return 'morning_rise';
  if (relativeTime < 0.35 && energyLevel > 0.7) return 'morning_peak';
  if (relativeTime < 0.65 && energyLevel < 0.6) return 'midday_dip';
  if (relativeTime < 0.8 && energyLevel > 0.6) return 'afternoon_rebound';
  return 'wind_down';
}

/**
 * Selects an appropriate mood based on energy level
 */
function selectMoodBasedOnEnergy(energyLevel: number): IEnergy['mood'] {
  if (energyLevel > 0.8) {
    const highEnergyMoods: IEnergy['mood'][] = ['motivated', 'focused', 'confident', 'optimistic'];
    return highEnergyMoods[Math.floor(Math.random() * highEnergyMoods.length)];
  } else if (energyLevel > 0.6) {
    const mediumEnergyMoods: IEnergy['mood'][] = ['happy', 'calm', 'grateful', 'inspired'];
    return mediumEnergyMoods[Math.floor(Math.random() * mediumEnergyMoods.length)];
  } else if (energyLevel > 0.4) {
    return 'indifferent';
  } else {
    return 'disappointed';
  }
}

/**
 * Checks if user already has energy data
 */
export async function userHasEnergyData(userId: string): Promise<boolean> {
  const count = await Energy.countDocuments({ userId });
  return count > 0;
}

/**
 * Seeds energy data only if user doesn't have any
 */
export async function seedEnergyDataIfNeeded(options: SeedEnergyOptions): Promise<IEnergy[] | null> {
  const hasData = await userHasEnergyData(options.userId);
  
  if (hasData) {
    console.log(`[seedEnergyDataIfNeeded] User ${options.userId} already has energy data`);
    return null;
  }
  
  console.log(`[seedEnergyDataIfNeeded] Seeding energy data for user ${options.userId}`);
  return seedEnergyDataFromSleep(options);
}