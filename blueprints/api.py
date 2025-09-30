from flask import Blueprint, request, jsonify, session
from app import db, limiter
from models import User, Repository, TestCase, Analytics
from github_service import GitHubService
from groq_service import GroqService
import logging

api_bp = Blueprint('api', __name__, url_prefix='/api/v1')

def api_login_required(f):
    """Decorator for API authentication"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'access_token' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@api_bp.route('/test-cases', methods=['GET'])
@api_login_required
@limiter.limit("30 per minute")
def get_test_cases():
    """Get user's test cases"""
    user_id = session.get('user_id')
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 10, type=int), 50)
    
    test_cases = TestCase.query.filter_by(user_id=user_id)\
                              .order_by(TestCase.created_at.desc())\
                              .paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'test_cases': [{
            'id': tc.id,
            'file_path': tc.file_path,
            'technology': tc.technology,
            'quality_score': tc.quality_score,
            'status': tc.status,
            'created_at': tc.created_at.isoformat(),
            'repository': {
                'name': tc.repository.name,
                'full_name': tc.repository.full_name
            }
        } for tc in test_cases.items],
        'pagination': {
            'page': page,
            'pages': test_cases.pages,
            'per_page': per_page,
            'total': test_cases.total
        }
    })

@api_bp.route('/test-cases/<int:test_case_id>', methods=['GET'])
@api_login_required
@limiter.limit("50 per minute")
def get_test_case(test_case_id):
    """Get specific test case"""
    user_id = session.get('user_id')
    test_case = TestCase.query.filter_by(id=test_case_id, user_id=user_id).first()
    
    if not test_case:
        return jsonify({'error': 'Test case not found'}), 404
    
    return jsonify({
        'id': test_case.id,
        'file_path': test_case.file_path,
        'test_content': test_case.test_content,
        'technology': test_case.technology,
        'edge_cases': test_case.edge_cases,
        'quality_score': test_case.quality_score,
        'status': test_case.status,
        'created_at': test_case.created_at.isoformat(),
        'repository': {
            'name': test_case.repository.name,
            'full_name': test_case.repository.full_name
        }
    })

@api_bp.route('/analytics', methods=['GET'])
@api_login_required
@limiter.limit("20 per minute")
def get_analytics():
    """Get user analytics"""
    user_id = session.get('user_id')
    analytics = Analytics.query.filter_by(user_id=user_id).first()
    
    if not analytics:
        return jsonify({'message': 'No analytics data available'}), 404
    
    return jsonify({
        'total_files_generated': analytics.total_files_generated,
        'total_repos': analytics.total_repos,
        'average_quality_score': analytics.average_quality_score,
        'technology_breakdown': analytics.technology_breakdown,
        'daily_activity': analytics.daily_activity,
        'last_updated': analytics.last_updated.isoformat()
    })

@api_bp.route('/repositories/<int:repo_id>/files', methods=['GET'])
@api_login_required
@limiter.limit("30 per minute")
def get_repository_files(repo_id):
    """Get repository file structure"""
    user_id = session.get('user_id')
    access_token = session.get('access_token')
    path = request.args.get('path', '')
    
    repo = Repository.query.filter_by(id=repo_id, user_id=user_id).first()
    if not repo:
        return jsonify({'error': 'Repository not found'}), 404
    
    try:
        github_service = GitHubService(access_token)
        contents = github_service.get_repository_contents(repo.full_name, path)
        return jsonify({'contents': contents})
    except Exception as e:
        logging.error(f"Error fetching repository files: {e}")
        return jsonify({'error': 'Failed to fetch repository files'}), 500
