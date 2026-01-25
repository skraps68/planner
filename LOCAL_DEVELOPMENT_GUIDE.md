# Local Development Guide

## Quick Start - Testing the Application in Your Browser

### Prerequisites

Before you start, make sure you have:
- **Docker Desktop** installed and running
- **Git** installed
- A web browser (Chrome, Firefox, Safari, etc.)

### Step 1: Start the Application

You have two options to start the application:

**Option A: Using Make (Recommended)**
```bash
make start
```

**Option B: Using the Script Directly**
```bash
./scripts/start-dev.sh
```

This will:
- Create a `.env` file if it doesn't exist
- Build and start all Docker containers (PostgreSQL, Redis, FastAPI app)
- Wait for services to be healthy
- Run database migrations
- Display service URLs

### Step 2: Seed the Database with Test Data

Once the application is running, seed it with sample data:

```bash
# Run the seed script
docker-compose exec app python scripts/seed_data.py
```

This creates:
- Sample programs (Digital Transformation, Infrastructure Modernization, etc.)
- Sample projects under each program
- Worker types and workers with rates
- Test users with different roles and scopes
- Resource assignments and actuals data

### Step 3: Access the Application

Open your browser and navigate to:

**API Documentation (Interactive)**
- URL: http://localhost:8000/docs
- This is the Swagger UI where you can test all API endpoints

**Alternative API Documentation**
- URL: http://localhost:8000/redoc
- ReDoc format documentation

**Health Check**
- URL: http://localhost:8000/health
- Verify the application is running

**API Root**
- URL: http://localhost:8000/api/v1/
- Shows available API endpoints

### Step 4: Test the API in Your Browser

#### Login and Get Authentication Token

1. Go to http://localhost:8000/docs
2. Find the **POST /api/v1/auth/login** endpoint
3. Click "Try it out"
4. Enter credentials:
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
5. Click "Execute"
6. Copy the `access_token` from the response

#### Authorize Your Session

1. Click the **"Authorize"** button at the top of the page
2. Enter: `Bearer YOUR_ACCESS_TOKEN` (replace with your token)
3. Click "Authorize"
4. Now you can test all protected endpoints!

#### Try Some Endpoints

**Get All Programs:**
- Endpoint: GET /api/v1/programs/
- Click "Try it out" → "Execute"
- You'll see all programs in the system

**Get All Projects:**
- Endpoint: GET /api/v1/projects/
- Click "Try it out" → "Execute"
- You'll see all projects

**Get Budget vs Actual Report:**
- Endpoint: GET /api/v1/reports/budget-vs-actual
- Set entity_type: "program"
- Set entity_id: (copy a program ID from the programs list)
- Click "Execute"

### Step 5: View Logs

To see what's happening in the application:

```bash
# View all logs
docker-compose logs -f

# View only app logs
docker-compose logs -f app

# View only database logs
docker-compose logs -f db
```

### Step 6: Stop the Application

When you're done testing:

```bash
make stop
# or
./scripts/stop-dev.sh
```

## Available Test Users

After seeding, you'll have these test users:

| Username | Password | Role | Scope |
|----------|----------|------|-------|
| admin | admin123 | Admin | Global (full access to all programs/projects) |
| program_mgr | pm123 | Program Manager | Digital Transformation program |
| project_mgr | proj123 | Project Manager | Mobile App project only |
| finance_mgr | finance123 | Finance Manager | 2 programs (Digital Transformation, Infrastructure) |
| viewer | viewer123 | Viewer | Web Portal project only |

## Common Development Commands

```bash
# Start the application
make start

# Stop the application
make stop

# Reset everything (removes all data)
make reset

# Run tests
make test

# View logs
make logs

# Open a shell in the app container
make shell

# Open PostgreSQL shell
make db-shell

# Run database migrations
make migrate

# Create a new migration
make migration
```

## Troubleshooting

### Docker is not running
```
Error: Docker is not running. Please start Docker first.
```
**Solution:** Start Docker Desktop and wait for it to fully start.

### Port already in use
```
Error: Port 8000 is already in use
```
**Solution:** Stop any other services using port 8000, or change the port in `.env`:
```bash
APP_PORT=8001
```

### Database connection failed
```
Error: Could not connect to database
```
**Solution:** 
1. Check if PostgreSQL container is running: `docker-compose ps`
2. Restart the services: `make reset && make start`

### Services not healthy
If services don't become healthy after 60 seconds:
```bash
# Check service status
docker-compose ps

# Check logs for errors
docker-compose logs db
docker-compose logs redis
docker-compose logs app

# Restart everything
make reset && make start
```

## Project Structure

```
planner/
├── backend/                    # FastAPI application
│   ├── app/                   # Application code
│   │   ├── api/              # API endpoints
│   │   ├── models/           # Database models
│   │   ├── services/         # Business logic
│   │   └── main.py          # App entry point
│   ├── tests/                # Test suite
│   └── scripts/              # Utility scripts
├── scripts/                   # Development scripts
│   ├── start-dev.sh         # Start development
│   ├── stop-dev.sh          # Stop development
│   └── reset-dev.sh         # Reset environment
├── docker-compose.yml        # Docker services
├── Makefile                  # Development commands
└── .env                      # Environment config
```

## Next Steps

### Frontend Development (Coming Soon)

The frontend React application will be available at:
- URL: http://localhost:3000
- Technology: React + TypeScript + Material-UI

To start frontend development:
```bash
cd frontend
npm install
npm start
```

### API Development

To add new features:
1. Review specs in `.kiro/specs/planner/`
2. Follow the task list in `tasks.md`
3. Add models in `backend/app/models/`
4. Add services in `backend/app/services/`
5. Add API endpoints in `backend/app/api/v1/endpoints/`
6. Write tests in `backend/tests/`
7. Run tests: `make test`

## Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **Requirements**: `.kiro/specs/planner/requirements.md`
- **Design**: `.kiro/specs/planner/design.md`
- **Tasks**: `.kiro/specs/planner/tasks.md`
- **README**: `README.md`

## Support

If you encounter issues:
1. Check the logs: `make logs`
2. Review the troubleshooting section above
3. Reset the environment: `make reset && make start`
4. Check Docker Desktop is running properly
