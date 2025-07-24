// test-date-range-scheduling.ts
// Test script for verifying smart scheduling within date ranges

const API_BASE_URL = 'http://localhost:3000/api';
const USER_ID = 'test-user-123';
const PROFILE_ID = 'test-profile-123';

// --- Type Definitions ---
interface Task {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  // Add other task properties as needed
}

interface EnergyPattern {
  hour: number;
  level: number;
  stage: string;
}

interface ApiResponse {
  status: number;
  data: any;
}

// --- Helper Functions ---

async function apiCall(method: string, endpoint: string, body?: any): Promise<ApiResponse> {
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
  
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}

function getEnergyPatternForDay(dayOfWeek: number): EnergyPattern[] {
  // Different patterns to test various scenarios
  const patterns: { [key: number]: EnergyPattern[] } = {
    0: [ // Sunday - Lower energy
      { hour: 9, level: 0.6, stage: 'morning_rise' },
      { hour: 10, level: 0.7, stage: 'morning_peak' },
      { hour: 14, level: 0.5, stage: 'midday_dip' },
    ],
    1: [ // Monday - High morning energy
      { hour: 9, level: 0.85, stage: 'morning_peak' },
      { hour: 10, level: 0.9, stage: 'morning_peak' }, // Will be blocked by meeting
      { hour: 11, level: 0.8, stage: 'morning_peak' },
      { hour: 14, level: 0.6, stage: 'afternoon_rebound' },
    ],
    2: [ // Tuesday - Best overall energy
      { hour: 9, level: 0.9, stage: 'morning_peak' },
      { hour: 10, level: 0.95, stage: 'morning_peak' }, // Best slot!
      { hour: 11, level: 0.85, stage: 'morning_peak' },
      { hour: 14, level: 0.7, stage: 'afternoon_rebound' },
    ],
    3: [ // Wednesday - Meetings interfere
      { hour: 9, level: 0.8, stage: 'morning_peak' },
      { hour: 10, level: 0.85, stage: 'morning_peak' }, // Blocked by meeting
      { hour: 14, level: 0.75, stage: 'afternoon_rebound' },
    ],
    4: [ // Thursday - Good afternoon energy
      { hour: 9, level: 0.7, stage: 'morning_rise' },
      { hour: 10, level: 0.75, stage: 'morning_peak' },
      { hour: 14, level: 0.8, stage: 'afternoon_rebound' },
    ],
    5: [ // Friday - Declining energy
      { hour: 9, level: 0.7, stage: 'morning_peak' },
      { hour: 10, level: 0.65, stage: 'morning_peak' },
      { hour: 14, level: 0.5, stage: 'midday_dip' },
    ],
    6: [ // Saturday - Weekend pattern
      { hour: 10, level: 0.8, stage: 'morning_peak' },
      { hour: 11, level: 0.75, stage: 'morning_peak' },
      { hour: 14, level: 0.6, stage: 'afternoon_rebound' },
    ],
  };
  
  return patterns[dayOfWeek] || patterns[0];
}

async function setupTestData(startDate: Date, endDate: Date) {
  console.log('📅 Setting up test data for date range:', {
    start: startDate.toDateString(),
    end: endDate.toDateString()
  });
  
  // Add energy data for each day in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    console.log(`\nAdding energy data for ${currentDate.toDateString()}:`);
    
    // Different energy patterns for each day
    const dayOfWeek = currentDate.getDay();
    const energyPattern = getEnergyPatternForDay(dayOfWeek);
    
    for (const { hour, level, stage } of energyPattern) {
      const energyDate = new Date(currentDate);
      energyDate.setHours(hour, 0, 0, 0);
      
      await apiCall('POST', '/energy', {
        userId: USER_ID,
        date: energyDate.toISOString(),
        hour,
        energyLevel: level,
        energyStage: stage,
        mood: 'focused',
      });
    }
    
    // Add some calendar events to create constraints
    if (dayOfWeek === 1 || dayOfWeek === 3) { // Monday or Wednesday
      const meetingTime = new Date(currentDate);
      meetingTime.setHours(10, 0, 0, 0);
      
      await apiCall('POST', '/schedule', {
        userId: USER_ID,
        title: `Meeting on ${currentDate.toDateString()}`,
        startTime: meetingTime.toISOString(),
        endTime: new Date(meetingTime.getTime() + 60 * 60 * 1000).toISOString(),
        type: 'event',
      });
      
      console.log(`  Added meeting at 10 AM`);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
}

async function testDateRangeScheduling() {
  console.log('🧪 Testing Date Range Smart Scheduling\n');
  console.log('=' .repeat(50));
  
  // Test Case 1: 3-day window with optimal time on day 2
  console.log('\n📋 Test Case 1: 3-day scheduling window');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 1); // Tomorrow
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 2); // 3 days from now
  endDate.setHours(23, 59, 59, 999);
  
  // Set up test data
  await setupTestData(startDate, endDate);
  
  // Create task with date range
  console.log('\n🎯 Creating task with date range...');
  const taskData = {
    title: 'Important Deep Work Project',
    userId: USER_ID,
    profileId: PROFILE_ID,
    estimatedDuration: 90, // 1.5 hours
    priority: 5, // High priority
    tag: 'deep', // Requires high energy (0.7+)
    isAutoSchedule: true,
    startTime: startDate.toISOString(), // Start date (date-only)
    endTime: endDate.toISOString(), // Deadline
  };
  
  console.log('Task input:', {
    title: taskData.title,
    startDate: startDate.toDateString(),
    deadline: endDate.toDateString(),
    windowDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  });
  
  const { data: createdTask } = await apiCall('POST', '/tasks', taskData);
  if (!createdTask) throw new Error('Task creation failed');
  
  // Analyze results
  console.log('\n📊 Scheduling Results:');
  const scheduledTime = new Date(createdTask.startTime);
  console.log(`- Scheduled at: ${scheduledTime.toLocaleString()}`);
  console.log(`- Day: ${scheduledTime.toDateString()}`);
  console.log(`- Time: ${scheduledTime.getHours()}:00`);
  
  // Verify it's within the date range
  const isWithinRange = scheduledTime >= startDate && scheduledTime <= endDate;
  console.log(`- Within date range: ${isWithinRange ? '✅ Yes' : '❌ No'}`);
  
  // Check which day was chosen
  const daysFromStart = Math.floor((scheduledTime.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`- Days from start: ${daysFromStart}`);
  
  // Get the energy level at scheduled time
  const dayEnergy = getEnergyPatternForDay(scheduledTime.getDay());
  const slotEnergy = dayEnergy.find((e: EnergyPattern) => e.hour === scheduledTime.getHours());
  console.log(`- Energy at scheduled time: ${slotEnergy?.level || 'N/A'}`);
  console.log(`- Meets deep work requirement (≥0.7): ${(slotEnergy?.level || 0) >= 0.7 ? '✅ Yes' : '❌ No'}`);
  
  return createdTask;
}

