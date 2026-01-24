# Program & Project Management System - Frontend

React + TypeScript frontend application for the Program and Project Management System.

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - Component library and design system
- **Redux Toolkit** - State management
- **React Query** - Server state management and data fetching
- **React Router** - Client-side routing
- **Axios** - HTTP client

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API client and endpoint definitions
│   ├── components/       # Reusable UI components
│   │   ├── auth/        # Authentication components
│   │   └── layout/      # Layout components (Header, Sidebar)
│   ├── contexts/        # React contexts (Auth, etc.)
│   ├── pages/           # Page components
│   ├── store/           # Redux store and slices
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Application entry point
│   └── theme.ts         # MUI theme configuration
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── vite.config.ts       # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your API URL if different from default

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Features

### Authentication
- JWT-based authentication with token refresh
- Protected routes requiring authentication
- Role-based access control
- User profile with role and scope display

### Layout
- Responsive sidebar navigation
- Header with user profile and notifications
- Role switching for multi-role users
- Scope-aware navigation

### State Management
- Redux Toolkit for global state (auth, UI)
- React Query for server state and caching
- Optimistic updates for better UX

## API Integration

The frontend communicates with the FastAPI backend through a configured API client with:
- Automatic JWT token injection
- Token refresh on 401 responses
- Request/response interceptors
- Error handling

## Development Guidelines

### Code Style
- Use TypeScript for all new files
- Follow React hooks best practices
- Use functional components
- Implement proper error boundaries

### Component Structure
- Keep components small and focused
- Use composition over inheritance
- Implement proper prop types
- Add JSDoc comments for complex logic

### State Management
- Use Redux for global application state
- Use React Query for server data
- Use local state for UI-only state
- Avoid prop drilling with context when appropriate

## Future Enhancements

The following features will be implemented in subsequent tasks:
- Program and project management UI
- Resource and worker management
- Actuals import and variance analysis
- Reporting and forecasting dashboards
- Admin interfaces for user management
- Scope-aware filtering and navigation
