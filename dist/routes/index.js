"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/index.ts
const express_1 = require("express");
const taskRoutes_1 = require("./taskRoutes");
const energyRoutes_1 = require("./energyRoutes");
const scheduleRoutes_1 = require("./scheduleRoutes");
const authRoutes_1 = require("./authRoutes");
const router = (0, express_1.Router)();
router.use('/auth', authRoutes_1.authRoutes);
router.use('/tasks', taskRoutes_1.taskRoutes);
router.use('/energy', energyRoutes_1.energyRoutes);
router.use('/schedule', scheduleRoutes_1.scheduleRoutes);
exports.default = router;
