import os
import json
import base64
from datetime import datetime
from flask import render_template, request, redirect, url_for, session, jsonify, flash
from app import app, db
from models import User, Repository, TestCase, Analytics, CodeAnalysis
from github_service import GitHubService
from groq_service import GroqService
import requests
import logging

# GitHub OAuth configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "your_github_client_id")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "your_github_client_secret")

@app.route('/')
def home():
    """Home page - login if not authenticated"""
    if 'access_token' in session:
        return redirect(url_for('dashboard'))
    return render_template('home.html')

@app.route('/auth/github')
def github_auth():
    """Redirect to GitHub OAuth"""
    # Use localhost callback URL for development
    callback_url = 'https://ai-gitgenius.onrender.com/auth/github/callback'
    
    github_auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={callback_url}&"
        f"scope=repo,user:email&"
        f"state=github_oauth"
    )
    
    # Debug logging
    logging.info(f"GitHub OAuth redirect URL: {github_auth_url}")
    logging.info(f"Callback URL: {callback_url}")
    
    return redirect(github_auth_url)

@app.route('/auth/github/callback')
def github_callback():
    """Handle GitHub OAuth callback"""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        flash(f'GitHub authorization failed: {error}', 'error')
        return redirect(url_for('home'))
    
    if not code:
        flash('Authorization failed - no code received', 'error')
        return redirect(url_for('home'))
    
    try:
        # Exchange code for access token
        token_response = requests.post(
            'https://github.com/login/oauth/access_token',
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': GITHUB_CLIENT_SECRET,
                'code': code
            },
            headers={'Accept': 'application/json'}
        )
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        if not access_token:
            flash('Failed to get access token', 'error')
            return redirect(url_for('home'))
        
        # Get user info from GitHub
        github_service = GitHubService(access_token)
        user_info = github_service.get_user_info()
        
        if not user_info:
            flash('Failed to get user information', 'error')
            return redirect(url_for('home'))
        
        # Create or update user
        user = User.query.filter_by(github_id=str(user_info['id'])).first()
        if not user:
            user = User()
            user.github_id = str(user_info['id'])
            user.username = user_info['login']
            user.email = user_info.get('email')
            user.avatar_url = user_info.get('avatar_url')
            user.access_token = access_token
            db.session.add(user)
        else:
            user.access_token = access_token
            user.username = user_info['login']
            user.email = user_info.get('email')
            user.avatar_url = user_info.get('avatar_url')
            user.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Store in session
        session['user_id'] = user.id
        session['access_token'] = access_token
        
        return redirect(url_for('dashboard'))
        
    except Exception as e:
        logging.error(f"OAuth callback error: {e}")
        flash('Authentication failed', 'error')
        return redirect(url_for('home'))

@app.route('/dashboard')
def dashboard():
    """Main dashboard page"""
    if 'access_token' not in session:
        return redirect(url_for('home'))
    
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('home'))
    
    return render_template('dashboard.html', user=user)

@app.route('/api/repositories')
def api_repositories():
    """Get user repositories"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        github_service = GitHubService(session['access_token'])
        repos = github_service.get_user_repositories(session['user_id'])
        return jsonify(repos)
    except Exception as e:
        logging.error(f"Error fetching repositories: {e}")
        return jsonify({'error': 'Failed to fetch repositories'}), 500

@app.route('/api/repository/<path:full_name>/contents')
def api_repository_contents(full_name):
    """Get repository contents"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    path = request.args.get('path', '')
    
    try:
        github_service = GitHubService(session['access_token'])
        contents = github_service.get_repository_contents(full_name, path)
        return jsonify(contents)
    except Exception as e:
        logging.error(f"Error fetching repository contents: {e}")
        return jsonify({'error': 'Failed to fetch contents'}), 500

