# Smart Scheduling API Documentation

## Overview

This API powers a smart scheduling system that manages tasks, energy levels, and schedule items. The API is secured with JWT authentication and allows users to manage their tasks and schedules efficiently.

Base URL: `http://localhost:3000/api`

## Authentication

The API uses JWT (JSON Web Token) authentication. To access protected endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer <your_token>
```

### Authentication Endpoints

#### Register a New User

**Endpoint:** `POST /auth/register`

**Description:** Creates a new user account

**Request Body:**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Required Fields:**
- `username` - Must be unique, 3-30 characters
- `email` - Must be unique, valid email format
- `password` - User's password

**Optional Fields:**
- `firstName` - User's first name
- `lastName` - User's last name

**Response (201 Success):**
```json
{
  "_id": "user_id",
  "username": "testuser",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "token": "jwt_token"
}
```

**Response (400 Error):**
```json
{
  "error": "User with this email or username already exists"
}
```

#### User Login

**Endpoint:** `POST /auth/login`

**Description:** Authenticates a user and returns a JWT token

**Request Body:**
```json
{
  "username": "testuser",
  "password": "securepassword"
}
```

**Note:** You can use either `username` or `email` in the `username` field

**Response (200 Success):**
```json
{
  "_id": "user_id",
  "username": "testuser",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "token": "jwt_token"
}
```

**Response (401 Error):**
```json
{
  "error": "Invalid username or password"
}
```

#### Get User Profile

**Endpoint:** `GET /auth/profile`

**Description:** Returns the authenticated user's profile information

**Authentication:** Required

**Response (200 Success):**
```json
{
  "_id": "user_id",
  "username": "testuser",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

## Tasks

Tasks represent activities that can be scheduled for users.

### Task Endpoints

#### Create a New Task

**Endpoint:** `POST /tasks`

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Important meeting",
  "description": "Project kickoff meeting",
  "estimatedDuration": 60,
  "priority": 3,
  "tag": "admin",
  "scheduleType": "fixed",
  "isAutoSchedule": true,
  "profileId": "profile_id"
}
```

**Required Fields:**
- `title` - Task title
- `estimatedDuration` - Estimated duration in minutes
- `tag` - One of: "deep", "creative", "admin", "personal"
- `profileId` - User's profile ID

**Optional Fields:**
- `description` - Task description
- `priority` - Priority level from 1 (lowest) to 5 (highest), default: 3
- `scheduleType` - Type of scheduling, default: "flexible"
- `isAutoSchedule` - Whether to auto-schedule, default: true
- `isChunked` - Whether the task is chunked, default: false
- `parentTaskId` - ID of parent task if this is a subtask
- `startTime` - Specific start time if scheduled
- `endTime` - Specific end time if scheduled

**Response (201 Success):**
```json
{
  "_id": "task_id",
  "title": "Important meeting",
  "userId": "user_id",
  "description": "Project kickoff meeting",
  "estimatedDuration": 60,
  "priority": 3,
  "status": "pending",
  "tag": "admin",
  "scheduleType": "fixed",
  "isAutoSchedule": true,
  "isChunked": false,
  "chunks": [],
  "profileId": "profile_id",
  "subtasks": [],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### Get All Tasks

**Endpoint:** `GET /tasks`

**Authentication:** Required

**Query Parameters:**
- `status` (optional) - Filter by status: "pending" or "completed"
- `startDate` (optional) - Filter by start date (ISO format)
- `endDate` (optional) - Filter by end date (ISO format)

**Response (200 Success):**
```json
[
  {
    "_id": "task_id",
    "title": "Important meeting",
    "userId": "user_id",
    "description": "Project kickoff meeting",
    "estimatedDuration": 60,
    "priority": 3,
    "status": "pending",
    "tag": "admin",
    "scheduleType": "fixed",
    "isAutoSchedule": true,
    "isChunked": false,
    "startTime": "timestamp",
    "endTime": "timestamp",
    "profileId": "profile_id",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
]
```

#### Get a Specific Task

**Endpoint:** `GET /tasks/:id`

**Authentication:** Required

**Response (200 Success):**
```json
{
  "_id": "task_id",
  "title": "Important meeting",
  "userId": "user_id",
  "description": "Project kickoff meeting",
  "estimatedDuration": 60,
  "priority": 3,
  "status": "pending",
  "tag": "admin",
  "scheduleType": "fixed",
  "isAutoSchedule": true,
  "isChunked": false,
  "startTime": "timestamp",
  "endTime": "timestamp",
  "profileId": "profile_id",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Response (404 Error):**
```json
{
  "error": "Task not found"
}
```

#### Update a Task

**Endpoint:** `PUT /tasks/:id`

**Authentication:** Required

**Request Body:** Any fields that need to be updated

```json
{
  "title": "Updated meeting title",
  "status": "completed",
  "priority": 4
}
```

**Response (200 Success):**
```json
{
  "_id": "task_id",
  "title": "Updated meeting title",
  "status": "completed",
  "priority": 4,
  ...other task fields
}
```

**Response (404 Error):**
```json
{
  "error": "Task not found"
}
```

#### Delete a Task

**Endpoint:** `DELETE /tasks/:id`

**Authentication:** Required

**Response (204 Success):** No content

**Response (404 Error):**
```json
{
  "error": "Task not found"
}
```

#### Reschedule a Task

**Endpoint:** `POST /tasks/:id/reschedule`

**Authentication:** Required

**Response (200 Success):** Updated task object

**Response (409 Error):**
```json
{
  "message": "Could not find an optimal time to reschedule the task."
}
```

## Schedule Items

Schedule items represent events or tasks placed on a user's calendar.

### Schedule Endpoints

#### Add a Schedule Item

**Endpoint:** `POST /schedule`

**Authentication:** Required

**Request Body:**
```json
{
  "title": "Team Meeting",
  "startTime": "2025-07-27T15:00:00.000Z",
  "endTime": "2025-07-27T16:00:00.000Z",
  "type": "event"
}
```

**Required Fields:**
- `title` - Item title
- `startTime` - Start time (ISO format)
- `endTime` - End time (ISO format)
- `type` - Either "event" or "task"

**Optional Fields:**
- `taskId` - Reference to a task (only if type is "task")

**Response (201 Success):**
```json
{
  "_id": "schedule_item_id",
  "userId": "user_id",
  "title": "Team Meeting",
  "startTime": "2025-07-27T15:00:00.000Z",
  "endTime": "2025-07-27T16:00:00.000Z",
  "type": "event",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

#### Get Schedule Items

**Endpoint:** `GET /schedule`

**Authentication:** Required

**Query Parameters:**
- `type` (optional) - Filter by type: "event" or "task"
- `startDate` (optional) - Filter by start date (ISO format)
- `endDate` (optional) - Filter by end date (ISO format)

**Response (200 Success):**
```json
[
  {
    "_id": "schedule_item_id",
    "userId": "user_id",
    "title": "Team Meeting",
    "startTime": "2025-07-27T15:00:00.000Z",
    "endTime": "2025-07-27T16:00:00.000Z",
    "type": "event",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
]
```

#### Delete a Schedule Item

**Endpoint:** `DELETE /schedule/:id`

**Authentication:** Required

**Response (204 Success):** No content

**Response (404 Error):**
```json
{
  "error": "Schedule item not found"
}
```

## Energy

Energy tracking endpoints for monitoring user energy levels throughout the day.

### Energy Endpoints

These are not documented in detail due to lack of source code access, but they would follow similar authentication patterns as Tasks and Schedule Items.

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `201` - Resource created
- `204` - Success, no content returned
- `400` - Bad request (invalid input)
- `401` - Unauthorized (invalid or missing authentication)
- `404` - Resource not found
- `409` - Conflict (e.g., scheduling conflict)
- `500` - Server error

Error responses include a JSON object with an `error` field containing the error message.

## Security Notes

- All endpoints except `/auth/register` and `/auth/login` require authentication
- JWT tokens expire after 30 days
- Store tokens securely and never expose them in client-side code
- Use HTTPS in production environments
