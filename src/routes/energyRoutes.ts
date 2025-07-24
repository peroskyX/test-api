// src/routes/energyRoutes.ts
import { Router, Request, Response } from 'express';
import { Energy, HistoricalEnergyPattern } from '../models';
import { SmartSchedulingService } from '../services/smartSchedulingService';

export const energyRoutes: Router = Router();
const schedulingService = new SmartSchedulingService();

// Add energy data
energyRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const energyData = new Energy(req.body);
    await energyData.save();
    
    // Update historical patterns
    await schedulingService.updateHistoricalPatterns(energyData.userId);
    
    res.status(201).json(energyData);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

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

// Get historical energy patterns
energyRoutes.get('/patterns', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    let patterns = await HistoricalEnergyPattern.find({ userId }).sort({ hour: 1 });
    
    // If no patterns exist, return default patterns
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