@app.route('/api/repository/<path:full_name>/file')
def api_file_content(full_name):
    """Get file content"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    file_path = request.args.get('path')
    
    if not file_path:
        return jsonify({'error': 'File path required'}), 400
    
    try:
        github_service = GitHubService(session['access_token'])
        content = github_service.get_file_content(full_name, file_path)
        return jsonify({'content': content})
    except Exception as e:
        logging.error(f"Error fetching file content: {e}")
        return jsonify({'error': 'Failed to fetch file content'}), 500

@app.route('/api/generate-tests', methods=['POST'])
def api_generate_tests():
    """Generate test cases using AI"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'files' not in data:
        return jsonify({'error': 'Files required'}), 400
    
    try:
        groq_service = GroqService()
        github_service = GitHubService(session['access_token'])
        
        results = []
        for file_info in data['files']:
            file_path = file_info['path']
            repo_name = file_info['repo']
            
            # Get file content
            content = github_service.get_file_content(repo_name, file_path)
            if content:
                # Generate tests
                test_content = groq_service.generate_test_cases(
                    content, 
                    file_path, 
                    data.get('technology', 'python'),
                    data.get('edge_cases', [])
                )
                
                # Analyze quality
                quality_analysis = groq_service.analyze_code_quality(content)
                
                # Save to database
                test_case = TestCase()
                test_case.user_id = session['user_id']
                test_case.repository_id = _get_or_create_repo_id(repo_name)
                test_case.file_path = file_path
                test_case.test_content = test_content
                test_case.technology = data.get('technology', 'python')
                test_case.edge_cases = data.get('edge_cases', [])
                test_case.quality_score = quality_analysis.get('score', 5.0)
                db.session.add(test_case)
                
                # Update analytics in real-time
                analytics = Analytics.query.filter_by(user_id=session['user_id']).first()
                if analytics:
                    analytics.total_files_generated += 1
                    analytics.last_updated = datetime.utcnow()
                    
                    # Update technology breakdown
                    if analytics.technology_breakdown is None:
                        analytics.technology_breakdown = {}
                    technology = data.get('technology', 'python')
                    analytics.technology_breakdown[technology] = analytics.technology_breakdown.get(technology, 0) + 1
                
                results.append({
                    'file_path': file_path,
                    'test_content': test_content,
                    'quality_score': quality_analysis.get('score', 5.0)
                })
        
        db.session.commit()
        return jsonify({'results': results})
        
    except Exception as e:
        logging.error(f"Error generating tests: {e}")
        return jsonify({'error': 'Failed to generate tests'}), 500

