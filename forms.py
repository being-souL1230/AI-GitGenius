from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, SelectField, HiddenField, SubmitField
from wtforms.validators import DataRequired, Length, Optional, ValidationError
import re

class TestGenerationForm(FlaskForm):
    """Form for test case generation"""
    repository_id = HiddenField('Repository ID', validators=[DataRequired()])
    file_path = StringField('File Path', validators=[DataRequired(), Length(min=1, max=500)])
    technology = SelectField('Technology', 
                            choices=[
                                ('python', 'Python'),
                                ('javascript', 'JavaScript'),
                                ('java', 'Java'),
                                ('csharp', 'C#'),
                                ('go', 'Go'),
                                ('rust', 'Rust'),
                                ('typescript', 'TypeScript'),
                                ('php', 'PHP'),
                                ('ruby', 'Ruby'),
                                ('other', 'Other')
                            ],
                            validators=[DataRequired()])
    edge_cases = TextAreaField('Edge Cases (optional)', 
                              validators=[Optional(), Length(max=1000)])
    submit = SubmitField('Generate Tests')
    
    def validate_file_path(self, field):
        """Validate file path format"""
        if not re.match(r'^[a-zA-Z0-9._/-]+$', field.data):
            raise ValidationError('Invalid file path format')

class RepositorySelectionForm(FlaskForm):
    """Form for repository selection"""
    repository_id = SelectField('Select Repository', 
                               coerce=int,
                               validators=[DataRequired()])
    submit = SubmitField('Select Repository')

class CodeAnalysisForm(FlaskForm):
    """Form for code analysis requests"""
    repository_id = HiddenField('Repository ID', validators=[DataRequired()])
    file_paths = TextAreaField('File Paths (one per line)', 
                              validators=[DataRequired(), Length(min=1, max=2000)])
    analysis_type = SelectField('Analysis Type',
                               choices=[
                                   ('quality', 'Code Quality'),
                                   ('security', 'Security Analysis'),
                                   ('performance', 'Performance Analysis'),
                                   ('refactor', 'Refactoring Suggestions')
                               ],
                               validators=[DataRequired()])
    submit = SubmitField('Analyze Code')
    
    def validate_file_paths(self, field):
        """Validate file paths format"""
        paths = field.data.strip().split('\n')
        for path in paths:
            path = path.strip()
            if path and not re.match(r'^[a-zA-Z0-9._/-]+$', path):
                raise ValidationError(f'Invalid file path format: {path}')

class FeedbackForm(FlaskForm):
    """Form for user feedback"""
    test_case_id = HiddenField('Test Case ID', validators=[DataRequired()])
    rating = SelectField('Rating',
                        choices=[
                            ('1', '1 - Poor'),
                            ('2', '2 - Fair'),
                            ('3', '3 - Good'),
                            ('4', '4 - Very Good'),
                            ('5', '5 - Excellent')
                        ],
                        validators=[DataRequired()])
    feedback = TextAreaField('Feedback (optional)',
                           validators=[Optional(), Length(max=500)])
    submit = SubmitField('Submit Feedback')
