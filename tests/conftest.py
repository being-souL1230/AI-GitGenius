import pytest
import os
import tempfile
from app import create_app, db
from models import User, Repository, TestCase

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app('testing')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()
    
    os.close(db_fd)
    os.unlink(db_path)

@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()

@pytest.fixture
def runner(app):
    """A test runner for the app's Click commands."""
    return app.test_cli_runner()

@pytest.fixture
def sample_user(app):
    """Create a sample user for testing."""
    with app.app_context():
        user = User(
            github_id="12345",
            username="testuser",
            email="test@example.com",
            access_token="test_token"
        )
        db.session.add(user)
        db.session.commit()
        return user

@pytest.fixture
def sample_repository(app, sample_user):
    """Create a sample repository for testing."""
    with app.app_context():
        repo = Repository(
            github_id="67890",
            user_id=sample_user.id,
            name="test-repo",
            full_name="testuser/test-repo",
            description="Test repository",
            language="Python",
            clone_url="https://github.com/testuser/test-repo.git",
            html_url="https://github.com/testuser/test-repo"
        )
        db.session.add(repo)
        db.session.commit()
        return repo
