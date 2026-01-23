# Resource, Worker, and Rate API Endpoints

This document describes the Resource, Worker, WorkerType, and Rate management API endpoints implemented for the Program and Project Management System.

## Overview

The API provides comprehensive endpoints for managing:
- **Resources**: Both labor and non-labor resources
- **Worker Types**: Categories of workers with associated rates
- **Workers**: Individual workers with external IDs and type associations
- **Rates**: Historical rate information with temporal validity

All endpoints include scope-based filtering to ensure users only access data within their authorized scope.

## Base URL

All endpoints are prefixed with `/api/v1/`

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Resource Endpoints

### Create Resource
**POST** `/resources/`

Create a new resource (labor or non-labor).

**Request Body:**
```json
{
  "name": "string",
  "resource_type": "labor" | "non_labor",
  "description": "string (optional)"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "resource_type": "labor" | "non_labor",
  "description": "string",
  "assignment_count": 0,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### List Resources
**GET** `/resources/`

Get a paginated list of resources with optional filtering.

**Query Parameters:**
- `page` (int, default: 1): Page number
- `size` (int, default: 10): Page size
- `resource_type` (optional): Filter by resource type
- `search` (optional): Search term for resource name

**Response:** `200 OK`
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "size": 10,
  "pages": 10,
  "has_next": true,
  "has_prev": false
}
```

### Get Resource
**GET** `/resources/{resource_id}`

Retrieve a specific resource by ID.

**Response:** `200 OK` or `404 Not Found`

### Update Resource
**PUT** `/resources/{resource_id}`

