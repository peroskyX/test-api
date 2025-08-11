/*
 Manual test runner for SmartSchedulingService behaviors.
 Run with ts-node or compile then run.

 Tests:
 1) getScheduleItemsWithBuffer should widen empty window when targetDate === task.endTime
 2) rescheduleTasksForNewEvent should not reschedule into overlapping event window and should send NO_OPTIMAL_TIME
*/

import { addDays } from 'date-fns';
import { SmartSchedulingService } from '../services/smartSchedulingService';
import { ScheduleItem, Task, ITask, IScheduleItem } from '../models';
import { NotificationType } from '../services/notificationService';

function log(ok: boolean, name: string, details?: any) {
  const status = ok ? 'PASS' : 'FAIL';
  const extra = details ? `\n  Details: ${JSON.stringify(details)}` : '';
  console.log(`[${status}] ${name}${extra}`);
}

(async function test_rescheduleTasksForNewEvent_respectsOtherEvents() {
  const svc = new SmartSchedulingService();
  const svcAny: any = svc as any;

  const event: IScheduleItem = {
    userId: 'user1',
    title: 'meet2',
    startTime: new Date('2025-08-12T15:00:00.000Z'),
    endTime: new Date('2025-08-12T16:00:00.000Z'),
    type: 'event'
  } as any;

  const taskDoc: Partial<ITask> & { save: () => Promise<void> } = {
    _id: 'task2' as any,
    id: 'task2' as any,
    userId: 'user1',
    title: 'rick2',
    isAutoSchedule: true,
    startTime: new Date('2025-08-12T15:00:00.000Z'),
    endTime: new Date('2025-08-12T16:00:00.000Z'),
    status: 'pending' as any,
    save: async () => {}
  } as any;

  // Stub Task.find to return one conflicting task
  const originalTaskFind = (Task as any).find;
  (Task as any).find = async () => [taskDoc];

  // Force findOptimalTimeForTask to return an overlapping slot 08:00-09:00
  const originalFindOptimal = (svc as any).findOptimalTimeForTask;
  svcAny.findOptimalTimeForTask = async () => ({
    startTime: new Date('2025-08-12T08:00:00.000Z'),
    endTime: new Date('2025-08-12T09:00:00.000Z')
  });

  // Stub getScheduleItemsWithBuffer to include another event meet1 at 08:00-09:00
  const originalGetSched = svcAny.getScheduleItemsWithBuffer;
  svcAny.getScheduleItemsWithBuffer = async () => ([{
    id: 'meet1',
    title: 'meet1',
    startTime: new Date('2025-08-12T07:50:00.000Z'), // buffered earlier by 10 mins
    endTime: new Date('2025-08-12T09:10:00.000Z'),   // buffered later by 10 mins
    type: 'event'
  }]);

  // Capture notifications
  const sent: Array<{ type: NotificationType; data: any }> = [];
  const originalNotify = (svcAny.notificationService as any).sendNotification;
  (svcAny.notificationService as any).sendNotification = async (type: NotificationType, _userId: string, data: any) => {
    sent.push({ type, data });
    return { id: 'notif' } as any;
  };

  // Stub ScheduleItem.update to detect unintended updates
  const originalSIUpdate = (ScheduleItem as any).findOneAndUpdate;
  let updated = false;
  (ScheduleItem as any).findOneAndUpdate = async () => { updated = true; };

  try {
    await svc.rescheduleTasksForNewEvent(event);
    const noOverlapReschedule = !updated;
    const notifiedNoSlot = sent.some(s => s.type === NotificationType.NO_OPTIMAL_TIME);
    log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewEvent considers other events (meet1) and avoids overlapping slots', { updated, sent });
  } catch (e) {
    log(false, 'rescheduleTasksForNewEvent considers other events (meet1) and avoids overlapping slots', { error: String(e) });
  } finally {
    (Task as any).find = originalTaskFind;
    (svc as any).findOptimalTimeForTask = originalFindOptimal;
    svcAny.getScheduleItemsWithBuffer = originalGetSched;
    (svcAny.notificationService as any).sendNotification = originalNotify;
    (ScheduleItem as any).findOneAndUpdate = originalSIUpdate;
  }
})();

async function test_getScheduleItemsWithBuffer_windowWiden() {
  const svc: any = new SmartSchedulingService();

  const userId = 'user1';
  const targetDate = new Date('2025-08-12T09:00:00.000Z');
  const task = {
    id: 't1',
    title: 'test',
    tag: 'admin',
    startTime: new Date('2025-08-12T08:00:00.000Z'),
    endTime: new Date('2025-08-12T09:00:00.000Z'), // equal to targetDate => empty window previously
    estimatedDuration: 60,
    isAutoSchedule: true,
    priority: 3,
  } as any;

  let capturedQuery: any = null;
  const originalFind = (ScheduleItem as any).find;
  (ScheduleItem as any).find = (query: any) => {
    capturedQuery = query;
    return { sort: () => Promise.resolve([]) };
  };

  try {
    await svc.getScheduleItemsWithBuffer(userId, targetDate, task, []);
    const start = capturedQuery?.startTime?.$gte as Date;
    const end = capturedQuery?.startTime?.$lt as Date;

    const ok = !!start && !!end && end > start && Math.abs((end.getTime() - addDays(targetDate, 7).getTime())) < 1000;
    log(ok, 'getScheduleItemsWithBuffer widens zero-length window to targetDate + 7d', { start, end });
  } catch (e) {
    log(false, 'getScheduleItemsWithBuffer widens zero-length window to targetDate + 7d', { error: String(e) });
  } finally {
    (ScheduleItem as any).find = originalFind;
  }
}

