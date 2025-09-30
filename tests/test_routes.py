import pytest
from unittest.mock import patch, MagicMock

def test_home_page(client):
    """Test home page loads correctly"""
    response = client.get('/')
    assert response.status_code == 200

def test_home_redirect_when_authenticated(client):
    """Test home page redirects to dashboard when user is authenticated"""
    with client.session_transaction() as sess:
        sess['access_token'] = 'test_token'
    
    response = client.get('/')
    assert response.status_code == 302
    assert '/dashboard' in response.location

def test_github_auth_redirect(client):
    """Test GitHub OAuth redirect"""
    response = client.get('/auth/github')
    assert response.status_code == 302
    assert 'github.com/login/oauth/authorize' in response.location

@patch('routes.requests.post')
@patch('routes.GitHubService')
def test_github_callback_success(mock_github_service, mock_post, client, app):
    """Test successful GitHub OAuth callback"""
    # Mock token response
    mock_token_response = MagicMock()
    mock_token_response.json.return_value = {'access_token': 'test_token'}
    mock_post.return_value = mock_token_response
    
    # Mock GitHub service
    mock_service_instance = MagicMock()
    mock_service_instance.get_user_info.return_value = {
        'id': 12345,
        'login': 'testuser',
        'email': 'test@example.com',
        'avatar_url': 'https://avatar.url'
    }
    mock_github_service.return_value = mock_service_instance
    
    response = client.get('/auth/github/callback?code=test_code')
    assert response.status_code == 302

def test_github_callback_error(client):
    """Test GitHub OAuth callback with error"""
    response = client.get('/auth/github/callback?error=access_denied')
    assert response.status_code == 302
    assert '/' in response.location

def test_github_callback_no_code(client):
    """Test GitHub OAuth callback without code"""
    response = client.get('/auth/github/callback')
    assert response.status_code == 302
    assert '/' in response.location
