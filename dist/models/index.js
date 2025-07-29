"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.HistoricalEnergyPattern = exports.ScheduleItem = exports.Energy = exports.Task = void 0;
// src/models/index.ts
const mongoose_1 = require("mongoose");
const userModel_1 = require("./userModel");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return userModel_1.User; } });
const TaskSchema = new mongoose_1.Schema({
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
const EnergySchema = new mongoose_1.Schema({
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
const ScheduleItemSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    title: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    type: { type: String, enum: ['task', 'event'], required: true },
    taskId: { type: String }
}, { timestamps: true });
const HistoricalEnergyPatternSchema = new mongoose_1.Schema({
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
exports.Task = mongoose_1.default.model('Task', TaskSchema);
exports.Energy = mongoose_1.default.model('Energy', EnergySchema);
exports.ScheduleItem = mongoose_1.default.model('ScheduleItem', ScheduleItemSchema);
exports.HistoricalEnergyPattern = mongoose_1.default.model('HistoricalEnergyPattern', HistoricalEnergyPatternSchema);
