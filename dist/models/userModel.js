"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// src/models/userModel.ts
const mongoose_1 = require("mongoose");
const crypto = require("crypto");
const SleepScheduleSchema = new mongoose_1.Schema({
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
const UserSchema = new mongoose_1.Schema({
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
UserSchema.methods.setPassword = function (password) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.hashedPassword = crypto
        .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
        .toString('hex');
};
// Method to validate password
UserSchema.methods.validatePassword = function (password) {
    const hash = crypto
        .pbkdf2Sync(password, this.salt, 1000, 64, 'sha512')
        .toString('hex');
    return this.hashedPassword === hash;
};
exports.User = mongoose_1.default.model('User', UserSchema);
