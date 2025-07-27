// src/models/index.ts
import mongoose, { Schema, Document } from 'mongoose';
import { User, IUser } from './userModel';

// Task Model
export interface ITask extends Document {
  title: string;
  userId: string;
  description?: string;
  estimatedDuration: number;
  priority: number;
  status: 'pending' | 'completed';
  tag: 'deep' | 'creative' | 'admin' | 'personal';
  scheduleType: string;
  isAutoSchedule: boolean;
  isChunked: boolean;
  chunks: string[];
  parentTaskId?: string;
  startTime?: Date;
  endTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  profileId: string;
  subtasks: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  userId: { type: String, required: true },
  description: { type: String },
  estimatedDuration: { type: Number, required: true, default: 60 },
  priority: { type: Number, required: true, default: 3, min: 1, max: 5 },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  tag: { type: String, enum: ['deep', 'creative', 'admin', 'personal'], required: true },
  scheduleType: { type: String, default: 'flexible' },
  isAutoSchedule: { type: Boolean, default: true },
  isChunked: { type: Boolean, default: false },
  chunks: [{ type: String }],
  parentTaskId: { type: String },
  startTime: { type: Date },
  endTime: { type: Date },
  actualStartTime: { type: Date },
  actualEndTime: { type: Date },
  profileId: { type: String, required: true },
  subtasks: [{ type: String }]
}, { timestamps: true });

// Energy Model
export interface IEnergy extends Document {
  userId: string;
  date: Date;
  mood: 'happy' | 'motivated' | 'focused' | 'calm' | 'grateful' | 'confident' | 'optimistic' | 'inspired' | 'indifferent' | 'disappointed';
  energyLevel: number;
  energyStage: 'morning_rise' | 'morning_peak' | 'afternoon_rebound' | 'midday_dip' | 'wind_down' | 'sleep_phase';
  hour: number;
  hasManualCheckIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EnergySchema = new Schema<IEnergy>({
  userId: { type: String, required: true },
  date: { type: Date, required: true },
  mood: { 
    type: String, 
    enum: ['happy', 'motivated', 'focused', 'calm', 'grateful', 'confident', 'optimistic', 'inspired', 'indifferent', 'disappointed'],
    required: true 
  },
  energyLevel: { type: Number, required: true, min: 0, max: 1 },
  energyStage: { 
    type: String, 
    enum: ['morning_rise', 'morning_peak', 'afternoon_rebound', 'midday_dip', 'wind_down', 'sleep_phase'],
    required: true 
  },
  hour: { type: Number, required: true, min: 0, max: 23 },
  hasManualCheckIn: { type: Boolean, default: false }
}, { timestamps: true });

// Schedule Item Model
export interface IScheduleItem extends Document {
  userId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type: 'task' | 'event';
  taskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleItemSchema = new Schema<IScheduleItem>({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  type: { type: String, enum: ['task', 'event'], required: true },
  taskId: { type: String }
}, { timestamps: true });

// Historical Energy Pattern Model
export interface IHistoricalEnergyPattern extends Document {
  userId: string;
  hour: number;
  averageEnergy: number;
  sampleCount: number;
  lastUpdated: Date;
}

const HistoricalEnergyPatternSchema = new Schema<IHistoricalEnergyPattern>({
  userId: { type: String, required: true },
  hour: { type: Number, required: true, min: 0, max: 23 },
  averageEnergy: { type: Number, required: true, min: 0, max: 1 },
  sampleCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

// Create indexes
TaskSchema.index({ userId: 1, startTime: 1 });
TaskSchema.index({ userId: 1, status: 1 });
EnergySchema.index({ userId: 1, date: 1, hour: 1 });
ScheduleItemSchema.index({ userId: 1, startTime: 1 });
ScheduleItemSchema.index({ userId: 1, type: 1 });
HistoricalEnergyPatternSchema.index({ userId: 1, hour: 1 }, { unique: true });

export const Task = mongoose.model<ITask>('Task', TaskSchema);
export const Energy = mongoose.model<IEnergy>('Energy', EnergySchema);
export const ScheduleItem = mongoose.model<IScheduleItem>('ScheduleItem', ScheduleItemSchema);
export const HistoricalEnergyPattern = mongoose.model<IHistoricalEnergyPattern>('HistoricalEnergyPattern', HistoricalEnergyPatternSchema);
export { User, IUser };