"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshToken = exports.generateToken = exports.generateRefreshToken = exports.generateAccessToken = exports.protect = void 0;
const jwt = require("jsonwebtoken");
const models_1 = require("../models");
// JWT secret key - this should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
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
// Generate JWT access token (shorter lived)
const generateAccessToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '600m', // Short-lived access token
    });
};
exports.generateAccessToken = generateAccessToken;
// Generate JWT refresh token (longer lived)
const generateRefreshToken = (id) => {
    return jwt.sign({ id, type: 'refresh' }, JWT_SECRET, {
        expiresIn: '7d', // Refresh token lasts 7 days
    });
};
exports.generateRefreshToken = generateRefreshToken;
// Legacy function for backward compatibility
const generateToken = (id) => {
    return (0, exports.generateAccessToken)(id);
};
exports.generateToken = generateToken;
// Middleware to refresh access token
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }
    try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET);
        if (decoded.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        // Generate new access token
        const newAccessToken = (0, exports.generateAccessToken)(decoded.id);
        const newRefreshToken = (0, exports.generateRefreshToken)(decoded.id);
        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: '600m'
        });
    }
    catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};
exports.refreshToken = refreshToken;
