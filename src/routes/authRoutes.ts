// src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { User } from '../models';
import { generateToken } from '../middleware/authMiddleware';

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
authRoutes.get('/profile', async (req: Request, res: Response) => {
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
