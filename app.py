import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
if os.environ.get('VERCEL'):  # Running on Vercel with Turso
    TURSO_DATABASE_URL = os.environ.get('TURSO_DATABASE_URL')
    TURSO_AUTH_TOKEN = os.environ.get('TURSO_AUTH_TOKEN')
    
    if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN:
        # For Turso, we'll use a custom connection pool
        DATABASE_URL = f"{TURSO_DATABASE_URL}?authToken={TURSO_AUTH_TOKEN}"
        # Set a flag to use libsql-client
        os.environ['USE_LIBSQL_CLIENT'] = '1'
    else:
        raise ValueError("Turso database configuration is missing")
else:  # Local or Render environment
    # For local development, use SQLite
    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///github_test_generator.db')

if os.environ.get('USE_LIBSQL_CLIENT'):
    # Configure SQLAlchemy to use libsql-client
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_URL}"
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize the database
db = SQLAlchemy(app, model_class=Base)

# Import models after db is initialized to avoid circular imports
with app.app_context():
    from models import *  # noqa: F401
    db.create_all()
    logging.info("Database tables created")














