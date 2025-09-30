from typing import Dict, Any
from datetime import datetime

from models import Repository, TestCase, Analytics, CodeAnalysis


_BASE_SUMMARY = {
    "name": "GitGenius",
    "tagline": "AI-powered GitHub test case generator with Groq acceleration",
    "mission": (
        "Help engineers produce reliable automated tests faster by combining GitHub "
        "repository context with Groq language models and analytics."
    ),
    "capabilities": [
        "Secure GitHub OAuth login and repository browsing",
        "Groq-backed multi-language test generation with edge case handling",
        "Persistent storage for generated test suites and analytics tracking",
        "Real-time dashboard with repository insights and activity trends",
        "Code analysis workflows for refactoring and vulnerability review",
    ],
    "how_it_works": [
        "Authenticate with GitHub and choose repositories or files for analysis.",
        "GitGenius streams file content to Groq models to draft unit, integration, and end-to-end tests.",
        "Review AI suggestions, adjust configurations, and export or commit the generated suites.",
        "Track outputs through the analytics dashboard, including quality scores and technology coverage.",
    ],
    "technology_stack": {
        "backend": ["Flask 3", "Python 3.11", "SQLAlchemy", "Flask-Login"],
        "frontend": ["Bootstrap 5", "Vanilla JS", "CSS3"],
        "services": ["GitHub REST API", "Groq Inference API"],
        "database": ["SQLite (development)", "PostgreSQL (production)"]
    },
    "deployment": {
        "entry_point": "main.py",
        "environment": ".env configuration for OAuth, Groq API, and database settings",
        "docker": "Dockerfile and docker-compose.yml available for containerized setup",
    },
}


def _collect_usage_stats() -> Dict[str, Any]:
    """Collect aggregate usage statistics across all users."""
    summary = {
        "total_repositories": Repository.query.count(),
        "total_test_cases": TestCase.query.count(),
        "total_analytics_profiles": Analytics.query.count(),
        "total_code_analyses": CodeAnalysis.query.count(),
        "last_activity": None,
    }

    latest_test_case = TestCase.query.order_by(TestCase.created_at.desc()).first()
    latest_analysis = CodeAnalysis.query.order_by(CodeAnalysis.created_at.desc()).first()

    timestamps = [
        getattr(latest_test_case, "created_at", None),
        getattr(latest_analysis, "created_at", None),
    ]
    timestamps = [ts for ts in timestamps if ts is not None]

    if timestamps:
        summary["last_activity"] = max(timestamps).isoformat()

    return summary


def get_project_summary() -> Dict[str, Any]:
    """Return a structured summary of the GitGenius project with live stats."""
    summary = dict(_BASE_SUMMARY)
    summary["usage"] = _collect_usage_stats()
    summary["generated_at"] = datetime.utcnow().isoformat()
    return summary