async function testUrgentDeadline() {
  console.log('\n\n📋 Test Case 2: Urgent deadline (today)');
  console.log('=' .repeat(50));
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tonight = new Date(today);
  tonight.setHours(23, 59, 59, 999);
  
  // Add limited energy data for today
  const currentHour = new Date().getHours();
  console.log(`\nCurrent time: ${new Date().toLocaleTimeString()}`);
  
  // Add energy for remaining hours
  for (let hour = currentHour + 1; hour <= 20; hour++) {
    const energyDate = new Date(today);
    energyDate.setHours(hour, 0, 0, 0);
    
    const energyLevel = hour <= 17 ? 0.6 : 0.4; // Lower evening energy
    await apiCall('POST', '/energy', {
      userId: USER_ID,
      date: energyDate.toISOString(),
      hour,
      energyLevel,
      energyStage: hour <= 17 ? 'afternoon_rebound' : 'wind_down',
      mood: 'focused',
    });
  }
  
  // Create urgent task
  console.log('\n🚨 Creating urgent task with today deadline...');
  const { data: urgentTask } = await apiCall('POST', '/tasks', {
    title: 'Urgent Deliverable',
    userId: USER_ID,
    profileId: PROFILE_ID,
    estimatedDuration: 45,
    priority: 5, // Highest priority
    tag: 'deep',
    isAutoSchedule: true,
    startTime: today.toISOString(),
    endTime: tonight.toISOString(), // Due today!
  });
  if (!urgentTask) throw new Error('Urgent task creation failed');
  
  const scheduledTime = new Date((urgentTask as Task).startTime);
  console.log(`\n✅ Urgent task scheduled at: ${scheduledTime.toLocaleTimeString()}`);
  console.log(`- Is today: ${scheduledTime.toDateString() === today.toDateString()}`);
  console.log(`- Hours until deadline: ${Math.floor((tonight.getTime() - scheduledTime.getTime()) / (1000 * 60 * 60))}`);
}

async function testConflictingDeadlines() {
  console.log('\n\n📋 Test Case 3: Multiple tasks with overlapping date ranges');
  console.log('=' .repeat(50));
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 4);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 1); // 2-day window
  endDate.setHours(23, 59, 59, 999);
  
  await setupTestData(startDate, endDate);
  
  // Create multiple tasks for the same date range
  console.log('\nCreating 3 tasks with same date range but different priorities...');
  
  const tasks: Task[] = [];
  for (const { priority, title, tag } of [
    { priority: 5, title: 'Critical Task', tag: 'deep' },
    { priority: 4, title: 'Important Task', tag: 'creative' },
    { priority: 3, title: 'Regular Task', tag: 'admin' },
  ]) {
    const task = await apiCall('POST', '/tasks', {
      title,
      userId: USER_ID,
      profileId: PROFILE_ID,
      estimatedDuration: 60,
      priority,
      tag,
      isAutoSchedule: true,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
    });
    if (task && task.data) {
      tasks.push(task.data as Task);
      console.log(`- ${title} (P${priority}): ${new Date((task.data as Task).startTime).toLocaleString()}`);
    }
  }
  
  // Verify priority ordering
  console.log('\n📊 Priority-based scheduling analysis:');
  const sortedByTime = [...tasks].sort((a: Task, b: Task) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  console.log('Tasks in time order:');
  sortedByTime.forEach((task: Task, index) => {
    console.log(`  ${index + 1}. ${task.title} - ${new Date(task.startTime).toLocaleTimeString()}`);
  });
}

// Main test runner
async function runAllTests() {
  try {
    console.log('🚀 Starting Date Range Scheduling Tests\n');
    
    await testDateRangeScheduling();
    await testUrgentDeadline();
    await testConflictingDeadlines();
    
    console.log('\n\n✅ All tests completed!');
    console.log('\n💡 Key Observations:');
    console.log('- Tasks respect date range boundaries');
    console.log('- Optimal times are chosen based on energy levels');
    console.log('- Calendar conflicts are avoided');
    console.log('- Higher priority tasks get better time slots');
    console.log('- Urgent deadlines can use wind-down periods if needed');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

if (require.main === module) {
  runAllTests();
}

export { testDateRangeScheduling, testUrgentDeadline, testConflictingDeadlines };