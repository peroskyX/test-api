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
const JWT_SECRET = process.env.JWT_SECRET || 'smart-scheduling-secret-key';

// Middleware to protect routes
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  console.log('🔐 Auth middleware called for:', req.method, req.path);
  console.log('📋 Authorization header:', req.headers.authorization ? 'Present' : 'Missing');

  // Check if token exists in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      console.log('🎫 Token extracted:', token ? `${token.substring(0, 20)}...` : 'null');
      
      // Verify token
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        console.log('✅ Token verified successfully. User ID:', decoded.id);

        // Get user from token
        const user = await User.findById(decoded.id).select('-hashedPassword -salt');
        console.log('👤 Database lookup result:', user ? 'User found' : 'User not found');
        
        if (!user) {
          console.log('User not found with id:', decoded.id);
          res.status(401).json({ error: 'Not authorized, user not found' });
          return;
        }
        if(user) {
          console.log('User found with id:', decoded.id);
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

// Generate JWT token
export const generateToken = (id: string): string => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d', // Token expires in 30 days
  });
};