Update an existing resource.

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)"
}
```

**Note:** `resource_type` cannot be changed after creation.

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### Delete Resource
**DELETE** `/resources/{resource_id}`

Delete a resource (only if it has no assignments).

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### List Labor Resources
**GET** `/resources/labor/list`

Get a paginated list of labor resources only.

### List Non-Labor Resources
**GET** `/resources/non-labor/list`

Get a paginated list of non-labor resources only.

## Worker Type Endpoints

### Create Worker Type
**POST** `/workers/types`

Create a new worker type category.

**Request Body:**
```json
{
  "type": "string (unique)",
  "description": "string"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "type": "string",
  "description": "string",
  "worker_count": 0,
  "current_rate": "decimal (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### List Worker Types
**GET** `/workers/types`

Get a list of all worker types.

**Query Parameters:**
- `page` (int, default: 1): Page number
- `size` (int, default: 10): Page size
- `search` (optional): Search term for worker type name

**Response:** `200 OK`

### Get Worker Type
**GET** `/workers/types/{worker_type_id}`

Retrieve a specific worker type by ID.

**Response:** `200 OK` or `404 Not Found`

### Get Worker Type by Name
**GET** `/workers/types/name/{type_name}`

Retrieve a specific worker type by its type name.

**Response:** `200 OK` or `404 Not Found`

### Update Worker Type
**PUT** `/workers/types/{worker_type_id}`

Update an existing worker type.

**Request Body:**
```json
{
  "type": "string (optional)",
  "description": "string (optional)"
}
```

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### Delete Worker Type
**DELETE** `/workers/types/{worker_type_id}`

Delete a worker type (only if it has no associated workers).

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

## Worker Endpoints

### Create Worker
**POST** `/workers/`

Create a new worker with worker type association.

**Request Body:**
```json
{
  "external_id": "string (unique)",
  "name": "string",
  "worker_type_id": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "external_id": "string",
  "name": "string",
  "worker_type_id": "uuid",
  "worker_type_name": "string",
  "current_rate": "decimal (optional)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### List Workers
**GET** `/workers/`

Get a paginated list of workers with optional filtering.

**Query Parameters:**
- `page` (int, default: 1): Page number
- `size` (int, default: 10): Page size
- `worker_type_id` (optional): Filter by worker type
- `search` (optional): Search term for worker name

**Response:** `200 OK`

### Get Worker
**GET** `/workers/{worker_id}`

Retrieve a specific worker by ID.

**Response:** `200 OK` or `404 Not Found`

### Get Worker by External ID
**GET** `/workers/external/{external_id}`

Retrieve a specific worker by its external ID.

**Response:** `200 OK` or `404 Not Found`

### Update Worker
**PUT** `/workers/{worker_id}`

Update an existing worker.

**Request Body:**
```json
{
  "external_id": "string (optional)",
  "name": "string (optional)",
  "worker_type_id": "uuid (optional)"
}
```

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### Delete Worker
**DELETE** `/workers/{worker_id}`

Delete a worker.

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

## Rate Endpoints

### Create Rate
**POST** `/rates/`

Create a new rate for a worker type, optionally closing the previous rate.

**Query Parameters:**
- `close_previous` (bool, default: true): Close the previous rate before creating new one

**Request Body:**
```json
{
  "worker_type_id": "uuid",
  "rate_amount": "decimal (positive)",
  "start_date": "date",
  "end_date": "date (optional, null for current rate)"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "worker_type_id": "uuid",
  "worker_type_name": "string",
  "rate_amount": "decimal",
  "start_date": "date",
  "end_date": "date (optional)",
  "is_current": true,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### List Rates
**GET** `/rates/`

Get a paginated list of rates.

**Query Parameters:**
- `page` (int, default: 1): Page number
- `size` (int, default: 10): Page size
- `worker_type_id` (optional): Filter by worker type

**Response:** `200 OK`

### Get Rate
**GET** `/rates/{rate_id}`

Retrieve a specific rate by ID.

**Response:** `200 OK` or `404 Not Found`

### Get Current Rate
**GET** `/rates/worker-type/{worker_type_id}/current`

Get the current active rate for a worker type (end_date is NULL).

**Response:** `200 OK` or `404 Not Found`

### Get Active Rate
**GET** `/rates/worker-type/{worker_type_id}/active`

Get the active rate for a worker type on a specific date.

**Query Parameters:**
- `as_of_date` (date, optional): Date to check (default: today)

**Response:** `200 OK` or `404 Not Found`

### Get Rate History
**GET** `/rates/worker-type/{worker_type_id}/history`

Get all historical rates for a worker type.

**Response:** `200 OK`
```json
{
  "worker_type_id": "uuid",
  "worker_type_name": "string",
  "current_rate": "decimal (optional)",
  "rate_history": [
    {
      "id": "uuid",
      "rate_amount": "decimal",
      "start_date": "date",
      "end_date": "date (optional)",
      "is_current": true,
      "created_at": "date"
    }
  ]
}
```

### Get Rates in Date Range
**GET** `/rates/worker-type/{worker_type_id}/date-range`

Get all rates that overlap with a date range.

**Query Parameters:**
- `start_date` (date, required): Range start date
- `end_date` (date, required): Range end date

**Response:** `200 OK`

### Update Rate
**POST** `/rates/worker-type/{worker_type_id}/update`

Update rate by closing the current rate and creating a new one.

**Query Parameters:**
- `new_rate_amount` (decimal, required): New rate amount
- `effective_date` (date, required): Date when new rate becomes effective

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### Close Rate
**POST** `/rates/worker-type/{worker_type_id}/close`

Close the current rate by setting its end_date.

**Query Parameters:**
- `end_date` (date, required): Date to close the rate

**Response:** `200 OK` or `400 Bad Request` or `404 Not Found`

### Check Effective Rate
**POST** `/rates/check-effective`

Check if a rate is effective for a worker type on a specific date.

**Query Parameters:**
- `worker_type_id` (uuid, required): Worker type ID
- `check_date` (date, required): Date to check

**Response:** `200 OK`
```json
{
  "worker_type_id": "uuid",
  "check_date": "date",
  "effective_rate": "decimal (optional)",
  "rate_id": "uuid (optional)",
  "is_active": true
}
```

## Scope-Based Filtering

All resource and worker endpoints include scope-based filtering based on user permissions:

- **Global Scope (Admin)**: Full access to all resources and workers
- **Program Scope**: Access to resources and workers assigned to projects within the program
- **Project Scope**: Access to resources and workers assigned to specific projects

Worker types and rates are accessible to all authenticated users as they are organizational resources.

## Error Responses

All endpoints may return the following error responses:

- `400 Bad Request`: Invalid request data or business rule violation
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error
- `501 Not Implemented`: Authentication not yet implemented (temporary)

## Requirements Satisfied

This implementation satisfies the following requirements:

- **5.1-5.5**: Worker and worker type management
- **6.1-6.5**: Rate management with temporal validity
- **11.5**: Scope-based filtering for resources and workers

## Testing

Integration tests are available in `backend/tests/integration/test_resource_api.py`.

Run tests with:
```bash
cd backend
python -m pytest tests/integration/test_resource_api.py -v
```

## Next Steps

- Implement authentication service to enable full endpoint functionality
- Add authorization middleware for role-based access control
- Implement resource assignment endpoints (Task 7.4)
- Add comprehensive end-to-end tests with real data
