// src/routes/energyRoutes.ts
import { Router, Request, Response } from 'express';
import { Energy, HistoricalEnergyPattern, User } from '../models';
import { SmartSchedulingService } from '../services/smartSchedulingService';

import { seedEnergyDataFromSleep, userHasEnergyData } from '../utils/sleepEnergySeeder';
import { protect } from '../middleware/authMiddleware';

export const energyRoutes: Router = Router();
const schedulingService = new SmartSchedulingService();


// Get energy data for a user
energyRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, date, startDate, endDate } = req.query;
    const query: any = {};
    
    if (userId) query.userId = userId;
    if (date) {
      const targetDate = new Date(date as string);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: targetDate, $lt: nextDay };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }
    
    const energyData = await Energy.find(query).sort({ date: 1, hour: 1 });
    res.json(energyData);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

energyRoutes.get('/patterns', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    let patterns = await HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
    
    if (patterns.length === 0) {
      patterns = schedulingService.getDefaultEnergyPatterns().map(p => ({
        userId: userId as string,
        hour: p.hour,
        averageEnergy: p.averageEnergy,
        sampleCount: 0,
        lastUpdated: new Date()
      } as any));
    }
    
    res.json(patterns);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

energyRoutes.post('/seed-from-sleep', protect, async (req: Request, res: Response) => {
  try {
    // Get user's sleep schedule
    const user = await User.findById(req.userId).select('sleepSchedule chronotype');
    if (!user?.sleepSchedule) {
      return res.status(400).json({ 
        error: 'User must set sleep schedule first' 
      });
    }

    const { daysToGenerate = 1, startDate } = req.body;

    // Check if user already has energy data (for informational purposes only)
    const hasExistingData = await userHasEnergyData(req.userId!);
    
    // Seed energy data - always generate new data regardless of existing data
    const energyData = await seedEnergyDataFromSleep({
      userId: req.userId!,
      sleepSchedule: user.sleepSchedule,
      chronotype: user.chronotype,
      daysToGenerate,
      startDate: startDate ? new Date(startDate) : new Date()
    });

    await schedulingService.updateHistoricalPatterns(req.userId!);

    res.status(201).json({
      message: `Successfully ${hasExistingData ? 'added' : 'seeded'} ${energyData.length} energy entries`,
      entriesCreated: energyData.length,
      daysGenerated: daysToGenerate,
      hadExistingData: hasExistingData
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});