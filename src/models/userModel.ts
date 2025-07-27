// src/models/userModel.ts
import mongoose, { Schema, Document } from 'mongoose';
import * as crypto from 'crypto';

export interface IUser extends Document {
  username: string;
  email: string;
  hashedPassword: string;
  salt: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
  setPassword: (password: string) => void;
  validatePassword: (password: string) => boolean;
}

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
  }
}, { 
  timestamps: true 
});

// Indexes are already defined in the schema fields (unique: true creates indexes)
// No need for additional index definitions

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
