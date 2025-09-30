#!/usr/bin/env python3
"""Test script to verify all imports work correctly"""

print("Testing imports...")

try:
    print("1. Testing app import...")
    from app import app, db
    print("✅ App imported successfully")
    
    print("2. Testing models import...")
    import models
    print("✅ Models imported successfully")
    
    print("3. Testing routes import...")
    import routes
    print("✅ Routes imported successfully")
    
    print("4. Testing blueprints import...")
    from blueprints.main import main_bp
    from blueprints.auth import auth_bp
    from blueprints.dashboard import dashboard_bp
    from blueprints.api import api_bp
    print("✅ Blueprints imported successfully")
    
    print("5. Testing services import...")
    from github_service import GitHubService
    from groq_service import GroqService
    print("✅ Services imported successfully")
    
    print("6. Testing forms import...")
    from forms import TestGenerationForm
    print("✅ Forms imported successfully")
    
    print("\n🎉 All imports successful! The application should start properly.")
    
    # Test app context
    with app.app_context():
        print("7. Testing app context...")
        print(f"✅ App context works. Database URI: {app.config.get('SQLALCHEMY_DATABASE_URI', 'Not set')}")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")

print("\nTesting complete. You can now run: python main.py")
