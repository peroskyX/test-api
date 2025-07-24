// src/routes/index.ts
import { Router } from 'express';
import { taskRoutes } from './taskRoutes';
import { energyRoutes } from './energyRoutes';
import { scheduleRoutes } from './scheduleRoutes';

export const router: Router = Router();

router.use('/tasks', taskRoutes);
router.use('/energy', energyRoutes);
router.use('/schedule', scheduleRoutes);