@app.route('/api/code-analysis', methods=['POST'])
def api_code_analysis():
    """Analyze code for refactoring or vulnerabilities"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'file_path' not in data or 'analysis_type' not in data:
        return jsonify({'error': 'File path and analysis type required'}), 400
    
    try:
        groq_service = GroqService()
        github_service = GitHubService(session['access_token'])
        
        file_path = data['file_path']
        repo_name = data['repo_name']
        analysis_type = data['analysis_type']
        
        # Get file content
        content = github_service.get_file_content(repo_name, file_path)
        if not content:
            return jsonify({'error': 'File not found'}), 404
        
        # Perform analysis
        if analysis_type == 'refactor':
            result = groq_service.refactor_code(content, file_path)
        elif analysis_type == 'vulnerability':
            result = groq_service.check_vulnerabilities(content, file_path)
        else:
            return jsonify({'error': 'Invalid analysis type'}), 400
        
        # Save analysis
        analysis = CodeAnalysis()
        analysis.user_id = session['user_id']
        analysis.repository_id = _get_or_create_repo_id(repo_name)
        analysis.file_path = file_path
        analysis.analysis_type = analysis_type
        analysis.original_code = content
        analysis.analysis_result = result
        db.session.add(analysis)
        
        # Update analytics in real-time
        analytics = Analytics.query.filter_by(user_id=session['user_id']).first()
        if analytics:
            analytics.total_analyses += 1
            analytics.last_updated = datetime.utcnow()
            
            # Update security metrics if vulnerability analysis
            if analysis_type == 'vulnerability':
                if 'critical' in result.lower():
                    analytics.critical_vulnerabilities_found += 1
                elif 'high' in result.lower():
                    analytics.high_vulnerabilities_found += 1
                elif 'medium' in result.lower():
                    analytics.medium_vulnerabilities_found += 1
                elif 'low' in result.lower():
                    analytics.low_vulnerabilities_found += 1
            
            # Update refactoring metrics if refactor analysis
            if analysis_type == 'refactor':
                analytics.refactoring_suggestions_generated += 1
        
        db.session.commit()
        
        return jsonify({'result': result})
        
    except Exception as e:
        logging.error(f"Error performing code analysis: {e}")
        return jsonify({'error': 'Failed to analyze code'}), 500

@app.route('/api/analytics')
def api_analytics():
    """Get comprehensive real-time analytics data"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        user_id = session['user_id']
        
        # Get or create analytics record
        analytics = Analytics.query.filter_by(user_id=user_id).first()
        if not analytics:
            analytics = Analytics()
            analytics.user_id = user_id
            db.session.add(analytics)
        
        # Calculate comprehensive analytics
        test_cases = TestCase.query.filter_by(user_id=user_id).all()
        code_analyses = CodeAnalysis.query.filter_by(user_id=user_id).all()
        repositories = Repository.query.filter_by(user_id=user_id).all()
        
        # Basic Stats
        total_files = len(test_cases)
        total_repos = len(repositories)
        total_analyses = len(code_analyses)
        
        # Calculate commits (from test cases with committed status)
        total_commits = sum(1 for tc in test_cases if tc.status == 'committed')
        
        # Quality Metrics
        if test_cases:
            quality_scores = [tc.quality_score or 0 for tc in test_cases if tc.quality_score]
            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0
            top_notch_count = sum(1 for score in quality_scores if score >= 8.0)
            top_notch_percentage = (top_notch_count / len(quality_scores)) * 100 if quality_scores else 0
        else:
            avg_quality = 0
            top_notch_percentage = 0
        
        # Technology Breakdown
        tech_breakdown = {}
        lang_breakdown = {}
        for tc in test_cases:
            tech = tc.technology or 'unknown'
            tech_breakdown[tech] = tech_breakdown.get(tech, 0) + 1
            
            # Map technology to language
            lang_map = {
                'python': 'Python', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
                'java': 'Java', 'csharp': 'C#', 'php': 'PHP', 'ruby': 'Ruby',
                'go': 'Go', 'rust': 'Rust', 'swift': 'Swift', 'kotlin': 'Kotlin'
            }
            lang = lang_map.get(tech.lower(), tech.title())
            lang_breakdown[lang] = lang_breakdown.get(lang, 0) + 1
        
        # Security Metrics
        critical_vulns = sum(1 for ca in code_analyses if ca.analysis_type == 'vulnerability' and 'critical' in ca.analysis_result.lower())
        high_vulns = sum(1 for ca in code_analyses if ca.analysis_type == 'vulnerability' and 'high' in ca.analysis_result.lower())
        medium_vulns = sum(1 for ca in code_analyses if ca.analysis_type == 'vulnerability' and 'medium' in ca.analysis_result.lower())
        low_vulns = sum(1 for ca in code_analyses if ca.analysis_type == 'vulnerability' and 'low' in ca.analysis_result.lower())
        
        # Refactoring Metrics
        refactor_analyses = [ca for ca in code_analyses if ca.analysis_type == 'refactor']
        refactor_suggestions = len(refactor_analyses)
        
        # Time-based Analytics (last 30 days)
        from datetime import timedelta
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_test_cases = [tc for tc in test_cases if tc.created_at >= thirty_days_ago]
        recent_analyses = [ca for ca in code_analyses if ca.created_at >= thirty_days_ago]
        
        daily_activity = {}
        for i in range(30):
            date = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
            daily_activity[date] = {
                'test_cases': sum(1 for tc in recent_test_cases if tc.created_at.strftime('%Y-%m-%d') == date),
                'analyses': sum(1 for ca in recent_analyses if ca.created_at.strftime('%Y-%m-%d') == date)
            }
        
        # Update analytics record
        analytics.total_files_generated = total_files
        analytics.total_repos = total_repos
        analytics.total_commits = total_commits
        analytics.total_analyses = total_analyses
        analytics.average_quality_score = avg_quality
        analytics.top_notch_percentage = top_notch_percentage
        analytics.technology_breakdown = tech_breakdown
        analytics.language_breakdown = lang_breakdown
        analytics.daily_activity = daily_activity
        analytics.critical_vulnerabilities_found = critical_vulns
        analytics.high_vulnerabilities_found = high_vulns
        analytics.medium_vulnerabilities_found = medium_vulns
        analytics.low_vulnerabilities_found = low_vulns
        analytics.refactoring_suggestions_generated = refactor_suggestions
        analytics.last_updated = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            # Basic Stats
            'total_files_generated': total_files,
            'total_repos': total_repos,
            'total_analyses': total_analyses,
            'total_test_cases': total_files,
            
            # Quality Metrics
            'average_quality_score': round(avg_quality, 2),
            'top_notch_percentage': round(top_notch_percentage, 2),
            
            # Technology Breakdown
            'technology_breakdown': tech_breakdown,
            'language_breakdown': lang_breakdown,
            
            # Security Metrics
            'critical_vulnerabilities_found': critical_vulns,
            'high_vulnerabilities_found': high_vulns,
            'medium_vulnerabilities_found': medium_vulns,
            'low_vulnerabilities_found': low_vulns,
            
            # Refactoring Metrics
            'refactoring_suggestions_generated': refactor_suggestions,
            
            # Time-based Analytics
            'daily_activity': daily_activity,
            
            # Performance Indicators
            'productivity_score': round((total_files + total_analyses) / max(total_repos, 1), 2),
            'quality_trend': 'improving' if avg_quality > 7.0 else 'stable' if avg_quality > 5.0 else 'needs_improvement',
            'security_health': 'excellent' if (critical_vulns + high_vulns) == 0 else 'good' if (critical_vulns + high_vulns) <= 2 else 'needs_attention'
        })
        
    except Exception as e:
        logging.error(f"Error fetching analytics: {e}")
        return jsonify({'error': 'Failed to fetch analytics'}), 500

