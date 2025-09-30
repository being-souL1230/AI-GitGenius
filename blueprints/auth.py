import os
import requests
import logging
from datetime import datetime
from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from app import db, limiter
from models import User
from github_service import GitHubService

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# GitHub OAuth configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "your_github_client_id")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "your_github_client_secret")

@auth_bp.route('/github')
@limiter.limit("10 per minute")
def github_auth():
    """Redirect to GitHub OAuth"""
    callback_url = 'http://localhost:5000/auth/github/callback'
    
    github_auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={GITHUB_CLIENT_ID}&"
        f"redirect_uri={callback_url}&"
        f"scope=repo,user:email&"
        f"state=github_oauth"
    )
    
    logging.info(f"GitHub OAuth redirect URL: {github_auth_url}")
    return redirect(github_auth_url)

@auth_bp.route('/github/callback')
@limiter.limit("5 per minute")
def github_callback():
    """Handle GitHub OAuth callback"""
    code = request.args.get('code')
    error = request.args.get('error')
    
    if error:
        flash(f'GitHub authorization failed: {error}', 'error')
        return redirect(url_for('main.home'))
    
    if not code:
        flash('Authorization failed - no code received', 'error')
        return redirect(url_for('main.home'))
    
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
            return redirect(url_for('main.home'))
        
        # Get user info from GitHub
        github_service = GitHubService(access_token)
        user_info = github_service.get_user_info()
        
        if not user_info:
            flash('Failed to get user information', 'error')
            return redirect(url_for('main.home'))
        
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
        session['access_token'] = access_token
        session['user_id'] = user.id
        session['username'] = user.username
        session.permanent = True
        
        flash(f'Successfully logged in as {user.username}!', 'success')
        return redirect(url_for('dashboard.dashboard'))
        
    except Exception as e:
        logging.error(f"OAuth callback error: {e}")
        flash('Authentication failed. Please try again.', 'error')
        return redirect(url_for('main.home'))

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """User logout"""
    session.clear()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('main.home'))
