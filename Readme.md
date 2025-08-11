# GitGenius - AI-Powered Test Case Generator

GitGenius is an intelligent web application that automatically generates comprehensive test cases for your GitHub repositories using advanced AI technology. The application integrates with GitHub OAuth for seamless repository access and leverages Groq's powerful language models to create production-ready test cases for your codebase.

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Usage Guide](#usage-guide)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

### Core Functionality
- **GitHub Integration**: Seamless OAuth authentication with GitHub for secure repository access
- **AI-Powered Test Generation**: Utilizes Groq's advanced language models to generate comprehensive test cases
- **Multi-Language Support**: Supports test case generation for various programming languages and frameworks
- **Repository Management**: Browse and select from your GitHub repositories with caching for improved performance
- **Edge Case Detection**: Intelligent identification and testing of edge cases in your code
- **Test Case Persistence**: Save and manage generated test cases with full database integration
- **Analytics Dashboard**: Track test generation history and repository analysis metrics

### Advanced Features
- **Code Analysis**: Deep analysis of repository structure and code patterns
- **Technology Detection**: Automatic identification of programming languages and frameworks
- **Batch Processing**: Generate test cases for multiple files simultaneously
- **Export Functionality**: Download generated test cases in various formats
- **User Management**: Complete user authentication and session management

## Architecture Overview

GitGenius follows a modular MVC (Model-View-Controller) architecture pattern:

### Application Flow
1. **Authentication Layer**: Users authenticate via GitHub OAuth
2. **Repository Access**: Application fetches user repositories through GitHub API
3. **Code Analysis**: Selected repository files are analyzed for structure and patterns
4. **AI Processing**: Code content is sent to Groq AI service for test case generation
5. **Data Persistence**: Generated test cases are stored in the database
6. **User Interface**: Results are presented through a responsive web interface

### Key Components
- **Flask Application**: Main web framework handling HTTP requests and responses
- **SQLAlchemy ORM**: Database abstraction layer for data management
- **GitHub Service**: Handles all GitHub API interactions and OAuth flow
- **Groq Service**: Manages AI model communication for test case generation
- **Database Models**: Structured data models for users, repositories, and test cases

## Technology Stack

### Backend Technologies
- **Python 3.11+**: Core programming language
- **Flask 3.1.1**: Web application framework
- **SQLAlchemy 2.0.42**: Database ORM and management
- **Flask-SQLAlchemy 3.1.1**: Flask integration for SQLAlchemy
- **Flask-Login 0.6.3**: User session management
- **Werkzeug 3.1.3**: WSGI utility library

### External APIs and Services
- **GitHub API v3**: Repository access and user authentication
- **Groq API**: AI-powered test case generation
- **OAuth 2.0**: Secure authentication protocol

### Database
- **SQLite**: Default development database
- **PostgreSQL**: Production database support

### Frontend Technologies
- **HTML5**: Markup structure
- **CSS3**: Styling and responsive design
- **JavaScript**: Interactive functionality
- **Bootstrap**: UI component framework

## Prerequisites

Before installing GitGenius, ensure you have the following:

### System Requirements
- **Python**: Version 3.11 or higher
- **Git**: For repository cloning and version control
- **Web Browser**: Modern browser with JavaScript support

### Required Accounts and API Keys
- **GitHub Account**: For OAuth authentication and repository access
- **GitHub OAuth App**: Create at https://github.com/settings/applications/new
- **Groq API Account**: Sign up at https://console.groq.com for AI services

## Installation and Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/gitgenius.git
cd gitgenius
```

### Step 2: Create Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
# Install required packages
pip install -r requirements.txt
```

### Step 4: Environment Configuration
Create a `.env` file in the project root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Groq AI Configuration
GROQ_API_KEY=your_groq_api_key

# Application Configuration
SESSION_SECRET=your_secure_session_secret_key
FLASK_ENV=development
DEBUG=True

# Database Configuration
DATABASE_URL=sqlite:///github_test_generator.db
```

## Environment Configuration

### GitHub OAuth Setup
1. Navigate to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: GitGenius
   - **Homepage URL**: `http://localhost:5000`
   - **Authorization callback URL**: `http://localhost:5000/auth/github/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### Groq API Setup
1. Visit https://console.groq.com
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy the API key to your `.env` file

### Security Configuration
- Generate a secure session secret key (minimum 32 characters)
- Use environment variables for all sensitive information
- Never commit API keys or secrets to version control

## Database Setup

### Automatic Database Initialization
The application automatically creates database tables on first run:

```bash
python main.py
```

### Manual Database Operations
For advanced database operations:

```python
# Access Flask shell
flask shell

# Create all tables
from app import db
db.create_all()

# Drop all tables (caution: data loss)
db.drop_all()
```

### Database Models
- **User**: Stores GitHub user information and access tokens
- **Repository**: Caches repository metadata and structure
- **TestCase**: Stores generated test cases and metadata
- **Analytics**: Tracks usage statistics and performance metrics
- **CodeAnalysis**: Stores code analysis results and patterns

## Running the Application

### Development Mode
```bash
# Run with auto-reload enabled
python main.py
```

### Production Mode
```bash
# Using Gunicorn (recommended for production)
gunicorn -w 4 -b 0.0.0.0:5000 main:app
```

### Access the Application
Open your web browser and navigate to:
- **Development**: http://localhost:5000
- **Production**: Your configured domain

## Usage Guide

### Getting Started
1. **Authentication**: Click "Login with GitHub" on the home page
2. **Authorization**: Grant necessary permissions to GitGenius
3. **Dashboard Access**: You'll be redirected to your personal dashboard

### Generating Test Cases
1. **Repository Selection**: Choose a repository from your GitHub account
2. **File Selection**: Browse and select specific files for test generation
3. **Configuration**: Choose technology stack and specify edge cases
4. **Generation**: Click "Generate Tests" to start the AI processing
5. **Review**: Examine generated test cases and make adjustments
6. **Export**: Download or save test cases to your repository

### Managing Test Cases
- **View History**: Access previously generated test cases
- **Edit Tests**: Modify generated test cases as needed
- **Delete Tests**: Remove unwanted test cases
- **Export Options**: Download in various formats (Python, JavaScript, etc.)

## API Endpoints

### Authentication Endpoints
- `GET /` - Home page and login interface
- `GET /auth/github` - Initiate GitHub OAuth flow
- `GET /auth/github/callback` - Handle OAuth callback
- `POST /logout` - User logout and session cleanup

### Application Endpoints
- `GET /dashboard` - Main user dashboard
- `GET /repositories` - List user repositories
- `GET /repository/<id>` - Repository details and file browser
- `POST /generate-tests` - Generate test cases for selected files
- `GET /test-cases` - List generated test cases
- `GET /analytics` - User analytics and statistics

### API Response Format
```json
{
  "status": "success|error",
  "message": "Description of the result",
  "data": {
    // Response data
  }
}
```

## Project Structure

```
gitgenius/
├── app.py                 # Flask application factory and configuration
├── main.py               # Application entry point
├── routes.py             # URL routing and view functions
├── models.py             # Database models and relationships
├── github_service.py     # GitHub API integration service
├── groq_service.py       # Groq AI service integration
├── requirements.txt      # Python dependencies
├── .env.example         # Environment variables template
├── .gitignore           # Git ignore rules
├── templates/           # HTML templates
│   ├── home.html        # Landing page template
│   ├── dashboard.html   # Main dashboard template
│   ├── 404.html         # Error page template
│   └── 500.html         # Server error template
├── static/              # Static assets
│   ├── css/             # Stylesheets
│   └── js/              # JavaScript files
├── instance/            # Instance-specific files
└── __pycache__/         # Python bytecode cache
```

### Key Files Description
- **app.py**: Contains Flask application factory, database configuration, and core setup
- **routes.py**: Defines all URL endpoints and their corresponding view functions
- **models.py**: SQLAlchemy database models for data persistence
- **github_service.py**: Handles GitHub API interactions, OAuth flow, and repository management
- **groq_service.py**: Manages communication with Groq AI API for test case generation
- **main.py**: Application entry point that imports routes and starts the Flask server

## Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `python -m pytest`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

### Code Style Guidelines
- Follow PEP 8 for Python code formatting
- Use meaningful variable and function names
- Add docstrings for all functions and classes
- Include type hints where appropriate
- Write unit tests for new functionality

## Troubleshooting

### Common Issues

#### Authentication Problems
- **Issue**: GitHub OAuth fails
- **Solution**: Verify GitHub OAuth app configuration and callback URLs
- **Check**: Ensure GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are correct

#### API Rate Limiting
- **Issue**: GitHub API rate limit exceeded
- **Solution**: Implement request caching and respect rate limits
- **Check**: Monitor API usage in GitHub settings

#### Database Errors
- **Issue**: Database connection fails
- **Solution**: Check DATABASE_URL configuration
- **Check**: Ensure database file permissions are correct

#### AI Service Issues
- **Issue**: Groq API requests fail
- **Solution**: Verify GROQ_API_KEY and check API status
- **Check**: Monitor API usage and quotas

### Debug Mode
Enable debug mode for detailed error messages:
```bash
export FLASK_ENV=development
export DEBUG=True
python main.py
```

### Logging
Application logs are available in the console output. For production, configure proper logging:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

## License

This project is licensed under the MIT License.

### MIT License

Copyright (c) 2025 Rishab (being-souL1230)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### Creator

**Rishab** - [being-souL1230](https://github.com/being-souL1230)

Project Repository: [GitGenius](https://github.com/being-souL1230/AI-GitGenius)

---

**GitGenius** - Empowering developers with AI-driven test case generation for better code quality and reliability.