import pytest
from datetime import datetime
from models import User, Repository, TestCase, Analytics

def test_user_creation(app):
    """Test user model creation"""
    with app.app_context():
        user = User(
            github_id="12345",
            username="testuser",
            email="test@example.com",
            access_token="test_token"
        )
        assert user.github_id == "12345"
        assert user.username == "testuser"
        assert user.email == "test@example.com"

def test_repository_creation(app, sample_user):
    """Test repository model creation"""
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
        assert repo.github_id == "67890"
        assert repo.name == "test-repo"
        assert repo.language == "Python"

def test_test_case_creation(app, sample_user, sample_repository):
    """Test test case model creation"""
    with app.app_context():
        test_case = TestCase(
            user_id=sample_user.id,
            repository_id=sample_repository.id,
            file_path="test_file.py",
            test_content="def test_example(): pass",
            technology="python",
            quality_score=8.5
        )
        assert test_case.file_path == "test_file.py"
        assert test_case.technology == "python"
        assert test_case.quality_score == 8.5

def test_user_repository_relationship(app, sample_user, sample_repository):
    """Test user-repository relationship"""
    with app.app_context():
        assert sample_repository in sample_user.repositories
        assert sample_repository.user == sample_user
