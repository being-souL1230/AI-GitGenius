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
                    "model": "openai/gpt-oss-20b",
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
        """Analyze code quality and provide a comprehensive report with score"""
        prompt = f"""
        # Code Quality Analysis Report
        
        ## 📊 Overall Assessment
        Please analyze the following code and provide a detailed quality assessment.
        
        ```python
        {code_content[:2000]}  # Show first 2000 chars to avoid token limits
        ```
        
        ## 📋 Analysis Sections
        
        ### 1. Code Quality Score (1-10)
        - **Score:** [X.X/10]
        - **Rationale:** Brief explanation of the score
        
        ### 2. Key Findings
        - **✅ Strengths:** 
          - [List key strengths]
        - **⚠️ Areas for Improvement:**
          - [List key issues]
        
        ### 3. Detailed Analysis
        - **Code Structure:** [Analysis of structure]
        - **Best Practices:** [Compliance with language standards]
        - **Performance:** [Performance considerations]
        - **Readability:** [Code readability assessment]
        
        ### 4. Recommendations
        - **Critical Fixes:** [High-priority improvements]
        - **Enhancements:** [Optional improvements]
        - **Tools & Resources:** [Recommended tools/libraries]
        
        ## 🔍 Example Improvements
        ```python
        # Before:
        # [Example of problematic code]
        
        # After:
        # [Improved version of the code]
        ```
        
        **Note:** Format your response in GitHub-flavored markdown with proper headers, code blocks, and emphasis.
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "openai/gpt-oss-20b",
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
        """Generate comprehensive code refactoring suggestions with before/after examples"""
        prompt = f"""
        # 🔄 Code Refactoring Report
        
        ## 📂 File: `{file_path}`
        
        ## 🔍 Code Analysis
        ```{file_path.split('.')[-1] if '.' in file_path else 'text'}
        {code_content[:2000]}  # First 2000 chars to avoid token limits
        ```
        
        ## 📋 Refactoring Recommendations
        
        ### 1. Code Smells Identified
        - [ ] **Issue 1:** [Description] (Lines X-Y)
        - [ ] **Issue 2:** [Description] (Lines A-B)
        
        ### 2. Suggested Refactoring
        
        #### 🔄 Before:
        ```python
        # Original code with issues
        def example():
            # ...
        ```
        
        #### ✅ After:
        ```python
        # Refactored code
        def improved_example():
            # ...
        ```
        
        ### 3. Key Improvements
        - **Performance:** [Specific improvements]
        - **Readability:** [Specific improvements]
        - **Maintainability:** [Specific improvements]
        
        ### 4. Additional Recommendations
        - [ ] [Specific recommendation 1]
        - [ ] [Specific recommendation 2]
        
        ## 🔍 Detailed Analysis
        
        ### 1. Code Quality Assessment:
        - Identify code smells and anti-patterns
        - Assess complexity, readability, and maintainability
        - Highlight areas that need improvement

        ### 2. Specific Refactoring Suggestions:
        - Function extraction opportunities
        - Variable naming improvements
        - Code duplication removal
        - Performance optimizations
        - Design pattern applications

        ### 3. Before and After Examples:
        - Show specific code blocks that need refactoring
        - Provide improved versions with explanations
        - Include step-by-step refactoring process

        ### 4. Best Practices Recommendations:
        - Language-specific best practices
        - SOLID principles application
        - Error handling improvements
        - Documentation suggestions

        ### 5. Impact Assessment:
        - Expected improvements in maintainability
        - Performance benefits
        - Testing implications
        
        **Format your response with clear sections, code examples, and actionable recommendations.**
        Use GitHub-flavored markdown with proper code blocks, headers, and lists.
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "openai/gpt-oss-20b",
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
        """Generate a comprehensive security vulnerability report"""
        prompt = f"""
        # 🔒 Security Analysis Report
        
        ## 🎯 Target
        **File:** `{file_path}`
        
        ## 🔍 Code Sample
        ```{file_path.split('.')[-1] if '.' in file_path else 'text'}
        {code_content[:2000]}  # First 2000 chars to avoid token limits
        ```
        
        ## 📋 Executive Summary
        - **Overall Risk Level:** [Critical/High/Medium/Low]
        - **Vulnerabilities Found:** [Number]
        - **Immediate Actions Required:** [Yes/No]
        
        ## 🚨 Critical Findings (if any)
        
        ### 1. [Vulnerability Name]
        - **Severity:** 🔴 Critical
        - **Location:** `file.py:XX-XX`
        - **Description:** 
          [Detailed description of the vulnerability]
        - **Impact:** 
          [Potential impact if exploited]
        - **Remediation:**
          ```python
          # Before (vulnerable):
          # [Vulnerable code]
          
          # After (fixed):
          # [Secure code]
          ```
        - **References:**
          - [Relevant CVE or security advisory]
          - [OWASP Guide reference]
        
        ## 🔍 Detailed Analysis
        
        ### 1. Security Score
        - **Overall Security Score:** [X/10]
        - **Breakdown:**
          - Authentication: [X/10]
          - Authorization: [X/10]
          - Input Validation: [X/10]
          - Error Handling: [X/10]
        - **Score Justification:** [Brief explanation of the score]
        - **Priority Order for Fixes:** [List of vulnerabilities in order of priority]
        
        ### 2. Security Best Practices
        - [ ] [Specific security practice 1]
        - [ ] [Specific security practice 2]
        
        ### 3. Vulnerability Details
        - **Location:** Line numbers or code sections
        - **Description:** Detailed explanation of the vulnerability
        - **Impact:** Potential consequences if exploited
        - **Proof of Concept:** How the vulnerability could be exploited

        ### 4. Remediation Recommendations
        - **Immediate Fixes:** Critical vulnerabilities that need urgent attention
        - **Code Examples:** Secure code patterns and implementations
        - **Best Practices:** Security best practices for the technology stack
        - **Tools and Libraries:** Recommended security tools and libraries
        
        ## 🛡️ Recommendations
        1. **Immediate Actions:**
           - [ ] [Action 1]
           - [ ] [Action 2]
        
        2. **Long-term Improvements:**
           - [ ] [Improvement 1]
           - [ ] [Improvement 2]
        
        ## 🔍 Additional Security Considerations
        - **Environment-specific Security Concerns:** [Details]
        - **Compliance Requirements:** [If applicable]
        - **Security Testing Recommendations:** [Specific tests to run]
        
        ## 🔗 Additional Resources
        - [OWASP Top 10](https://owasp.org/www-project-top-ten/)
        - [Security Best Practices Guide]
        
        **Format:** Use GitHub-flavored markdown with proper headers, code blocks, and emoji for better readability.
        """
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "openai/gpt-oss-20b",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a cybersecurity expert specializing in code security analysis and vulnerability assessment."
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
            logging.error(f"Error checking for vulnerabilities: {e}")
            return f"Error checking for vulnerabilities: {str(e)}"
    
    def generate_ai_report(self, prompt):
        """Generate AI-powered analytics report"""
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json={
                    "model": "openai/gpt-oss-20b",
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
