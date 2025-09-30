import json
from datetime import datetime
from flask import Blueprint, render_template, request, session, redirect, url_for, jsonify, flash
from app import db, limiter
from models import User, Repository, TestCase, Analytics
from github_service import GitHubService
from groq_service import GroqService
from forms import TestGenerationForm, RepositorySelectionForm

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')

def login_required(f):
    """Decorator to require login"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('main.home'))
        return f(*args, **kwargs)
    return decorated_function

@dashboard_bp.route('/')
@login_required
@limiter.limit("30 per minute")
def dashboard():
    """Main dashboard"""
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user:
        session.clear()
        return redirect(url_for('main.home'))
    
    # Get user statistics
    total_repos = Repository.query.filter_by(user_id=user_id).count()
    total_test_cases = TestCase.query.filter_by(user_id=user_id).count()
    
    # Get recent test cases
    recent_tests = TestCase.query.filter_by(user_id=user_id)\
                                 .order_by(TestCase.created_at.desc())\
                                 .limit(5).all()
    
    # Get analytics data
    analytics = Analytics.query.filter_by(user_id=user_id).first()
    
    return render_template('dashboard.html', 
                         user=user,
                         total_repos=total_repos,
                         total_test_cases=total_test_cases,
                         recent_tests=recent_tests,
                         analytics=analytics)

@dashboard_bp.route('/repositories')
@login_required
@limiter.limit("20 per minute")
def repositories():
    """List user repositories"""
    user_id = session.get('user_id')
    access_token = session.get('access_token')
    
    github_service = GitHubService(access_token)
    repos = github_service.get_user_repositories(user_id)
    
    return jsonify({'repositories': repos})

@dashboard_bp.route('/repository/<int:repo_id>')
@login_required
@limiter.limit("20 per minute")
def repository_details(repo_id):
    """Get repository details and file structure"""
    user_id = session.get('user_id')
    access_token = session.get('access_token')
    
    repo = Repository.query.filter_by(id=repo_id, user_id=user_id).first()
    if not repo:
        return jsonify({'error': 'Repository not found'}), 404
    
    github_service = GitHubService(access_token)
    contents = github_service.get_repository_contents(repo.full_name)
    
    return jsonify({
        'repository': {
            'id': repo.id,
            'name': repo.name,
            'full_name': repo.full_name,
            'description': repo.description,
            'language': repo.language
        },
        'contents': contents
    })

@dashboard_bp.route('/generate-tests', methods=['POST'])
@login_required
@limiter.limit("5 per minute")
def generate_tests():
    """Generate test cases for selected files"""
    form = TestGenerationForm()
    
    if not form.validate_on_submit():
        return jsonify({'error': 'Invalid form data', 'errors': form.errors}), 400
    
    user_id = session.get('user_id')
    access_token = session.get('access_token')
    
    try:
        # Get repository
        repo = Repository.query.filter_by(id=form.repository_id.data, user_id=user_id).first()
        if not repo:
            return jsonify({'error': 'Repository not found'}), 404
        
        # Get file content
        github_service = GitHubService(access_token)
        file_content = github_service.get_file_content(repo.full_name, form.file_path.data)
        
        if not file_content:
            return jsonify({'error': 'Could not retrieve file content'}), 400
        
        # Generate test cases using Groq
        groq_service = GroqService()
        test_content = groq_service.generate_test_cases(
            file_content, 
            form.file_path.data,
            form.technology.data,
            form.edge_cases.data
        )
        
        # Analyze quality
        quality_analysis = groq_service.analyze_code_quality(test_content)
        
        # Save test case
        test_case = TestCase(
            user_id=user_id,
            repository_id=repo.id,
            file_path=form.file_path.data,
            test_content=test_content,
            technology=form.technology.data,
            edge_cases=json.loads(form.edge_cases.data) if form.edge_cases.data else None,
            quality_score=quality_analysis.get('score', 5.0)
        )
        
        db.session.add(test_case)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'test_case_id': test_case.id,
            'test_content': test_content,
            'quality_score': quality_analysis.get('score', 5.0),
            'quality_explanation': quality_analysis.get('explanation', '')
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Test generation failed: {str(e)}'}), 500
