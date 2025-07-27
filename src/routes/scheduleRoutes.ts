
// src/routes/scheduleRoutes.ts
import { Router, Request, Response } from 'express';
import { ScheduleItem, Task } from '../models';
import { SmartSchedulingService } from '../services/smartSchedulingService';
import { protect } from '../middleware/authMiddleware';

export const scheduleRoutes: Router = Router();
const schedulingService = new SmartSchedulingService();

// Apply protection middleware to all schedule routes
scheduleRoutes.use(protect);

// Add a schedule item (event)
scheduleRoutes.post('/', async (req: Request, res: Response) => {
  try {
    // Ensure the item belongs to the authenticated user
    const scheduleItem = new ScheduleItem({
      ...req.body,
      userId: req.userId
    });
    await scheduleItem.save();
    
    // If it's an event, reschedule affected tasks
    if (scheduleItem.type === 'event') {
      await schedulingService.rescheduleTasksForNewEvent(scheduleItem);
    }
    
    res.status(201).json(scheduleItem);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

// Get schedule items
scheduleRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const { type, startDate, endDate } = req.query;
    const query: any = {
      // Always filter by the authenticated user's ID
      userId: req.userId
    };
    
    if (type) query.type = type;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }
    
    const items = await ScheduleItem.find(query).sort({ startTime: 1 });
    return res.json(items);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Delete a schedule item
scheduleRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Only allow deletion of the user's own items
    const item = await ScheduleItem.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });
    if (!item) {
      return res.status(404).json({ error: 'Schedule item not found' });
    }
    
    // If it was an event, reschedule tasks that might now have free time
    if (item.type === 'event') {
      // Find tasks that could potentially use this freed time slot
      const tasksToReschedule = await Task.find({
        userId: item.userId,
        isAutoSchedule: true,
        status: 'pending'
      });
      
      for (const task of tasksToReschedule) {
        await schedulingService.updateTaskWithRescheduling(task.id, {});
      }
    }
    
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});