// src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { User } from '../models';
import { generateToken } from '../middleware/authMiddleware';
import { SmartSchedulingService } from '../services/smartSchedulingService';
import { protect } from '../middleware/authMiddleware';

export const authRoutes: Router = Router();

authRoutes.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please provide username, email and password' });
    }
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const user = new User({
      username,
      email,
      firstName,
      lastName
    });

    user.setPassword(password);

    await user.save();

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token: generateToken(user._id.toString())
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

authRoutes.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide username and password' });
    }
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username } 
      ]
    });

    if (!user || !user.validatePassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      token: generateToken(user._id.toString())
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

authRoutes.get('/profile', protect, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    res.json({
      _id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error while getting profile' });
  }
});


authRoutes.put('/sleep-schedule', protect, async (req: Request, res: Response) => {
  try {
    const { bedtime, wakeHour, chronotype, generateEnergyData } = req.body;

    if (bedtime === undefined || wakeHour === undefined) {
      return res.status(400).json({ 
        error: 'Please provide both bedtime and wakeHour' 
      });
    }

    if (bedtime < 0 || bedtime > 23 || wakeHour < 0 || wakeHour > 23) {
      return res.status(400).json({ 
        error: 'Hours must be between 0 and 23' 
      });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        sleepSchedule: {
          bedtime,
          wakeHour
        },
        ...(chronotype && { chronotype })
      },
      { new: true }
    ).select('-hashedPassword -salt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (generateEnergyData) {
      const { seedEnergyDataFromSleep } = await import('../utils/sleepEnergySeeder');
      await seedEnergyDataFromSleep({
        userId: user._id.toString(),
        sleepSchedule: user.sleepSchedule,
        chronotype: user.chronotype,
        daysToGenerate: 1 
      });

      const schedulingService = new SmartSchedulingService();
      await schedulingService.updateHistoricalPatterns(req.userId!);

      res.json({
        sleepSchedule: user.sleepSchedule,
        chronotype: user.chronotype,
        message: 'Sleep schedule updated and energy data generated',
      });
    } else {
      res.json({
        sleepSchedule: user.sleepSchedule,
        chronotype: user.chronotype,
        message: 'Sleep schedule updated',
      });
    }
  } catch (error) {
    console.error('Sleep schedule update error:', error);
    res.status(500).json({ error: 'Server error while updating sleep schedule' });
  }
});

authRoutes.get('/sleep-schedule', protect, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id).select('sleepSchedule chronotype');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      sleepSchedule: user.sleepSchedule || null,
      chronotype: user.chronotype || 'neutral'
    });
  } catch (error) {
    console.error('Get sleep schedule error:', error);
    res.status(500).json({ error: 'Server error while fetching sleep schedule' });
  }
});
