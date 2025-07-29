// src/models/userModel.ts
import mongoose, { Schema, Document } from 'mongoose';
import * as crypto from 'crypto';

export interface ISleepSchedule {
  bedtime: number;    // Hour in 24-hour format (0-23)
  wakeHour: number;   // Hour in 24-hour format (0-23)
}

export interface IUser extends Document {
  username: string;
  email: string;
  hashedPassword: string;
  salt: string;
  firstName?: string;
  lastName?: string;
  sleepSchedule?: ISleepSchedule;  // New field
  chronotype?: 'morning' | 'evening' | 'neutral';  // Optional chronotype
  createdAt: Date;
  updatedAt: Date;
  setPassword: (password: string) => void;
  validatePassword: (password: string) => boolean;
}

const SleepScheduleSchema = new Schema({
  bedtime: { 
    type: Number, 
    required: true,
    min: 0,
    max: 23
  },
  wakeHour: { 
    type: Number, 
    required: true,
    min: 0,
    max: 23
  }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    match: /^\S+@\S+\.\S+$/
  },
  hashedPassword: { 
    type: String, 
    required: true 
  },
  salt: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String 
  },
  lastName: { 
    type: String 
  },
  sleepSchedule: {
    type: SleepScheduleSchema,
    required: false
  },
  chronotype: {
    type: String,
    enum: ['morning', 'evening', 'neutral'],
    default: 'neutral'
  }
}, { 
  timestamps: true 
});

// Method to set password
UserSchema.methods.setPassword = function(password: string) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.hashedPassword = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
};

// Method to validate password
UserSchema.methods.validatePassword = function(password: string): boolean {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
    .toString('hex');
  return this.hashedPassword === hash;
};

export const User = mongoose.model<IUser>('User', UserSchema);