@app.route('/api/generate-ai-report', methods=['POST'])
def api_generate_ai_report():
    """Generate AI-powered analytics report"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        analytics = data.get('analytics', {})
        
        # Generate AI report using Groq
        groq_service = GroqService()
        
        # Create comprehensive prompt for AI report
        prompt = f"""
        As an expert software development analyst, create a comprehensive and insightful analytics report based on the following data:

        **Development Activity:**
        - Total files generated: {analytics.get('total_files_generated', 0)}
        - Total repositories: {analytics.get('total_repos', 0)}
        - Total commits: {analytics.get('total_commits', 0)}
        - Total code analyses: {analytics.get('total_analyses', 0)}

        **Quality Metrics:**
        - Average quality score: {analytics.get('average_quality_score', 0)}/10
        - Top-notch code percentage: {analytics.get('top_notch_percentage', 0)}%
        - Productivity score: {analytics.get('productivity_score', 0)}

        **Security Analysis:**
        - Critical vulnerabilities: {analytics.get('critical_vulnerabilities_found', 0)}
        - High vulnerabilities: {analytics.get('high_vulnerabilities_found', 0)}
        - Medium vulnerabilities: {analytics.get('medium_vulnerabilities_found', 0)}
        - Low vulnerabilities: {analytics.get('low_vulnerabilities_found', 0)}
        - Security health: {analytics.get('security_health', 'good')}

        **Technology Breakdown:**
        {analytics.get('technology_breakdown', {})}

        **Performance Indicators:**
        - Quality trend: {analytics.get('quality_trend', 'stable')}

        Please provide:
        1. **Executive Summary** - Key insights and overall performance assessment
        2. **Detailed Analysis** - Breakdown of each metric with actionable insights
        3. **Recommendations** - Specific suggestions for improvement
        4. **Trend Analysis** - Patterns and predictions based on the data
        5. **Action Items** - Prioritized next steps for the developer

        Format the response in HTML with proper styling, using emojis and clear sections. Make it engaging and professional.
        """
        
        # Generate report using Groq
        report_content = groq_service.generate_ai_report(prompt)
        
        return jsonify({
            'success': True,
            'report_content': report_content
        })
        
    except Exception as e:
        logging.error(f"Error generating AI report: {e}")
        return jsonify({'error': 'Failed to generate AI report'}), 500

@app.route('/api/pull-requests')
def api_pull_requests():
    """Get pull requests for user repositories"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        github_service = GitHubService(session['access_token'])
        repos = github_service.get_user_repositories(session['user_id'])
        
        pull_requests = []
        for repo in repos[:10]:  # Limit to first 10 repos for performance
            prs = github_service.get_pull_requests(repo['full_name'])
            if prs:
                pull_requests.append({
                    'repo_name': repo['full_name'],
                    'pull_requests': prs[:5]  # Limit to 5 PRs per repo
                })
        
        return jsonify(pull_requests)
        
    except Exception as e:
        logging.error(f"Error fetching pull requests: {e}")
        return jsonify({'error': 'Failed to fetch pull requests'}), 500

