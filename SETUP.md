# GitGenius Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### 3. Run the Application
```bash
python main.py
```

## Development Setup

### Running Tests
```bash
pytest
```

### Running with Celery (Background Jobs)
Terminal 1 - Redis:
```bash
redis-server
```

Terminal 2 - Celery Worker:
```bash
celery -A tasks worker --loglevel=info
```

Terminal 3 - Celery Flower (Monitoring):
```bash
celery -A tasks flower
```

Terminal 4 - Flask App:
```bash
python main.py
```

## Docker Setup

### Development
```bash
docker-compose up --build
```

### Production
```bash
docker-compose -f docker-compose.yml up -d
```

## New Features Added

### Security Enhancements
- ✅ CSRF Protection with Flask-WTF
- ✅ Rate Limiting with Flask-Limiter
- ✅ Input Validation with WTForms
- ✅ Secure Configuration Management

### Architecture Improvements
- ✅ Blueprint-based Route Organization
- ✅ Application Factory Pattern
- ✅ Proper Error Handling

### Testing Framework
- ✅ Pytest Configuration
- ✅ Test Fixtures and Utilities
- ✅ Model and Route Testing

### Background Processing
- ✅ Celery Integration for Async Tasks
- ✅ Redis Backend for Job Queue
- ✅ Task Monitoring with Flower

### DevOps
- ✅ Docker Containerization
- ✅ Docker Compose for Multi-service Setup
- ✅ Production-ready Configuration

## API Endpoints

### Authentication
- `GET /` - Home page
- `GET /auth/github` - GitHub OAuth
- `GET /auth/github/callback` - OAuth callback
- `POST /auth/logout` - Logout

### Dashboard
- `GET /dashboard/` - Main dashboard
- `GET /dashboard/repositories` - List repositories
- `POST /dashboard/generate-tests` - Generate tests

### API v1
- `GET /api/v1/test-cases` - Get test cases
- `GET /api/v1/analytics` - Get analytics
- `GET /api/v1/repositories/<id>/files` - Get repo files

## Security Features

### Rate Limiting
- Global: 200/day, 50/hour
- Auth endpoints: 10/minute (login), 5/minute (callback)
- API endpoints: 30/minute (general), 50/minute (read-only)

### CSRF Protection
- All forms protected with CSRF tokens
- Configurable timeout (default: 1 hour)

### Input Validation
- File path validation with regex
- Technology selection validation
- Edge case input sanitization

## Background Tasks

### Available Tasks
- `generate_test_cases_async` - Async test generation
- `update_user_analytics` - Update user stats
- `cleanup_old_test_cases` - Clean old data
- `sync_repositories` - Sync GitHub repos

### Task Monitoring
Access Flower at: http://localhost:5555