async function test_rescheduleTasksForNewEvent_overlapGuard() {
  const svc = new SmartSchedulingService();
  const svcAny: any = svc as any;

  const event: IScheduleItem = {
    userId: 'user1',
    title: 'meet1',
    startTime: new Date('2025-08-12T08:00:00.000Z'),
    endTime: new Date('2025-08-12T09:00:00.000Z'),
    type: 'event'
  } as any;

  const taskDoc: Partial<ITask> & { save: () => Promise<void> } = {
    _id: 'task1' as any,
    id: 'task1' as any,
    userId: 'user1',
    title: 'rick',
    isAutoSchedule: true,
    startTime: new Date('2025-08-12T08:00:00.000Z'),
    endTime: new Date('2025-08-12T09:00:00.000Z'),
    status: 'pending' as any,
    save: async () => {}
  } as any;

  // Stub Task.find to return one conflicting task
  const originalTaskFind = (Task as any).find;
  (Task as any).find = async () => [taskDoc];

  // Force findOptimalTimeForTask to return the same overlapping slot
  const originalFindOptimal = (svc as any).findOptimalTimeForTask;
  svcAny.findOptimalTimeForTask = async () => ({
    startTime: new Date('2025-08-12T08:00:00.000Z'),
    endTime: new Date('2025-08-12T09:00:00.000Z')
  });

  // Capture notifications
  const sent: Array<{ type: NotificationType; data: any }> = [];
  const originalNotify = (svcAny.notificationService as any).sendNotification;
  (svcAny.notificationService as any).sendNotification = async (type: NotificationType, _userId: string, data: any) => {
    sent.push({ type, data });
    return { id: 'notif' } as any;
  };

  // Stub ScheduleItem.update to detect unintended updates
  const originalSIUpdate = (ScheduleItem as any).findOneAndUpdate;
  let updated = false;
  (ScheduleItem as any).findOneAndUpdate = async () => { updated = true; };

  try {
    await svc.rescheduleTasksForNewEvent(event);
    const noOverlapReschedule = !updated;
    const notifiedNoSlot = sent.some(s => s.type === NotificationType.NO_OPTIMAL_TIME);
    log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewEvent rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { updated, sent });
  } catch (e) {
    log(false, 'rescheduleTasksForNewEvent rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { error: String(e) });
  } finally {
    (Task as any).find = originalTaskFind;
    (svc as any).findOptimalTimeForTask = originalFindOptimal;
    (svcAny.notificationService as any).sendNotification = originalNotify;
    (ScheduleItem as any).findOneAndUpdate = originalSIUpdate;
  }
}

(async () => {
  await test_getScheduleItemsWithBuffer_windowWiden();
  await test_rescheduleTasksForNewEvent_overlapGuard();
})();

async function test_rescheduleTasksForNewManualTask_overlapGuard() {
  const svc = new SmartSchedulingService();
  const svcAny: any = svc as any;

  const manualTask: ITask = {
    _id: 'manual1' as any,
    id: 'manual1' as any,
    userId: 'user1',
    title: 'manual-block',
    isAutoSchedule: false,
    startTime: new Date('2025-08-12T15:00:00.000Z'),
    endTime: new Date('2025-08-12T16:00:00.000Z')
  } as any;

  const autoTaskDoc: Partial<ITask> & { save: () => Promise<void> } = {
    _id: 'auto1' as any,
    id: 'auto1' as any,
    userId: 'user1',
    title: 'auto',
    isAutoSchedule: true,
    startTime: new Date('2025-08-12T15:00:00.000Z'),
    endTime: new Date('2025-08-12T16:00:00.000Z'),
    status: 'pending' as any,
    save: async () => {}
  } as any;

  // Stub Task.find to return the conflicting auto task
  const originalTaskFind = (Task as any).find;
  (Task as any).find = async () => [autoTaskDoc];

  // Force findOptimalTimeForTask to return an overlapping slot with manual (15:00-16:00)
  const originalFindOptimal = (svc as any).findOptimalTimeForTask;
  svcAny.findOptimalTimeForTask = async () => ({
    startTime: new Date('2025-08-12T15:00:00.000Z'),
    endTime: new Date('2025-08-12T16:00:00.000Z')
  });

  // Return no other schedule items (so only overlap with manual is the reason to reject)
  const originalGetSched = svcAny.getScheduleItemsWithBuffer;
  svcAny.getScheduleItemsWithBuffer = async () => ([]);

  // Capture notifications and prevent updates
  const sent: Array<{ type: NotificationType; data: any }> = [];
  const originalNotify = (svcAny.notificationService as any).sendNotification;
  (svcAny.notificationService as any).sendNotification = async (type: NotificationType, _userId: string, data: any) => {
    sent.push({ type, data });
    return { id: 'notif' } as any;
  };
  const originalSIUpdate = (ScheduleItem as any).findOneAndUpdate;
  let updated = false;
  (ScheduleItem as any).findOneAndUpdate = async () => { updated = true; };

  try {
    await svc.rescheduleTasksForNewManualTask(manualTask);
    const noOverlapReschedule = !updated;
    const notifiedNoSlot = sent.some(s => s.type === NotificationType.NO_OPTIMAL_TIME);
    log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewManualTask rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { updated, sent });
  } catch (e) {
    log(false, 'rescheduleTasksForNewManualTask rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { error: String(e) });
  } finally {
    (Task as any).find = originalTaskFind;
    (svc as any).findOptimalTimeForTask = originalFindOptimal;
    svcAny.getScheduleItemsWithBuffer = originalGetSched;
    (svcAny.notificationService as any).sendNotification = originalNotify;
    (ScheduleItem as any).findOneAndUpdate = originalSIUpdate;
  }
}

(async () => {
  await test_rescheduleTasksForNewManualTask_overlapGuard();
})();