@app.route('/api/commit-tests', methods=['POST'])
def api_commit_tests():
    """Commit generated tests to repository"""
    if 'access_token' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'repo_name' not in data or 'test_content' not in data:
        return jsonify({'error': 'Repository name and test content required'}), 400
    
    try:
        github_service = GitHubService(session['access_token'])
        
        repo_name = data['repo_name']
        test_content = data['test_content']
        file_path = data.get('file_path', 'tests/generated_tests.py')
        message = data.get('message', 'Add generated test cases')
        
        # Encode content
        encoded_content = base64.b64encode(test_content.encode()).decode()
        
        # Create/update file
        result = github_service.create_file(repo_name, file_path, encoded_content, message)
        
        if result:
            return jsonify({'success': True, 'message': 'Tests committed successfully'})
        else:
            return jsonify({'error': 'Failed to commit tests'}), 500
            
    except Exception as e:
        logging.error(f"Error committing tests: {e}")
        return jsonify({'error': 'Failed to commit tests'}), 500

@app.route('/logout')
def logout():
    """Logout user"""
    session.clear()
    flash('Logged out successfully', 'success')
    return redirect(url_for('home'))

def _get_or_create_repo_id(repo_full_name):
    """Get or create repository ID"""
    user_id = session['user_id']
    repo = Repository.query.filter_by(full_name=repo_full_name, user_id=user_id).first()
    
    if repo:
        return repo.id
    
    # If repo doesn't exist, create a minimal one
    try:
        github_service = GitHubService(session['access_token'])
        repo_data = github_service.get_user_repositories(user_id)
        
        # Find the repo in the API response
        target_repo = next((r for r in repo_data if r['full_name'] == repo_full_name), None)
        
        if target_repo:
            new_repo = Repository(
                github_id=str(target_repo['id']),
                user_id=user_id,
                name=target_repo['name'],
                full_name=target_repo['full_name'],
                description=target_repo.get('description'),
                language=target_repo.get('language'),
                private=target_repo['private'],
                clone_url=target_repo['clone_url'],
                html_url=target_repo['html_url'],
                cache_updated_at=datetime.utcnow()
            )
            db.session.add(new_repo)
            db.session.commit()
            return new_repo.id
            
    except Exception as e:
        logging.error(f"Error creating repository record: {e}")
    
    return None

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    return render_template('500.html'), 500
