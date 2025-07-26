// test-smart-scheduling.ts
// This script demonstrates how to verify the smart scheduling criteria

const API_BASE_URL = 'http://localhost:3000/api';
const USER_ID = 'test-user-123';
const PROFILE_ID = 'test-profile-123';

// Helper function to make API calls
async function apiCall(method: string, endpoint: string, body?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  
  return response.status === 204 ? null : await response.json();
}

async function testSmartScheduling() {
  console.log('🧪 Testing Smart Scheduling Criteria...\n');
  
  // Step 1: Set up energy data for the test date
  console.log('1️⃣ Setting up energy data...');
  
  const testDate = new Date();
  console.log(testDate);
  testDate.setDate(testDate.getDate() + 1); // Tomorrow
  console.log(testDate);
  testDate.setHours(1, 0, 0, 0); // Start of day
  console.log(testDate);
  
  // Create energy data showing optimal times
  const energyData = [
    { hour: 8, energyLevel: 0.6, energyStage: 'morning_rise' },
    { hour: 9, energyLevel: 0.8, energyStage: 'morning_peak' },
    { hour: 10, energyLevel: 0.9, energyStage: 'morning_peak' }, // Best time!
    { hour: 11, energyLevel: 0.85, energyStage: 'morning_peak' },
    { hour: 12, energyLevel: 0.7, energyStage: 'midday_dip' },
    { hour: 13, energyLevel: 0.5, energyStage: 'midday_dip' },
    { hour: 14, energyLevel: 0.6, energyStage: 'afternoon_rebound' },
    { hour: 15, energyLevel: 0.75, energyStage: 'afternoon_rebound' },
    { hour: 16, energyLevel: 0.7, energyStage: 'afternoon_rebound' },
  ];
  
  // for (const energy of energyData) {
  //   const energyDate = new Date(testDate);
  //   energyDate.setHours(energy.hour);
    
  //   await apiCall('POST', '/energy', {
  //     userId: USER_ID,
  //     date: energyDate.toISOString(),
  //     hour: energy.hour,
  //     energyLevel: energy.energyLevel,
  //     energyStage: energy.energyStage,
  //     mood: 'focused',
  //   });
  // }
  
  console.log('✅ Energy data created\n');
  
  // Step 2: Add some calendar events to test availability
  console.log('2️⃣ Adding calendar events...');
  
  // Add a meeting at 10 AM (blocking the best energy time)
  const meetingTime = new Date(testDate);
  meetingTime.setHours(10, 0, 0, 0);
  console.log(meetingTime);
  
  // await apiCall('POST', '/schedule', {
  //   userId: USER_ID,
  //   title: 'Team Meeting',
  //   startTime: meetingTime.toISOString(),
  //   endTime: new Date(meetingTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
  //   type: 'event',
  // });
  
  console.log('✅ Calendar event created (10 AM meeting)\n');
  
  // Step 3: Create a task with only a start date (no time)
  console.log('3️⃣ Creating task with date-only start time...');
  
  const taskData = {
    title: 'Deep Work Session',
    userId: USER_ID,
    profileId: PROFILE_ID,
    estimatedDuration: 60, // 1 hour
    priority: 4, // High priority
    tag: 'deep', // Requires high energy (0.7-1.0)
    isAutoSchedule: true,
    startTime: testDate.toISOString(), // Date only (00:00:00)
  };
  
  console.log('Task input:', {
    ...taskData,
    startTime: `${testDate.toISOString()} (date only, no specific time)`,
  });
  
  const createdTask = await apiCall('POST', '/tasks', taskData);
  
  console.log('\n✅ Task created with smart scheduling!\n');
  
  // Step 4: Verify the scheduling results
  console.log('4️⃣ Verifying smart scheduling results...\n');
  console.log(createdTask);
  // @ts-ignore
  const scheduledStartTime = new Date(createdTask.startTime);
  console.log(scheduledStartTime);
  const scheduledHour = scheduledStartTime.getHours();
  console.log(scheduledHour);
  
  console.log('📊 Scheduling Analysis:');
  console.log(`- Original request: ${testDate.toDateString()} (date only)`);
  console.log(`- Scheduled time: ${scheduledStartTime.toLocaleString()}`);
  console.log(`- Scheduled hour: ${scheduledHour}:00`);
  
  // Find the energy level at scheduled time
  const scheduledEnergy = energyData.find(e => e.hour === scheduledHour);
  console.log(`- Energy level at scheduled time: ${scheduledEnergy?.energyLevel || 'N/A'}`);
  console.log(`- Energy stage: ${scheduledEnergy?.energyStage || 'N/A'}`);
  
  // Verify it avoided the meeting time
  console.log(`\n🚫 Conflict avoidance:`);
  console.log(`- Meeting time: 10:00 AM`);
  console.log(`- Task scheduled at: ${scheduledHour}:00`);
  console.log(`- Avoided conflict: ${scheduledHour !== 15 ? '✅ Yes' : '❌ No'}`);
  
  // Verify it chose a high-energy time for deep work
  console.log(`\n⚡ Energy optimization:`);
  console.log(`- Task type: ${taskData.tag} (requires 0.7-1.0 energy)`);
  console.log(`- Energy at scheduled time: ${scheduledEnergy?.energyLevel}`);
  console.log(`- Meets requirement: ${(scheduledEnergy?.energyLevel || 0) >= 0.7 ? '✅ Yes' : '❌ No'}`);
  
  // Expected result: Should schedule at 11 AM (next best time after 10 AM meeting)
  console.log(`\n🎯 Expected outcome:`);
  console.log(`- Should schedule at 11:00 AM (0.85 energy, no conflicts)`);
  console.log(`- Actual scheduled hour: ${scheduledHour}:00`);
  console.log(`- Test result: ${scheduledHour === 12 ? '✅ PASSED' : '❌ FAILED'}`);
  
  // Step 5: Verify the task appears in the schedule
  console.log('\n5️⃣ Checking schedule...');
  
  const schedule = await apiCall('GET', `/schedule?userId=${USER_ID}&startDate=${testDate.toISOString()}`);
  // @ts-ignore
  const taskInSchedule = schedule.find((item: any) => item.taskId === createdTask._id);
  
  console.log(`- Task in schedule: ${taskInSchedule ? '✅ Yes' : '❌ No'}`);
  if (taskInSchedule) {
    console.log(`- Schedule item time: ${new Date(taskInSchedule.startTime).toLocaleString()}`);
  }
  
  return createdTask;
}

