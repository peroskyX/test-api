"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = exports.protect = void 0;
const jwt = require("jsonwebtoken");
const models_1 = require("../models");
// JWT secret key - this should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'smart-scheduling-secret-key';
// Middleware to protect routes
const protect = async (req, res, next) => {
    let token;
    // Check if token exists in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            // Verify token
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                // Get user from token
                const user = await models_1.User.findById(decoded.id).select('-hashedPassword -salt');
                if (!user) {
                    console.log('User not found with id:', decoded.id);
                    res.status(401).json({ error: 'Not authorized, user not found' });
                    return;
                }
                // Set user in request object
                req.user = user;
                req.userId = user._id.toString();
                next();
            }
            catch (jwtError) {
                console.error('JWT verification failed:', jwtError);
                res.status(401).json({ error: 'Not authorized, token invalid' });
                return;
            }
        }
        catch (error) {
            console.error('Authentication error:', error);
            res.status(401).json({ error: 'Not authorized, token processing failed' });
            return;
        }
    }
    else {
        console.log('No Bearer token found in Authorization header');
        res.status(401).json({ error: 'Not authorized, no token provided' });
        return;
    }
};
exports.protect = protect;
// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '30d', // Token expires in 30 days
    });
};
exports.generateToken = generateToken;
