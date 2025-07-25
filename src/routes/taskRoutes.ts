// src/routes/taskRoutes.ts
import { Router, Request, Response } from 'express';
import { Task, ScheduleItem } from '../models';
import { SmartSchedulingService } from '../services/smartSchedulingService';

export const taskRoutes: Router = Router();
const schedulingService = new SmartSchedulingService();

// Create a new task
taskRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const taskData = req.body;
    const task = await schedulingService.createTaskWithSmartScheduling(taskData);
    res.status(201).json(task);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

// Get all tasks for a user
taskRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const { userId, status, startDate, endDate } = req.query;
    const query: any = {};
    
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }
    
    const tasks = await Task.find(query).sort({ startTime: 1 });
    res.json(tasks);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific task
taskRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Update a task
taskRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const task = await schedulingService.updateTaskWithRescheduling(req.params.id, updates);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

// Delete a task
taskRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    // Also remove from schedule
    await ScheduleItem.findOneAndDelete({ taskId: task.id });
    res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});

// Manually trigger rescheduling
taskRoutes.post('/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const taskSelect = schedulingService['convertToTaskSelect'](task);
    const scheduledTime = await schedulingService.findOptimalTimeForTask(taskSelect, task.userId);
    
    if (scheduledTime) {
      task.startTime = scheduledTime.startTime;
      task.endTime = scheduledTime.endTime;
      await task.save();
      
      // Update schedule item
      await ScheduleItem.findOneAndUpdate(
        { taskId: task.id },
        {
          startTime: task.startTime,
          endTime: task.endTime
        }
      );
      res.json(task);
    } else {
      // If no optimal time found, send a specific message
      return res.status(409).json({ message: 'Could not find an optimal time to reschedule the task.' });
    }
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
});