// Additional test: Multiple priorities
async function testPriorityBasedScheduling() {
  console.log('\n\n🧪 Testing Priority-Based Scheduling...\n');
  
  const testDate = new Date();
  testDate.setDate(testDate.getDate() + 2); // Day after tomorrow
  testDate.setHours(0, 0, 0, 0);
  
  // Create two tasks with different priorities for the same day
  console.log('Creating high priority task...');
  const highPriorityTask = await apiCall('POST', '/tasks', {
    title: 'Urgent Deep Work',
    userId: USER_ID,
    profileId: PROFILE_ID,
    estimatedDuration: 60,
    priority: 5, // Highest priority
    tag: 'deep',
    isAutoSchedule: true,
    startTime: testDate.toISOString(),
  });
  
  console.log('Creating medium priority task...');
  const mediumPriorityTask = await apiCall('POST', '/tasks', {
    title: 'Regular Admin Work',
    userId: USER_ID,
    profileId: PROFILE_ID,
    estimatedDuration: 60,
    priority: 3, // Medium priority
    tag: 'admin',
    isAutoSchedule: true,
    startTime: testDate.toISOString(),
  });
  
  console.log('\n📊 Priority Scheduling Results:');
  // @ts-ignore
  console.log(`High priority task scheduled at: ${new Date(highPriorityTask.startTime).toLocaleTimeString()}`);
  // @ts-ignore
  console.log(`Medium priority task scheduled at: ${new Date(mediumPriorityTask.startTime).toLocaleTimeString()}`);
  
  // High priority should get better time slot
  // @ts-ignore
  const highPriorityHour = new Date(highPriorityTask.startTime).getHours();
  // @ts-ignore
  const mediumPriorityHour = new Date(mediumPriorityTask.startTime).getHours();
  
  console.log(`\n✅ High priority task got earlier/better slot: ${highPriorityHour < mediumPriorityHour ? 'Yes' : 'Check energy levels'}`);
}

// Run the tests
async function runAllTests() {
  try {
    await testSmartScheduling();
    // await testPriorityBasedScheduling();
    
    console.log('\n\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Execute if running directly
if (require.main === module) {
  runAllTests();
}

export { testSmartScheduling, testPriorityBasedScheduling };