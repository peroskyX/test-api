"use strict";
/*
 Manual test runner for SmartSchedulingService behaviors.
 Run with ts-node or compile then run.

 Tests:
 1) getScheduleItemsWithBuffer should widen empty window when targetDate === task.endTime
 2) rescheduleTasksForNewEvent should not reschedule into overlapping event window and should send NO_OPTIMAL_TIME
*/
Object.defineProperty(exports, "__esModule", { value: true });
const date_fns_1 = require("date-fns");
const smartSchedulingService_1 = require("../services/smartSchedulingService");
const models_1 = require("../models");
const notificationService_1 = require("../services/notificationService");
function log(ok, name, details) {
    const status = ok ? 'PASS' : 'FAIL';
    const extra = details ? `\n  Details: ${JSON.stringify(details)}` : '';
    console.log(`[${status}] ${name}${extra}`);
}
(async function test_rescheduleTasksForNewEvent_respectsOtherEvents() {
    const svc = new smartSchedulingService_1.SmartSchedulingService();
    const svcAny = svc;
    const event = {
        userId: 'user1',
        title: 'meet2',
        startTime: new Date('2025-08-12T15:00:00.000Z'),
        endTime: new Date('2025-08-12T16:00:00.000Z'),
        type: 'event'
    };
    const taskDoc = {
        _id: 'task2',
        id: 'task2',
        userId: 'user1',
        title: 'rick2',
        isAutoSchedule: true,
        startTime: new Date('2025-08-12T15:00:00.000Z'),
        endTime: new Date('2025-08-12T16:00:00.000Z'),
        status: 'pending',
        save: async () => { }
    };
    // Stub Task.find to return one conflicting task
    const originalTaskFind = models_1.Task.find;
    models_1.Task.find = async () => [taskDoc];
    // Force findOptimalTimeForTask to return an overlapping slot 08:00-09:00
    const originalFindOptimal = svc.findOptimalTimeForTask;
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
            endTime: new Date('2025-08-12T09:10:00.000Z'), // buffered later by 10 mins
            type: 'event'
        }]);
    // Capture notifications
    const sent = [];
    const originalNotify = svcAny.notificationService.sendNotification;
    svcAny.notificationService.sendNotification = async (type, _userId, data) => {
        sent.push({ type, data });
        return { id: 'notif' };
    };
    // Stub ScheduleItem.update to detect unintended updates
    const originalSIUpdate = models_1.ScheduleItem.findOneAndUpdate;
    let updated = false;
    models_1.ScheduleItem.findOneAndUpdate = async () => { updated = true; };
    try {
        await svc.rescheduleTasksForNewEvent(event);
        const noOverlapReschedule = !updated;
        const notifiedNoSlot = sent.some(s => s.type === notificationService_1.NotificationType.NO_OPTIMAL_TIME);
        log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewEvent considers other events (meet1) and avoids overlapping slots', { updated, sent });
    }
    catch (e) {
        log(false, 'rescheduleTasksForNewEvent considers other events (meet1) and avoids overlapping slots', { error: String(e) });
    }
    finally {
        models_1.Task.find = originalTaskFind;
        svc.findOptimalTimeForTask = originalFindOptimal;
        svcAny.getScheduleItemsWithBuffer = originalGetSched;
        svcAny.notificationService.sendNotification = originalNotify;
        models_1.ScheduleItem.findOneAndUpdate = originalSIUpdate;
    }
})();
async function test_getScheduleItemsWithBuffer_windowWiden() {
    const svc = new smartSchedulingService_1.SmartSchedulingService();
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
    };
    let capturedQuery = null;
    const originalFind = models_1.ScheduleItem.find;
    models_1.ScheduleItem.find = (query) => {
        capturedQuery = query;
        return { sort: () => Promise.resolve([]) };
    };
    try {
        await svc.getScheduleItemsWithBuffer(userId, targetDate, task, []);
        const start = capturedQuery?.startTime?.$gte;
        const end = capturedQuery?.startTime?.$lt;
        const ok = !!start && !!end && end > start && Math.abs((end.getTime() - (0, date_fns_1.addDays)(targetDate, 7).getTime())) < 1000;
        log(ok, 'getScheduleItemsWithBuffer widens zero-length window to targetDate + 7d', { start, end });
    }
    catch (e) {
        log(false, 'getScheduleItemsWithBuffer widens zero-length window to targetDate + 7d', { error: String(e) });
    }
    finally {
        models_1.ScheduleItem.find = originalFind;
    }
}
async function test_rescheduleTasksForNewEvent_overlapGuard() {
    const svc = new smartSchedulingService_1.SmartSchedulingService();
    const svcAny = svc;
    const event = {
        userId: 'user1',
        title: 'meet1',
        startTime: new Date('2025-08-12T08:00:00.000Z'),
        endTime: new Date('2025-08-12T09:00:00.000Z'),
        type: 'event'
    };
    const taskDoc = {
        _id: 'task1',
        id: 'task1',
        userId: 'user1',
        title: 'rick',
        isAutoSchedule: true,
        startTime: new Date('2025-08-12T08:00:00.000Z'),
        endTime: new Date('2025-08-12T09:00:00.000Z'),
        status: 'pending',
        save: async () => { }
    };
    // Stub Task.find to return one conflicting task
    const originalTaskFind = models_1.Task.find;
    models_1.Task.find = async () => [taskDoc];
    // Force findOptimalTimeForTask to return the same overlapping slot
    const originalFindOptimal = svc.findOptimalTimeForTask;
    svcAny.findOptimalTimeForTask = async () => ({
        startTime: new Date('2025-08-12T08:00:00.000Z'),
        endTime: new Date('2025-08-12T09:00:00.000Z')
    });
    // Capture notifications
    const sent = [];
    const originalNotify = svcAny.notificationService.sendNotification;
    svcAny.notificationService.sendNotification = async (type, _userId, data) => {
        sent.push({ type, data });
        return { id: 'notif' };
    };
    // Stub ScheduleItem.update to detect unintended updates
    const originalSIUpdate = models_1.ScheduleItem.findOneAndUpdate;
    let updated = false;
    models_1.ScheduleItem.findOneAndUpdate = async () => { updated = true; };
    try {
        await svc.rescheduleTasksForNewEvent(event);
        const noOverlapReschedule = !updated;
        const notifiedNoSlot = sent.some(s => s.type === notificationService_1.NotificationType.NO_OPTIMAL_TIME);
        log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewEvent rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { updated, sent });
    }
    catch (e) {
        log(false, 'rescheduleTasksForNewEvent rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { error: String(e) });
    }
    finally {
        models_1.Task.find = originalTaskFind;
        svc.findOptimalTimeForTask = originalFindOptimal;
        svcAny.notificationService.sendNotification = originalNotify;
        models_1.ScheduleItem.findOneAndUpdate = originalSIUpdate;
    }
}
(async () => {
    await test_getScheduleItemsWithBuffer_windowWiden();
    await test_rescheduleTasksForNewEvent_overlapGuard();
})();
async function test_rescheduleTasksForNewManualTask_overlapGuard() {
    const svc = new smartSchedulingService_1.SmartSchedulingService();
    const svcAny = svc;
    const manualTask = {
        _id: 'manual1',
        id: 'manual1',
        userId: 'user1',
        title: 'manual-block',
        isAutoSchedule: false,
        startTime: new Date('2025-08-12T15:00:00.000Z'),
        endTime: new Date('2025-08-12T16:00:00.000Z')
    };
    const autoTaskDoc = {
        _id: 'auto1',
        id: 'auto1',
        userId: 'user1',
        title: 'auto',
        isAutoSchedule: true,
        startTime: new Date('2025-08-12T15:00:00.000Z'),
        endTime: new Date('2025-08-12T16:00:00.000Z'),
        status: 'pending',
        save: async () => { }
    };
    // Stub Task.find to return the conflicting auto task
    const originalTaskFind = models_1.Task.find;
    models_1.Task.find = async () => [autoTaskDoc];
    // Force findOptimalTimeForTask to return an overlapping slot with manual (15:00-16:00)
    const originalFindOptimal = svc.findOptimalTimeForTask;
    svcAny.findOptimalTimeForTask = async () => ({
        startTime: new Date('2025-08-12T15:00:00.000Z'),
        endTime: new Date('2025-08-12T16:00:00.000Z')
    });
    // Return no other schedule items (so only overlap with manual is the reason to reject)
    const originalGetSched = svcAny.getScheduleItemsWithBuffer;
    svcAny.getScheduleItemsWithBuffer = async () => ([]);
    // Capture notifications and prevent updates
    const sent = [];
    const originalNotify = svcAny.notificationService.sendNotification;
    svcAny.notificationService.sendNotification = async (type, _userId, data) => {
        sent.push({ type, data });
        return { id: 'notif' };
    };
    const originalSIUpdate = models_1.ScheduleItem.findOneAndUpdate;
    let updated = false;
    models_1.ScheduleItem.findOneAndUpdate = async () => { updated = true; };
    try {
        await svc.rescheduleTasksForNewManualTask(manualTask);
        const noOverlapReschedule = !updated;
        const notifiedNoSlot = sent.some(s => s.type === notificationService_1.NotificationType.NO_OPTIMAL_TIME);
        log(noOverlapReschedule && notifiedNoSlot, 'rescheduleTasksForNewManualTask rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { updated, sent });
    }
    catch (e) {
        log(false, 'rescheduleTasksForNewManualTask rejects overlapping reschedule and notifies NO_OPTIMAL_TIME', { error: String(e) });
    }
    finally {
        models_1.Task.find = originalTaskFind;
        svc.findOptimalTimeForTask = originalFindOptimal;
        svcAny.getScheduleItemsWithBuffer = originalGetSched;
        svcAny.notificationService.sendNotification = originalNotify;
        models_1.ScheduleItem.findOneAndUpdate = originalSIUpdate;
    }
}
(async () => {
    await test_rescheduleTasksForNewManualTask_overlapGuard();
})();
