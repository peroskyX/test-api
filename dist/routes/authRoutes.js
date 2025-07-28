"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
// src/routes/authRoutes.ts
const express_1 = require("express");
const models_1 = require("../models");
const authMiddleware_1 = require("../middleware/authMiddleware");
const authMiddleware_2 = require("../middleware/authMiddleware");
exports.authRoutes = (0, express_1.Router)();
// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.authRoutes.post('/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName } = req.body;
        // Check if required fields are provided
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Please provide username, email and password' });
        }
        // Check if user already exists
        const userExists = await models_1.User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ error: 'User with this email or username already exists' });
        }
        // Create new user
        const user = new models_1.User({
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
            token: (0, authMiddleware_1.generateToken)(user._id.toString())
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});
// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
exports.authRoutes.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        // Check if username and password are provided
        if (!username || !password) {
            return res.status(400).json({ error: 'Please provide username and password' });
        }
        // Find user by username or email
        const user = await models_1.User.findOne({
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
            token: (0, authMiddleware_1.generateToken)(user._id.toString())
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});
// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.authRoutes.get('/profile', authMiddleware_2.protect, async (req, res) => {
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
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Server error while getting profile' });
    }
});
