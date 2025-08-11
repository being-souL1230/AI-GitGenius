import requests
import os
import json
import logging

class GroqService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "default_groq_key")
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def generate_test_cases(self, file_content, file_path, technology, edge_cases):
        """Generate comprehensive test cases for given code"""
        prompt = self._create_test_generation_prompt(file_content, file_path, technology, edge_cases)
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert software testing engineer. Generate comprehensive, production-ready test cases."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 6000,
                    "temperature": 0.3
                }
            )
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            logging.error(f"Error generating test cases: {e}")
            return f"Error generating test cases: {str(e)}"
    
    def analyze_code_quality(self, code_content):
        """Analyze code quality and provide a score"""
        prompt = f"""
        Analyze the following code for quality, readability, maintainability, and best practices.
        Provide a score from 1-10 and brief explanation.
        
        Code:
        {code_content}
        
        Return response in JSON format:
        {{
            "score": 8.5,
            "explanation": "Brief explanation of the score"
        }}
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a code quality expert. Analyze code and provide scores."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 500,
                    "temperature": 0.2
                }
            )
            response.raise_for_status()
            result = response.json()
            content = result['choices'][0]['message']['content']
            
            # Try to parse JSON response
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return {"score": 5.0, "explanation": "Could not parse quality analysis"}
        except requests.exceptions.RequestException as e:
            logging.error(f"Error analyzing code quality: {e}")
            return {"score": 5.0, "explanation": f"Error: {str(e)}"}
    
    def refactor_code(self, code_content, file_path):
        """Suggest code refactoring improvements"""
        prompt = f"""
        You are an expert software engineer specializing in code refactoring and optimization. Analyze the following code and provide comprehensive refactoring suggestions.

        **File:** {file_path}
        **Code to Analyze:**
        ```{file_path.split('.')[-1] if '.' in file_path else 'text'}
        {code_content}
        ```

        **Please provide a detailed analysis including:**

        1. **Code Quality Assessment:**
           - Identify code smells and anti-patterns
           - Assess complexity, readability, and maintainability
           - Highlight areas that need improvement

        2. **Specific Refactoring Suggestions:**
           - Function extraction opportunities
           - Variable naming improvements
           - Code duplication removal
           - Performance optimizations
           - Design pattern applications

        3. **Before and After Examples:**
           - Show specific code blocks that need refactoring
           - Provide improved versions with explanations
           - Include step-by-step refactoring process

        4. **Best Practices Recommendations:**
           - Language-specific best practices
           - SOLID principles application
           - Error handling improvements
           - Documentation suggestions

        5. **Impact Assessment:**
           - Expected improvements in maintainability
           - Performance benefits
           - Testing implications

        **Format your response with clear sections, code examples, and actionable recommendations.**
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a senior software engineer specializing in code refactoring and optimization."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.3
                }
            )
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            logging.error(f"Error refactoring code: {e}")
            return f"Error analyzing code: {str(e)}"
    
    def check_vulnerabilities(self, code_content, file_path):
        """Check code for security vulnerabilities"""
        prompt = f"""
        You are a cybersecurity expert specializing in code security analysis. Perform a comprehensive security audit of the following code.

        **File:** {file_path}
        **Code to Analyze:**
        ```{file_path.split('.')[-1] if '.' in file_path else 'text'}
        {code_content}
        ```

        **Please provide a detailed security analysis including:**

        1. **Security Vulnerability Assessment:**
           - Identify all potential security vulnerabilities
           - Categorize by severity (Critical, High, Medium, Low)
           - Explain the security implications of each issue

        2. **Specific Vulnerabilities to Check:**
           - **SQL Injection:** Unvalidated database queries
           - **Cross-Site Scripting (XSS):** Unsanitized user input
           - **Code Injection:** Dynamic code execution risks
           - **Path Traversal:** File path manipulation
           - **Authentication Issues:** Weak authentication mechanisms
           - **Authorization Flaws:** Insufficient access controls
           - **Input Validation:** Missing or weak input validation
           - **Output Encoding:** Unsafe output rendering
           - **Cryptographic Issues:** Weak encryption or hashing
           - **Session Management:** Session security problems

        3. **Detailed Findings:**
           - **Vulnerability Type:** Specific security issue
           - **Severity Level:** Critical/High/Medium/Low
           - **Location:** Line numbers or code sections
           - **Description:** Detailed explanation of the vulnerability
           - **Impact:** Potential consequences if exploited
           - **Proof of Concept:** How the vulnerability could be exploited

        4. **Remediation Recommendations:**
           - **Immediate Fixes:** Critical vulnerabilities that need urgent attention
           - **Code Examples:** Secure code patterns and implementations
           - **Best Practices:** Security best practices for the technology stack
           - **Tools and Libraries:** Recommended security tools and libraries

        5. **Security Score:**
           - Provide an overall security score (1-10)
           - Justify the score based on findings
           - Suggest priority order for fixes

        6. **Additional Security Considerations:**
           - Environment-specific security concerns
           - Compliance requirements (if applicable)
           - Security testing recommendations

        **Format your response with clear sections, severity indicators, and actionable security recommendations.**
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a cybersecurity expert specializing in code security analysis."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.2
                }
            )
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
        except requests.exceptions.RequestException as e:
            logging.error(f"Error checking vulnerabilities: {e}")
            return f"Error analyzing security: {str(e)}"
    
    def generate_ai_report(self, prompt):
        """Generate AI-powered analytics report"""
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "llama3-8b-8192",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an expert software development analyst and technical writer. Create comprehensive, insightful, and actionable analytics reports that help developers understand their performance and improve their workflow. Use clear language, provide specific recommendations, and format responses in HTML with proper styling."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.7
                }
            )
            response.raise_for_status()
            result = response.json()
            return result['choices'][0]['message']['content']
            
        except Exception as e:
            logging.error(f"Error generating AI report: {e}")
            return f"""
            <h3>📊 Analytics Summary</h3>
            <p>Unable to generate AI insights at this time. Here's a basic summary of your development activity:</p>
            <ul>
                <li>Continue focusing on code quality and security best practices</li>
                <li>Regular code analysis helps maintain high standards</li>
                <li>Consider implementing automated testing workflows</li>
            </ul>
            """
    
    def _create_test_generation_prompt(self, file_content, file_path, technology, edge_cases):
        """Create a comprehensive prompt for test case generation"""
        edge_cases_text = ", ".join(edge_cases) if edge_cases else "standard edge cases"
        
        return f"""
        Generate comprehensive test cases for the following code file.
        
        File Path: {file_path}
        Technology: {technology}
        Edge Cases to Include: {edge_cases_text}
        
        Code:
        {file_content}
        
        Requirements:
        1. Generate a complete test file that can be executed immediately
        2. Include imports and setup code
        3. Cover all functions/methods in the original code
        4. Include unit tests, integration tests where applicable
        5. Test edge cases: {edge_cases_text}
        6. Include positive and negative test scenarios
        7. Add proper assertions and error handling tests
        8. Follow {technology} testing best practices
        9. Include docstrings explaining each test
        10. Make tests maintainable and readable
        
        Generate the complete test file with proper structure and naming conventions.
        """
