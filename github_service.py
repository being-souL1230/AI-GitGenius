import requests
import os
import logging
from datetime import datetime, timedelta
from app import db
from models import Repository
from urllib.parse import quote

class GitHubService:
    def __init__(self, access_token):
        self.access_token = access_token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json"
        }
    
    def get_user_info(self):
        """Get authenticated user information"""
        try:
            response = requests.get(f"{self.base_url}/user", headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching user info: {e}")
            return None
    
    def get_user_repositories(self, user_id):
        """Get user repositories with caching"""
        try:
            # Check cache first
            cached_repos = Repository.query.filter_by(user_id=user_id).all()
            
            # If cache is recent (less than 1 hour), use it
            if cached_repos and all(repo.cache_updated_at and 
                                  datetime.utcnow() - repo.cache_updated_at < timedelta(hours=1) 
                                  for repo in cached_repos):
                return [self._repo_to_dict(repo) for repo in cached_repos]
            
            # Fetch from GitHub API
            response = requests.get(f"{self.base_url}/user/repos", 
                                  headers=self.headers, 
                                  params={"per_page": 100, "sort": "updated"})
            response.raise_for_status()
            repos_data = response.json()
            
            # Update cache
            self._update_repository_cache(user_id, repos_data)
            
            return repos_data
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching repositories: {e}")
            return []
    
    def get_repository_contents(self, full_name, path=""):
        """Get repository contents (files and folders)"""
        try:
            encoded_path = quote(path) if path else ""
            url = f"{self.base_url}/repos/{full_name}/contents/{encoded_path}"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching repository contents: {e}")
            return []
    
    def get_file_content(self, full_name, file_path):
        """Get file content"""
        try:
            encoded_path = quote(file_path)
            url = f"{self.base_url}/repos/{full_name}/contents/{encoded_path}"
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            
            if data.get('encoding') == 'base64':
                import base64
                content = base64.b64decode(data['content']).decode('utf-8')
                return content
            return data.get('content', '')
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching file content: {e}")
            return None
    
    def get_pull_requests(self, full_name):
        """Get repository pull requests"""
        try:
            url = f"{self.base_url}/repos/{full_name}/pulls"
            response = requests.get(url, headers=self.headers, params={"state": "all"})
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching pull requests: {e}")
            return []
    
    def create_file(self, full_name, file_path, content, message):
        """Create or update a file in repository"""
        try:
            encoded_path = quote(file_path)
            url = f"{self.base_url}/repos/{full_name}/contents/{encoded_path}"
            
            # Check if file exists
            existing = requests.get(url, headers=self.headers)
            
            data = {
                "message": message,
                "content": content
            }
            
            if existing.status_code == 200:
                # File exists, need SHA for update
                data["sha"] = existing.json()["sha"]
            
            response = requests.put(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error creating/updating file: {e}")
            return None
    
    def _update_repository_cache(self, user_id, repos_data):
        """Update repository cache in database"""
        try:
            # Clear existing cache for user
            Repository.query.filter_by(user_id=user_id).delete()
            
            # Add new repositories
            for repo_data in repos_data:
                repo = Repository(
                    github_id=str(repo_data['id']),
                    user_id=user_id,
                    name=repo_data['name'],
                    full_name=repo_data['full_name'],
                    description=repo_data.get('description'),
                    language=repo_data.get('language'),
                    private=repo_data['private'],
                    clone_url=repo_data['clone_url'],
                    html_url=repo_data['html_url'],
                    cache_updated_at=datetime.utcnow()
                )
                db.session.add(repo)
            
            db.session.commit()
        except Exception as e:
            logging.error(f"Error updating repository cache: {e}")
            db.session.rollback()
    
    def _repo_to_dict(self, repo):
        """Convert repository model to dictionary"""
        return {
            'id': repo.github_id,
            'name': repo.name,
            'full_name': repo.full_name,
            'description': repo.description,
            'language': repo.language,
            'private': repo.private,
            'clone_url': repo.clone_url,
            'html_url': repo.html_url
        }
