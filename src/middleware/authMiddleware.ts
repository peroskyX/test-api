// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User } from '../models';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userId?: string;
    }
  }
}

// JWT secret key - this should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to protect routes
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;


  // Check if token exists in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-hashedPassword -salt');
        
        if (!user) {
          res.status(401).json({ error: 'Not authorized, user not found' });
          return;
        }
        
        // Set user in request object
        req.user = user;
        req.userId = user._id.toString();
        
        next();
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        res.status(401).json({ error: 'Not authorized, token invalid' });
        return;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Not authorized, token processing failed' });
      return;
    }
  } else {
    console.log('No Bearer token found in Authorization header');
    res.status(401).json({ error: 'Not authorized, no token provided' });
    return;
  }
};

// Generate JWT access token (shorter lived)
export const generateAccessToken = (id: string): string => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '600m', // Short-lived access token
  });
};

// Generate JWT refresh token (longer lived)
export const generateRefreshToken = (id: string): string => {
  return jwt.sign({ id, type: 'refresh' }, JWT_SECRET, {
    expiresIn: '7d', // Refresh token lasts 7 days
  });
};

// Legacy function for backward compatibility
export const generateToken = (id: string): string => {
  return generateAccessToken(id);
};

// Middleware to refresh access token
export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const decoded: any = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.id);
    const newRefreshToken = generateRefreshToken(decoded.id);
    
    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: '600m'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};
