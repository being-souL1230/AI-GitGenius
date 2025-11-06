import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

def get_database_uri():
    """Get the appropriate database URI based on the environment"""
    # Check for Vercel environment or explicit POSTGRES_URL
    if os.environ.get('VERCEL') or os.environ.get('POSTGRES_URL'):
        db_url = os.environ.get('POSTGRES_URL', '')
        # Convert postgres:// to postgresql+psycopg2:// for SQLAlchemy
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql+psycopg2://', 1)
        return db_url
    # Default to SQLite for local development
    return os.environ.get("DATABASE_URL", "sqlite:///github_test_generator.db")

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = get_database_uri()
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
    "pool_size": 5,
    "max_overflow": 10
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the app with the extension
db.init_app(app)

with app.app_context():
    # Import models to ensure tables are created
    from models import User, TestCase, Repository, UserRepository, UserAnalytics  # noqa: F401
    try:
        db.create_all()
        logging.info("Database tables created/verified")
    except Exception as e:
        logging.error(f"Error creating tables: {e}")
        # Don't raise in production to allow the app to start
        if os.environ.get('FLASK_ENV') != 'production':
            raise

# Import blueprints after db initialization to avoid circular imports
from blueprints.auth import auth_bp
from blueprints.dashboard import dashboard_bp
from blueprints.api import api_bp

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(dashboard_bp, url_prefix='/dashboard')
app.register_blueprint(api_bp, url_prefix='/api')

# Import routes after blueprints to avoid circular imports
import routes  # noqa: F401, E402














