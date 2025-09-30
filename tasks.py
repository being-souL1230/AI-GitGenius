import json
import logging
from datetime import datetime, timedelta

@celery.task(bind=True)
def generate_test_cases_async(self, user_id, repository_id, file_path, technology, edge_cases=None):
    """Asynchronously generate test cases"""
    app = create_app()
    
    with app.app_context():
        try:
            # Update task status
            self.update_state(state='PROGRESS', meta={'current': 10, 'total': 100, 'status': 'Starting...'})
            
            # Get user and repository
            user = User.query.get(user_id)
            repository = Repository.query.get(repository_id)
            
            if not user or not repository:
                raise Exception("User or repository not found")
            
            self.update_state(state='PROGRESS', meta={'current': 20, 'total': 100, 'status': 'Fetching file content...'})
            
            # Get file content from GitHub
            github_service = GitHubService(user.access_token)
            file_content = github_service.get_file_content(repository.full_name, file_path)
            
            if not file_content:
                raise Exception("Could not retrieve file content")
            
            self.update_state(state='PROGRESS', meta={'current': 40, 'total': 100, 'status': 'Generating test cases...'})
            
            # Generate test cases using Groq
            groq_service = GroqService()
            test_content = groq_service.generate_test_cases(
                file_content, file_path, technology, edge_cases
            )
            
            self.update_state(state='PROGRESS', meta={'current': 70, 'total': 100, 'status': 'Analyzing quality...'})
            
            # Analyze quality
            quality_analysis = groq_service.analyze_code_quality(test_content)
            
            self.update_state(state='PROGRESS', meta={'current': 90, 'total': 100, 'status': 'Saving results...'})
            
            # Save test case
            test_case = TestCase(
                user_id=user_id,
                repository_id=repository_id,
                file_path=file_path,
                test_content=test_content,
                technology=technology,
                edge_cases=json.loads(edge_cases) if edge_cases else None,
                quality_score=quality_analysis.get('score', 5.0)
            )
            
            db.session.add(test_case)
            db.session.commit()
            
            # Update analytics
            update_user_analytics.delay(user_id)
            
            return {
                'test_case_id': test_case.id,
                'test_content': test_content,
                'quality_score': quality_analysis.get('score', 5.0),
                'quality_explanation': quality_analysis.get('explanation', ''),
                'status': 'completed'
            }
            
        except Exception as e:
            logging.error(f"Test generation task failed: {e}")
            self.update_state(
                state='FAILURE',
                meta={'error': str(e), 'status': 'Failed to generate test cases'}
            )
            raise

@celery.task
def update_user_analytics(user_id):
    """Update user analytics data"""
    app = create_app()
    
    with app.app_context():
        try:
            user = User.query.get(user_id)
            if not user:
                return
            
            # Get or create analytics record
            analytics = Analytics.query.filter_by(user_id=user_id).first()
            if not analytics:
                analytics = Analytics(user_id=user_id)
                db.session.add(analytics)
            
            # Calculate statistics
            total_test_cases = TestCase.query.filter_by(user_id=user_id).count()
            total_repos = Repository.query.filter_by(user_id=user_id).count()
            
            # Calculate average quality score
            avg_quality = db.session.query(db.func.avg(TestCase.quality_score))\
                                   .filter_by(user_id=user_id).scalar() or 0.0
            
            # Technology breakdown
            tech_breakdown = {}
            tech_stats = db.session.query(TestCase.technology, db.func.count(TestCase.id))\
                                  .filter_by(user_id=user_id)\
                                  .group_by(TestCase.technology).all()
            
            for tech, count in tech_stats:
                tech_breakdown[tech] = count
            
            # Update analytics
            analytics.total_files_generated = total_test_cases
            analytics.total_repos = total_repos
            analytics.average_quality_score = round(avg_quality, 2)
            analytics.technology_breakdown = tech_breakdown
            analytics.last_updated = datetime.utcnow()
            
            db.session.commit()
            logging.info(f"Updated analytics for user {user_id}")
            
        except Exception as e:
            logging.error(f"Analytics update failed for user {user_id}: {e}")
            db.session.rollback()

@celery.task
def cleanup_old_test_cases():
    """Clean up old test cases (older than 30 days)"""
    app = create_app()
    
    with app.app_context():
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            old_test_cases = TestCase.query.filter(TestCase.created_at < cutoff_date).all()
            
            count = len(old_test_cases)
            for test_case in old_test_cases:
                db.session.delete(test_case)
            
            db.session.commit()
            logging.info(f"Cleaned up {count} old test cases")
            
        except Exception as e:
            logging.error(f"Cleanup task failed: {e}")
            db.session.rollback()

@celery.task
def sync_repositories(user_id):
    """Sync user repositories from GitHub"""
    app = create_app()
    
    with app.app_context():
        try:
            user = User.query.get(user_id)
            if not user:
                return
            
            github_service = GitHubService(user.access_token)
            repos_data = github_service.get_user_repositories(user_id)
            
            # Update repository cache
            for repo_data in repos_data:
                existing_repo = Repository.query.filter_by(
                    github_id=str(repo_data['id']),
                    user_id=user_id
                ).first()
                
                if existing_repo:
                    # Update existing repository
                    existing_repo.name = repo_data['name']
                    existing_repo.description = repo_data.get('description')
                    existing_repo.language = repo_data.get('language')
                    existing_repo.cache_updated_at = datetime.utcnow()
                else:
                    # Create new repository record
                    new_repo = Repository(
                        github_id=str(repo_data['id']),
                        user_id=user_id,
                        name=repo_data['name'],
                        full_name=repo_data['full_name'],
                        description=repo_data.get('description'),
                        language=repo_data.get('language'),
                        private=repo_data.get('private', False),
                        clone_url=repo_data['clone_url'],
                        html_url=repo_data['html_url'],
                        cache_updated_at=datetime.utcnow()
                    )
                    db.session.add(new_repo)
            
            db.session.commit()
            logging.info(f"Synced repositories for user {user_id}")
            
        except Exception as e:
            logging.error(f"Repository sync failed for user {user_id}: {e}")
            db.session.rollback()
