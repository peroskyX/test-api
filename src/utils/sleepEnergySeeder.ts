// src/utils/sleepEnergySeeder.ts
import { Energy, IEnergy } from '../models';
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
 * Seeds energy data for ALL 24 hours based on user's sleep schedule
 * This creates actual Energy entries for hours 0-23
 */
export async function seedEnergyDataFromSleep(options: SeedEnergyOptions): Promise<IEnergy[]> {
  const {
    userId,
    sleepSchedule,
    chronotype = 'neutral',
    daysToGenerate = 1,
    startDate = new Date()
  } = options;

  console.log('[seedEnergyDataFromSleep] Starting with sleep schedule:', sleepSchedule);
  console.log('[seedEnergyDataFromSleep] Chronotype:', chronotype);

  const energyEntries: IEnergy[] = [];
  const baseDate = startOfDay(startDate);

  // Generate energy data for the specified number of days
  for (let dayOffset = 0; dayOffset < daysToGenerate; dayOffset++) {
    const currentDate = addDays(baseDate, dayOffset);
    
    // Generate energy pattern for all 24 hours
    const dayPattern = generateDayEnergyPattern(sleepSchedule, chronotype);
    
    // Create energy entries for each hour (0-23)
    for (const hourData of dayPattern) {
      const energyDate = setHours(currentDate, hourData.hour);
      
      // Add small random variation to make it more realistic (±5%)
      const variation = (Math.random() - 0.5) * 0.1;
      const energyLevel = Math.max(0.04, Math.min(1.0, hourData.energyLevel + variation));
      
      const energyEntry = new Energy({
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
  const savedEntries = await Energy.insertMany(energyEntries);
  return savedEntries;
}

/**
 * Generate energy pattern for all 24 hours based on sleep schedule
 */
function generateDayEnergyPattern(
  sleepSchedule: ISleepSchedule,
  chronotype: 'morning' | 'evening' | 'neutral' = 'neutral'
): Array<{
  hour: number;
  energyLevel: number;
  energyStage: IEnergy['energyStage'];
  mood: IEnergy['mood'];
}> {
  const { bedtime, wakeHour } = sleepSchedule;
  const pattern: Array<{
    hour: number;
    energyLevel: number;
    energyStage: IEnergy['energyStage'];
    mood: IEnergy['mood'];
  }> = [];

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
function calculateHourEnergyData(
  hour: number,
  bedtime: number,
  wakeHour: number,
  chronotype: 'morning' | 'evening' | 'neutral'
): {
  hour: number;
  energyLevel: number;
  energyStage: IEnergy['energyStage'];
  mood: IEnergy['mood'];
} {
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
  let energyLevel: number;
  let energyStage: IEnergy['energyStage'];
  let mood: IEnergy['mood'];

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
    } else {
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
function isHourDuringSleep(hour: number, bedtime: number, wakeHour: number): boolean {
  if (bedtime < wakeHour) {
    // Sleep doesn't cross midnight (e.g., bed at 8 AM, wake at 4 PM)
    return hour >= bedtime && hour < wakeHour;
  } else {
    // Sleep crosses midnight (e.g., bed at 11 PM, wake at 7 AM)
    return hour >= bedtime || hour < wakeHour;
  }
}

/**
 * Calculate hours since wake time
 */
function calculateHoursSinceWake(currentHour: number, wakeHour: number): number {
  if (currentHour >= wakeHour) {
    return currentHour - wakeHour;
  } else {
    // Crossed midnight
    return (24 - wakeHour) + currentHour;
  }
}

/**
 * Calculate total awake hours
 */
function calculateAwakeHours(bedtime: number, wakeHour: number): number {
  if (bedtime > wakeHour) {
    return bedtime - wakeHour;
  } else {
    // Crosses midnight
    return (24 - wakeHour) + bedtime;
  }
}

/**
 * Calculate hours until bedtime
 */
function calculateHoursUntilBedtime(currentHour: number, bedtime: number): number {
  if (currentHour <= bedtime) {
    return bedtime - currentHour;
  } else {
    // Bedtime is tomorrow
    return (24 - currentHour) + bedtime;
  }
}

/**
 * Apply chronotype-specific adjustments to energy levels
 */
function applyChronotypeAdjustment(
  baseEnergy: number,
  relativeTime: number,
  chronotype: 'morning' | 'evening' | 'neutral'
): number {
  if (chronotype === 'neutral') return baseEnergy;
  
  if (chronotype === 'morning') {
    // Morning types: boost early energy, reduce late energy
    if (relativeTime < 0.3) {
      return baseEnergy * 1.15; // 15% boost in morning
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

/**
 * Example function to test energy generation
 */
export function previewEnergyPattern(sleepSchedule: ISleepSchedule, chronotype: 'morning' | 'evening' | 'neutral' = 'neutral') {
  const pattern = generateDayEnergyPattern(sleepSchedule, chronotype);
  
  console.log('\n=== Energy Pattern Preview ===');
  console.log(`Sleep Schedule: Bed at ${sleepSchedule.bedtime}:00, Wake at ${sleepSchedule.wakeHour}:00`);
  console.log(`Chronotype: ${chronotype}\n`);
  
  // Group by energy stage for better visualization
  const stages = {
    'sleep_phase': [] as any[],
    'morning_rise': [] as any[],
    'morning_peak': [] as any[],
    'midday_dip': [] as any[],
    'afternoon_rebound': [] as any[],
    'wind_down': [] as any[]
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