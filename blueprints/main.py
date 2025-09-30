from flask import Blueprint, render_template, session, redirect, url_for

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def home():
    """Home page - login if not authenticated"""
    if 'access_token' in session:
        return redirect(url_for('dashboard.dashboard'))
    return render_template('home.html')

@main_bp.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    return render_template('404.html'), 404

@main_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return render_template('500.html'), 500
