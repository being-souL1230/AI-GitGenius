from datetime import datetime
from app import db
from sqlalchemy import Text, JSON

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    github_id = db.Column(db.String(50), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    access_token = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    repositories = db.relationship('Repository', backref='user', lazy=True, cascade='all, delete-orphan')
    test_cases = db.relationship('TestCase', backref='user', lazy=True, cascade='all, delete-orphan')

class Repository(db.Model):
    __tablename__ = 'repositories'
    
    id = db.Column(db.Integer, primary_key=True)
    github_id = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(300), nullable=False)
    description = db.Column(Text, nullable=True)
    language = db.Column(db.String(50), nullable=True)
    private = db.Column(db.Boolean, default=False)
    clone_url = db.Column(db.String(500), nullable=False)
    html_url = db.Column(db.String(500), nullable=False)
    cached_content = db.Column(JSON, nullable=True)  # Cache repository structure
    cache_updated_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    test_cases = db.relationship('TestCase', backref='repository', lazy=True, cascade='all, delete-orphan')

class TestCase(db.Model):
    __tablename__ = 'test_cases'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    repository_id = db.Column(db.Integer, db.ForeignKey('repositories.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    test_content = db.Column(Text, nullable=False)
    technology = db.Column(db.String(50), nullable=False)
    edge_cases = db.Column(JSON, nullable=True)
    quality_score = db.Column(db.Float, nullable=True)  # AI-generated quality assessment
    status = db.Column(db.String(20), default='generated')  # generated, committed, pushed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
class Analytics(db.Model):
    __tablename__ = 'analytics'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Basic Stats
    total_files_generated = db.Column(db.Integer, default=0)
    total_repos = db.Column(db.Integer, default=0)
    total_commits = db.Column(db.Integer, default=0)
    total_analyses = db.Column(db.Integer, default=0)
    
    # Quality Metrics
    average_quality_score = db.Column(db.Float, default=0.0)
    top_notch_percentage = db.Column(db.Float, default=0.0)
    average_vulnerability_score = db.Column(db.Float, default=0.0)
    average_refactor_score = db.Column(db.Float, default=0.0)
    
    # Technology Breakdown
    technology_breakdown = db.Column(JSON, nullable=True)  # {python: 10, javascript: 5, ...}
    language_breakdown = db.Column(JSON, nullable=True)    # {python: 10, js: 5, ...}
    
    # Time-based Analytics
    daily_activity = db.Column(JSON, nullable=True)  # {date: count}
    weekly_trends = db.Column(JSON, nullable=True)   # {week: data}
    monthly_stats = db.Column(JSON, nullable=True)   # {month: data}
    
    # Performance Metrics
    average_test_coverage = db.Column(db.Float, default=0.0)
    average_complexity_score = db.Column(db.Float, default=0.0)
    average_maintainability_score = db.Column(db.Float, default=0.0)
    
    # Security Metrics
    critical_vulnerabilities_found = db.Column(db.Integer, default=0)
    high_vulnerabilities_found = db.Column(db.Integer, default=0)
    medium_vulnerabilities_found = db.Column(db.Integer, default=0)
    low_vulnerabilities_found = db.Column(db.Integer, default=0)
    
    # Refactoring Metrics
    refactoring_suggestions_generated = db.Column(db.Integer, default=0)
    complexity_reduction_achieved = db.Column(db.Float, default=0.0)
    code_quality_improvements = db.Column(db.Integer, default=0)
    
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='analytics')

class CodeAnalysis(db.Model):
    __tablename__ = 'code_analysis'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    repository_id = db.Column(db.Integer, db.ForeignKey('repositories.id'), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    analysis_type = db.Column(db.String(50), nullable=False)  # refactor, vulnerability
    original_code = db.Column(Text, nullable=False)
    analysis_result = db.Column(Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='code_analyses')
    repository = db.relationship('Repository', backref='code_analyses')
