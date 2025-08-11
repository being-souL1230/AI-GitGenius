// Global utilities and shared functionality
class Utils {
    static showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        // Add to page
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.appendChild(toast);
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        // Remove after hiding
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }
    
    static formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'js': 'fab fa-js-square',
            'py': 'fab fa-python',
            'java': 'fab fa-java',
            'html': 'fab fa-html5',
            'css': 'fab fa-css3-alt',
            'json': 'fas fa-code',
            'md': 'fab fa-markdown',
            'txt': 'fas fa-file-alt',
            'yml': 'fas fa-file-code',
            'yaml': 'fas fa-file-code',
            'xml': 'fas fa-file-code',
            'sql': 'fas fa-database',
            'sh': 'fas fa-terminal',
            'dockerfile': 'fab fa-docker',
            'gitignore': 'fab fa-git-alt'
        };
        return iconMap[ext] || 'fas fa-file';
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static showLoading(element, message = 'Loading...') {
        element.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }
    
    static hideLoading(element, content = '') {
        element.innerHTML = content;
    }
}

// API client
class ApiClient {
    static async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            if (!response.ok) {
                let errorMessage = 'Request failed';
                try {
                    // Try to parse as JSON first
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (jsonError) {
                    // If JSON parsing fails, try to get text (HTML error pages)
                    try {
                        const errorText = await response.text();
                        // If it's an HTML response, extract meaningful error
                        if (errorText.includes('<html>') || errorText.includes('<!DOCTYPE')) {
                            errorMessage = `Server error (${response.status}): ${response.statusText}`;
                        } else {
                            errorMessage = errorText || errorMessage;
                        }
                    } catch (textError) {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }
                }
                throw new Error(errorMessage);
            }
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                // If not JSON, return as text
                const text = await response.text();
                try {
                    // Try to parse as JSON anyway
                    return JSON.parse(text);
                } catch {
                    // If it fails, throw error about unexpected response
                    throw new Error('Server returned non-JSON response');
                }
            }
        } catch (error) {
            console.error('API request failed:', error);
            if (!error.message.includes('Server returned non-JSON response')) {
                Utils.showToast(error.message || 'Request failed', 'danger');
            }
            throw error;
        }
    }
    
    static async get(url) {
        return this.request(url);
    }
    
    static async post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    static async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    static async delete(url) {
        return this.request(url, {
            method: 'DELETE'
        });
    }
}

// Animation utilities
class AnimationUtils {
    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);
            
            element.style.opacity = opacity;
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    static slideDown(element, duration = 300) {
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.style.display = 'block';
        
        const targetHeight = element.scrollHeight + 'px';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const height = Math.min((progress / duration) * element.scrollHeight, element.scrollHeight);
            
            element.style.height = height + 'px';
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.height = 'auto';
                element.style.overflow = 'visible';
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    static addGlowEffect(element) {
        element.addEventListener('mouseenter', () => {
            element.classList.add('glow');
        });
        
        element.addEventListener('mouseleave', () => {
            element.classList.remove('glow');
        });
    }
    
    static addShimmerEffect(element) {
        element.classList.add('shimmer');
        setTimeout(() => {
            element.classList.remove('shimmer');
        }, 2000);
    }
}

// Initialize common functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add glow effects to interactive elements
    const interactiveElements = document.querySelectorAll('.glass-card, .btn, .nav-link');
    interactiveElements.forEach(element => {
        AnimationUtils.addGlowEffect(element);
    });
    
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add ripple effect to buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Auto-dismiss alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });
});

// Add CSS for ripple effect
const rippleCSS = `
.btn {
    position: relative;
    overflow: hidden;
}

.ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
}

@keyframes ripple-animation {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
`;

// Add ripple CSS to head
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

// Export utilities for use in other files
window.Utils = Utils;
window.ApiClient = ApiClient;
window.AnimationUtils = AnimationUtils;
