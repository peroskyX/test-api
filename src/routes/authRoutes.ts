// src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { User } from '../models';
import { generateToken } from '../middleware/authMiddleware';
import { SmartSchedulingService } from '../services/smartSchedulingService';
import { protect } from '../middleware/authMiddleware';

export const authRoutes: Router = Router();

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
authRoutes.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if required fields are provided
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please provide username, email and password' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Create new user
    const user = new User({
      username,
      email,
      firstName,
      lastName
    });

    // Set password (this will hash the password)
    user.setPassword(password);

    // Save user to database
    await user.save();

    // Return user data with token
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

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
authRoutes.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // Check if username and password are provided
    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide username and password' });
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username } // Allow login with email as well
      ]
    });

    // Check if user exists and password is correct
    if (!user || !user.validatePassword(password)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Return user data with token
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

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
authRoutes.get('/profile', protect, async (req: Request, res: Response) => {
  try {
    // User should be attached to request by the protect middleware
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


// @desc    Update user sleep schedule
// @route   PUT /api/auth/sleep-schedule
// @access  Private
authRoutes.put('/sleep-schedule', protect, async (req: Request, res: Response) => {
  try {
    const { bedtime, wakeHour, chronotype, generateEnergyData } = req.body;

    // Validate sleep hours
    if (bedtime === undefined || wakeHour === undefined) {
      return res.status(400).json({ 
        error: 'Please provide both bedtime and wakeHour' 
      });
    }

    // Validate hour ranges
    if (bedtime < 0 || bedtime > 23 || wakeHour < 0 || wakeHour > 23) {
      return res.status(400).json({ 
        error: 'Hours must be between 0 and 23' 
      });
    }

    // Update user
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

    // Note: We don't clear historical patterns as they represent actual averaged data
    // Sleep schedule only affects default patterns when no historical data exists
    
    // If "generateEnergyData" is true, seed energy data from sleep schedule
    if (generateEnergyData) {
      // Always generate new energy data if requested, regardless of existing data
      const { seedEnergyDataFromSleep } = await import('../utils/sleepEnergySeeder');
      await seedEnergyDataFromSleep({
        userId: user._id.toString(),
        sleepSchedule: user.sleepSchedule,
        chronotype: user.chronotype,
        daysToGenerate: 1 // Seed a week of data
      });

      console.log('[updateHistoricalPatterns] updating historical patterns.................', req.userId, user._id);
      // Update historical patterns based on the new data
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

// @desc    Get user sleep schedule
// @route   GET /api/auth/sleep-schedule
// @access  Private
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
