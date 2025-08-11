// Dashboard functionality for GitHub Test Generator
class Dashboard {
    constructor() {
        this.currentTab = 'repository';
        this.selectedFiles = new Map(); // Map of repo_name -> Set of file paths
        this.currentRepo = null;
        this.currentRepoContents = new Map(); // Cache for repository contents
        this.monacoEditor = null;
        this.qualityChart = null;
        
        this.init();
    }
    
    init() {
        this.initTabNavigation();
        this.initRepositoryTab();
        this.initGeneratorTab();
        this.initAnalyticsTab();
        this.initPullRequestsTab();
        this.initModals();
        this.initMonacoEditor();
        
        // Load initial data
        this.loadRepositories();
        this.loadAnalytics();
    }
    
    // Tab Navigation
    initTabNavigation() {
        const navLinks = document.querySelectorAll('.sidebar .nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = link.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    }
    
    switchTab(tabName) {
        // Update nav active state
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update content active state
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Clear analytics auto-refresh when leaving analytics tab
        if (this.analyticsInterval && tabName !== 'analytics') {
            clearInterval(this.analyticsInterval);
            this.analyticsInterval = null;
        }
        
        this.currentTab = tabName;
        
        // Load tab-specific data
        this.loadTabData(tabName);
    }
    
    loadTabData(tabName) {
        switch(tabName) {
            case 'repository':
                this.loadRepositories();
                break;
            case 'test-cases':
                // Add a sample test case if storage is empty
                const existingTestCases = this.getTestCasesFromStorage();
                if (existingTestCases.length === 0) {
                    this.addSampleTestCase();
                }
                this.loadTestCases();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'pull-requests':
                this.loadPullRequests();
                break;
        }
    }
    
    // Repository Tab
    initRepositoryTab() {
        // Repository loading is handled in loadRepositories()
    }
    
    async loadRepositories() {
        const container = document.getElementById('repository-list');
        Utils.showLoading(container);
        
        try {
            const repos = await ApiClient.get('/api/repositories');
            this.renderRepositories(repos);
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Failed to load repositories: ${error.message}
                </div>
            `;
        }
    }
    
    renderRepositories(repos) {
        const container = document.getElementById('repository-list');
        
        if (!repos || repos.length === 0) {
            container.innerHTML = `
                <div class="empty-state text-center p-5">
                    <i class="fas fa-folder-open fa-3x mb-3 text-muted"></i>
                    <h4>No repositories found</h4>
                    <p class="text-muted">Connect to GitHub and create some repositories to get started.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = repos.map(repo => `
            <div class="glass-card repo-card" data-repo="${repo.full_name}">
                <div class="repo-header">
                    <div class="repo-info">
                        <h4>${repo.name}</h4>
                        <small class="repo-fullname">${repo.full_name}</small>
                    </div>
                    <div class="repo-stats">
                        <span class="badge bg-secondary">${repo.private ? 'Private' : 'Public'}</span>
                    </div>
                </div>
                
                <div class="repo-description">
                    ${repo.description || 'No description available'}
                </div>
                
                <div class="repo-footer">
                    <div class="language-tag">
                        ${repo.language || 'Unknown'}
                    </div>
                    <div class="repo-actions">
                        <button class="btn btn-sm btn-outline-primary browse-btn" data-repo="${repo.full_name}">
                            <i class="fas fa-folder-open me-1"></i>Browse
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.browse-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const repoName = btn.getAttribute('data-repo');
                this.openFileBrowser(repoName);
            });
        });
        
        // Add repo card click handlers
        container.querySelectorAll('.repo-card').forEach(card => {
            card.addEventListener('click', () => {
                const repoName = card.getAttribute('data-repo');
                this.openFileBrowser(repoName);
            });
        });
        
        // Add animations (premium feel with fade-in)
        container.querySelectorAll('.repo-card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('fade-in');
            }, index * 100);
        });
    }
    
    // File Browser Modal
    async openFileBrowser(repoName) {
        this.currentRepo = repoName;
        document.getElementById('modal-repo-name').textContent = repoName;
        
        const modal = new bootstrap.Modal(document.getElementById('fileBrowserModal'));
        modal.show();
        
        await this.loadRepositoryContents(repoName);
    }
    
    async loadRepositoryContents(repoName, path = '') {
        const treeContainer = document.getElementById('file-tree');
        
        if (path === '') {
            Utils.showLoading(treeContainer);
        }
        
        try {
            const contents = await ApiClient.get(`/api/repository/${encodeURIComponent(repoName)}/contents?path=${encodeURIComponent(path)}`);
            
            if (path === '') {
                this.currentRepoContents.set(repoName, contents);
                this.renderFileTree(contents, repoName);
            } else {
                // Handle folder expansion
                this.expandFolder(path, contents);
            }
        } catch (error) {
            if (path === '') {
                treeContainer.innerHTML = `
                    <div class="alert alert-danger">
                        Failed to load repository contents: ${error.message}
                    </div>
                `;
            }
        }
    }
    
    renderFileTree(contents, repoName, parentElement = null) {
        const container = parentElement || document.getElementById('file-tree');
        
        if (!parentElement) {
            container.innerHTML = '';
        }
        
        const sortedContents = contents.sort((a, b) => {
            // Folders first, then files
            if (a.type === 'dir' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });
        
        sortedContents.forEach(item => {
            const fileItem = this.createFileItem(item, repoName);
            container.appendChild(fileItem);
        });
        
        this.updateSelectedCount();
    }
    
    createFileItem(item, repoName, level = 0) {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.style.paddingLeft = `${level * 20 + 10}px`;
        div.setAttribute('data-path', item.path);
        div.setAttribute('data-type', item.type);
        
        const isFile = item.type === 'file';
        const icon = isFile ? Utils.getFileIcon(item.name) : 'fas fa-folder';
        
        div.innerHTML = `
            ${isFile ? `<input type="checkbox" class="file-checkbox" data-repo="${repoName}" data-path="${item.path}">` : ''}
            <i class="${icon} ${isFile ? '' : 'folder'}"></i>
            <span class="file-name">${item.name}</span>
            ${isFile ? `
                <div class="file-actions">
                    <button class="btn btn-xs btn-outline-info" data-action="preview" title="Preview">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-xs btn-outline-warning" data-action="refactor" title="Refactor">
                        <i class="fas fa-wrench"></i>
                    </button>
                    <button class="btn btn-xs btn-outline-danger" data-action="vulnerability" title="Security Check">
                        <i class="fas fa-shield-alt"></i>
                    </button>
                </div>
            ` : ''}
        `;
        
        // Add event listeners
        if (isFile) {
            const checkbox = div.querySelector('.file-checkbox');
            checkbox.addEventListener('change', () => {
                this.toggleFileSelection(repoName, item.path, checkbox.checked);
            });
            
            div.querySelector('[data-action="preview"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.previewFile(repoName, item.path);
            });
            
            div.querySelector('[data-action="refactor"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.analyzeCode(repoName, item.path, 'refactor');
            });
            
            div.querySelector('[data-action="vulnerability"]').addEventListener('click', (e) => {
                e.stopPropagation();
                this.analyzeCode(repoName, item.path, 'vulnerability');
            });
        } else {
            div.addEventListener('click', () => {
                this.toggleFolder(div, repoName, item.path);
            });
        }
        
        return div;
    }
    
    async toggleFolder(folderElement, repoName, path) {
        const expanded = folderElement.hasAttribute('data-expanded');
        
        if (expanded) {
            // Collapse folder
            const subItems = folderElement.parentNode.querySelectorAll(`[data-path^="${path}/"]`);
            subItems.forEach(item => item.remove());
            folderElement.removeAttribute('data-expanded');
            folderElement.querySelector('i').className = 'fas fa-folder folder';
        } else {
            // Expand folder
            try {
                const contents = await ApiClient.get(`/api/repository/${encodeURIComponent(repoName)}/contents?path=${encodeURIComponent(path)}`);
                const level = (folderElement.style.paddingLeft.match(/\d+/) || [0])[0] / 20 + 1;
                
                contents.forEach(item => {
                    const fileItem = this.createFileItem(item, repoName, level);
                    folderElement.insertAdjacentElement('afterend', fileItem);
                });
                
                folderElement.setAttribute('data-expanded', 'true');
                folderElement.querySelector('i').className = 'fas fa-folder-open folder';
            } catch (error) {
                Utils.showToast(`Failed to load folder contents: ${error.message}`, 'danger');
            }
        }
    }
    
    toggleFileSelection(repoName, filePath, selected) {
        if (!this.selectedFiles.has(repoName)) {
            this.selectedFiles.set(repoName, new Set());
        }
        
        const repoFiles = this.selectedFiles.get(repoName);
        if (selected) {
            repoFiles.add(filePath);
        } else {
            repoFiles.delete(filePath);
        }
        
        this.updateSelectedCount();
        this.updateGeneratorTab();
    }
    
    updateSelectedCount() {
        let totalSelected = 0;
        this.selectedFiles.forEach(files => {
            totalSelected += files.size;
        });
        
        const countElement = document.getElementById('selected-files-count');
        if (countElement) {
            countElement.textContent = `${totalSelected} files selected`;
        }
        
        const addButton = document.getElementById('add-to-generator-btn');
        if (addButton) {
            addButton.disabled = totalSelected === 0;
        }
    }
    
    async previewFile(repoName, filePath) {
        const previewContainer = document.getElementById('file-preview');
        Utils.showLoading(previewContainer);
        
        try {
            const response = await ApiClient.get(`/api/repository/${encodeURIComponent(repoName)}/file?path=${encodeURIComponent(filePath)}`);
            const content = response.content;
            
            previewContainer.innerHTML = `
                <div class="file-preview-header">
                    <h6>${filePath}</h6>
                </div>
                <pre><code class="language-auto">${this.escapeHtml(content || 'No content available')}</code></pre>
            `;
            
            // Enable action buttons
            document.getElementById('refactor-btn').disabled = false;
            document.getElementById('vulnerability-btn').disabled = false;
            
            // Store current file for analysis
            this.currentPreviewFile = { repo: repoName, path: filePath, content };
        } catch (error) {
            previewContainer.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load file: ${error.message}
                </div>
            `;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Generator Tab
    initGeneratorTab() {
        const generateBtn = document.getElementById('generate-tests-btn');
        const commitBtn = document.getElementById('commit-tests-btn');
        const addToGeneratorBtn = document.getElementById('add-to-generator-btn');
        const copyBtn = document.getElementById('copy-tests-btn');
        const maximizeBtn = document.getElementById('maximize-editor-btn');
        const copyMaximizedBtn = document.getElementById('copy-tests-maximized-btn');
        
        generateBtn.addEventListener('click', () => this.generateTests());
        commitBtn.addEventListener('click', () => this.commitTests());
        
        if (addToGeneratorBtn) {
            addToGeneratorBtn.addEventListener('click', () => {
                this.addSelectedFilesToGenerator();
                bootstrap.Modal.getInstance(document.getElementById('fileBrowserModal')).hide();
            });
        }
        
        // Copy button functionality
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyTestContent());
        }
        
        // Maximize button functionality
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => this.maximizeEditor());
        }
        
        // Copy button in maximized modal
        if (copyMaximizedBtn) {
            copyMaximizedBtn.addEventListener('click', () => this.copyTestContent(true));
        }
        
        // Select all / deselect all buttons
        document.getElementById('select-all-btn')?.addEventListener('click', () => {
            this.selectAllFiles(true);
        });
        
        document.getElementById('deselect-all-btn')?.addEventListener('click', () => {
            this.selectAllFiles(false);
        });
    }
    
    selectAllFiles(select) {
        const checkboxes = document.querySelectorAll('.file-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = select;
            const repoName = checkbox.getAttribute('data-repo');
            const filePath = checkbox.getAttribute('data-path');
            this.toggleFileSelection(repoName, filePath, select);
        });
    }
    
    addSelectedFilesToGenerator() {
        // Determine the current repository from selected files
        if (this.selectedFiles.size > 0) {
            // Get the first repository with selected files
            for (const [repoName, files] of this.selectedFiles.entries()) {
                if (files.size > 0) {
                    this.currentRepo = repoName;
                    break;
                }
            }
        }
        
        this.updateGeneratorTab();
        this.switchTab('generator');
        Utils.showToast('Files added to generator', 'success');
    }
    
    updateGeneratorTab() {
        const container = document.getElementById('selected-files-list');
        const generateBtn = document.getElementById('generate-tests-btn');
        
        let totalFiles = 0;
        let html = '';
        
        this.selectedFiles.forEach((files, repoName) => {
            if (files.size > 0) {
                html += `
                    <div class="repo-section mb-3">
                        <h6 class="text-primary mb-2">
                            <i class="fas fa-folder me-1"></i>${repoName}
                        </h6>
                        <div class="file-list">
                `;
                
                files.forEach(filePath => {
                    totalFiles++;
                    html += `
                        <div class="selected-file-item">
                            <i class="${Utils.getFileIcon(filePath)} me-2"></i>
                            <span class="file-path">${filePath}</span>
                            <button class="btn btn-xs btn-outline-danger remove-file-btn" 
                                    data-repo="${repoName}" data-path="${filePath}">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            }
        });
        
        if (totalFiles === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-code"></i>
                    <p>No files selected</p>
                    <small>Select files from the Repository tab</small>
                </div>
            `;
            generateBtn.disabled = true;
        } else {
            container.innerHTML = html;
            generateBtn.disabled = false;
            
            // Add remove file event listeners
            container.querySelectorAll('.remove-file-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const repoName = btn.getAttribute('data-repo');
                    const filePath = btn.getAttribute('data-path');
                    this.selectedFiles.get(repoName).delete(filePath);
                    this.updateGeneratorTab();
                });
            });
        }
    }
    
    async generateTests() {
        const generateBtn = document.getElementById('generate-tests-btn');
        const commitBtn = document.getElementById('commit-tests-btn');
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating...';
        
        try {
            // Prepare files data
            const files = [];
            this.selectedFiles.forEach((filePaths, repoName) => {
                filePaths.forEach(filePath => {
                    files.push({ repo: repoName, path: filePath });
                });
            });
            
            // Get generation options
            const technology = document.getElementById('technology-select').value;
            const edgeCases = Array.from(document.querySelectorAll('.edge-cases-dropdown input:checked'))
                .map(input => input.value);
            
            const response = await ApiClient.post('/api/generate-tests', {
                files,
                technology,
                edge_cases: edgeCases
            });
            
            // Display results in Monaco editor
            const testContent = response.results.map(result => result.test_content).join('\n\n');
            this.setMonacoContent(testContent);
            
            const generatedTestCase = {
                name: `Generated Test Suite - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
                repository: this.currentRepo || 'Unknown Repository',
                technology: technology,
                edge_cases: edgeCases,
                description: `AI-generated test cases for ${this.currentRepo || 'selected files'}`,
                content: testContent,
                test_count: Math.max(1, testContent.split('def test_').length - 1),
                file_path: 'tests/generated_tests.py',
                commit_message: 'Add AI-generated test cases',
                status: 'generated' // Mark as generated but not committed
            };
            
            this.addTestCaseToStorage(generatedTestCase);
            
            // Enable buttons after generation
            commitBtn.disabled = false;
            const copyBtn = document.getElementById('copy-tests-btn');
            const maximizeBtn = document.getElementById('maximize-editor-btn');
            if (copyBtn) copyBtn.disabled = false;
            if (maximizeBtn) maximizeBtn.disabled = false;
            
            // Show enhanced success notification and auto-open modal
            this.showTestGenerationSuccess(testContent);
            
            // Refresh test cases tab if currently active
            if (this.currentTab === 'test-cases') {
                this.loadTestCases();
            }
            
            // Update analytics after test generation
            this.updateAnalyticsOnAction();
            
        } catch (error) {
            Utils.showToast(`Failed to generate tests: ${error.message}`, 'danger');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-magic me-2"></i>Generate Tests';
        }
    }
    
    async commitTests() {
        if (!this.currentRepo) {
            Utils.showToast('No repository selected. Please select files from the Repository tab first.', 'warning');
            return;
        }
        
        const testContent = this.monacoEditor ? this.monacoEditor.getValue() : '';
        
        if (!testContent.trim()) {
            Utils.showToast('No test content to commit', 'warning');
            return;
        }
        
        // Show commit confirmation dialog
        this.showCommitDialog(testContent);
    }
    
    showCommitDialog(testContent) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-md">
                <div class="modal-content" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 15px 40px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); padding: 1rem;">
                        <h5 class="modal-title text-light" style="font-weight: 600; display: flex; align-items: center; font-size: 1.1rem;">
                            <i class="fas fa-git-alt me-2" style="color: #00d4ff;"></i>
                            <span style="background: linear-gradient(45deg, #00d4ff, #1a73e8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Commit & Push</span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" style="filter: invert(1); opacity: 0.8;"></button>
                    </div>
                    <div class="modal-body" style="color: #e2e8f0; padding: 1.5rem;">
                        <div class="mb-3">
                            <div class="d-flex align-items-center mb-2">
                                <i class="fas fa-code-branch me-2" style="color: #00d4ff;"></i>
                                <small class="text-light" style="font-weight: 500;">Repository</small>
                            </div>
                            <div class="p-2 rounded" style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3);">
                                <span class="text-light" style="font-size: 0.9rem;">${this.currentRepo}</span>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="commit-file-path" class="form-label text-light mb-1" style="font-weight: 500; font-size: 0.9rem; display: flex; align-items: center;">
                                <i class="fas fa-file-code me-2" style="color: #00d4ff;"></i>File Path
                            </label>
                            <input type="text" class="form-control" id="commit-file-path" 
                                   value="tests/generated_tests.py" 
                                   placeholder="e.g., tests/test_ai_generated.py"
                                   style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; border-radius: 6px; padding: 8px; font-size: 0.9rem;">
                        </div>
                        
                        <div class="mb-3">
                            <label for="commit-message" class="form-label text-light mb-1" style="font-weight: 500; font-size: 0.9rem; display: flex; align-items: center;">
                                <i class="fas fa-comment me-2" style="color: #00d4ff;"></i>Commit Message
                            </label>
                            <textarea class="form-control" id="commit-message" rows="3" 
                                      placeholder="Enter commit message..."
                                      style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; border-radius: 6px; padding: 8px; font-size: 0.9rem; resize: vertical;">Add AI-generated test cases

✨ Generated comprehensive test suite
🔍 Covers edge cases and boundary conditions</textarea>
                        </div>
                        
                        <div class="p-2 rounded" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center;">
                            <i class="fas fa-shield-alt me-2" style="color: #f59e0b;"></i>
                            <div>
                                <small class="text-light" style="font-weight: 500;">Confirm Action:</small>
                                <div style="color: #cbd5e1; font-size: 0.85rem;">This will commit and push the test file to your repository.</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); padding: 1rem;">
                        <button type="button" class="btn" data-bs-dismiss="modal" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 8px 16px; border-radius: 6px; display: flex; align-items: center; font-size: 0.9rem;">
                            <i class="fas fa-times me-1"></i>Cancel
                        </button>
                        <button type="button" class="btn" id="confirm-commit-btn" style="background: linear-gradient(45deg, #10b981, #059669); border: none; color: white; padding: 8px 20px; border-radius: 6px; font-weight: 500; display: flex; align-items: center; font-size: 0.9rem; box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3);">
                            <i class="fas fa-rocket me-1"></i>Commit & Push
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Add confirm button event listener
        const confirmBtn = document.getElementById('confirm-commit-btn');
        confirmBtn.addEventListener('click', () => {
            const filePath = document.getElementById('commit-file-path').value.trim();
            const commitMessage = document.getElementById('commit-message').value.trim();
            
            if (!filePath) {
                Utils.showToast('Please enter a file path', 'warning');
                return;
            }
            
            if (!commitMessage) {
                Utils.showToast('Please enter a commit message', 'warning');
                return;
            }
            
            bsModal.hide();
            this.performCommit(testContent, filePath, commitMessage);
            // Update analytics after commit
            this.updateAnalyticsOnAction();
        });
        
        // Clean up modal on close
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }
    
    async performCommit(testContent, filePath, commitMessage) {
        const commitBtn = document.getElementById('commit-tests-btn');
        
        commitBtn.disabled = true;
        commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Committing...';
        
        try {
            await ApiClient.post('/api/commit-tests', {
                repo_name: this.currentRepo,
                test_content: testContent,
                file_path: filePath,
                message: commitMessage
            });
            
            // Save test case to storage after successful commit
            const technology = document.getElementById('technology-select').value;
            const edgeCases = Array.from(document.querySelectorAll('.edge-cases-dropdown input:checked'))
                .map(input => input.value);
            
            const testCase = {
                name: `Test Suite - ${new Date().toLocaleDateString()}`,
                repository: this.currentRepo,
                technology: technology,
                edge_cases: edgeCases,
                description: `Generated test cases for ${this.currentRepo}`,
                content: testContent,
                test_count: testContent.split('def test_').length - 1,
                file_path: filePath,
                commit_message: commitMessage
            };
            
            this.addTestCaseToStorage(testCase);
            
            Utils.showToast('Tests committed successfully! ✅', 'success');
            
            // Show success notification with details
            this.showCommitSuccessNotification(this.currentRepo, filePath);
            
        } catch (error) {
            Utils.showToast(`Failed to commit tests: ${error.message}`, 'danger');
        } finally {
            commitBtn.disabled = false;
            commitBtn.innerHTML = '<i class="fas fa-git-alt me-1"></i>Commit & Push';
        }
    }
    
    showCommitSuccessNotification(repo, filePath) {
        const notification = document.createElement('div');
        notification.className = 'custom-notification success-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <i class="fas fa-git-alt"></i>
                </div>
                <div class="notification-text">
                    <h5>Commit Successful! 🚀</h5>
                    <p><strong>${repo}</strong></p>
                    <small>Filed saved as: ${filePath}</small>
                </div>
                <button class="btn-close-notification" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-progress"></div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }
    
    // Monaco Editor
    initMonacoEditor() {
        require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs' } });
        require(['vs/editor/editor.main'], () => {
            this.monacoEditor = monaco.editor.create(document.getElementById('test-editor'), {
                value: '# Generated test cases will appear here...',
                language: 'python',
                theme: 'vs-dark',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true
            });
        });
    }
    
    setMonacoContent(content) {
        if (this.monacoEditor) {
            this.monacoEditor.setValue(content);
        }
    }
    
    // Code Analysis
    async analyzeCode(repoName, filePath, analysisType) {
        // Create enhanced analysis modal with AI-powered insights
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg" style="max-width: 900px;">
                <div class="modal-content" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); padding: 1rem;">
                        <h5 class="modal-title text-light" style="font-weight: 600; display: flex; align-items: center; font-size: 1.1rem;">
                            <i class="${analysisType === 'refactor' ? 'fas fa-wrench' : 'fas fa-shield-alt'} me-2" style="color: #00d4ff;"></i>
                            <span style="background: linear-gradient(45deg, #00d4ff, #1a73e8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                ${analysisType === 'refactor' ? 'AI Code Refactoring' : 'AI Security Analysis'}
                            </span>
                            <span class="badge bg-success ms-2" style="font-size: 0.6em;">
                                <i class="fas fa-robot me-1"></i>Groq AI
                            </span>
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" style="filter: invert(1); opacity: 0.8;"></button>
                    </div>
                    <div class="modal-body" style="color: #e2e8f0; padding: 1rem; max-height: 65vh; overflow-y: auto;">

                        <div id="analysis-content-container">
                            <div class="text-center py-3">
                                <div class="mb-3">
                                    <i class="fas fa-brain fa-2x mb-2" style="color: #00d4ff; animation: pulse 2s infinite;"></i>
                                </div>
                                <h6 class="text-light mb-2">AI Analysis in Progress</h6>
                                <div class="progress mb-2" style="height: 6px; background: rgba(255,255,255,0.1);">
                                    <div class="progress-bar bg-primary" role="progressbar" style="width: 0%; transition: width 0.5s;" id="analysis-progress"></div>
                                </div>
                                <p class="text-light mb-1" style="font-size: 0.9em;">Analyzing code structure and patterns...</p>
                                <small class="text-muted" style="font-size: 0.8em;">This may take 10-30 seconds</small>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" style="border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; border-radius: 8px;">
                            <i class="fas fa-times me-2"></i>Close
                        </button>
                        <button type="button" class="btn btn-primary" id="save-analysis-btn" style="background: linear-gradient(45deg, #00d4ff, #1a73e8); border: none; border-radius: 8px; display: none;">
                            <i class="fas fa-save me-2"></i>Save Analysis
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        try {
            // Show progress animation
            const progressBar = document.getElementById('analysis-progress');
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                progressBar.style.width = progress + '%';
            }, 500);
            
            // Real AI API call
            const response = await this.performRealAnalysis(repoName, filePath, analysisType);
            
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            
            const contentContainer = document.getElementById('analysis-content-container');
            contentContainer.innerHTML = this.renderEnhancedAnalysisResults(response, analysisType);
            
            // Show save button
            document.getElementById('save-analysis-btn').style.display = 'inline-block';
            
        } catch (error) {
            const contentContainer = document.getElementById('analysis-content-container');
            contentContainer.innerHTML = `
                <div class="p-4 rounded" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
                    <div class="d-flex align-items-center mb-3">
                        <i class="fas fa-exclamation-triangle me-3" style="color: #ef4444; font-size: 1.5em;"></i>
                        <div>
                            <strong class="text-light">AI Analysis Failed</strong>
                        </div>
                    </div>
                    <div style="color: #cbd5e1; margin-top: 8px;">
                        <p class="mb-2"><strong>Error:</strong> ${error.message}</p>
                        <small class="text-muted">Please check your internet connection and try again. If the problem persists, the file might be too large or contain unsupported content.</small>
                    </div>
                </div>
            `;
        }
        
        // Clean up modal on close
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
            style.remove();
        });
    }
    
    // Real AI-powered analysis using Groq API
    async performRealAnalysis(repoName, filePath, analysisType) {
        try {
            // First, get the file content from GitHub
            const fileContentResponse = await fetch(`/api/repository/${encodeURIComponent(repoName)}/file?path=${encodeURIComponent(filePath)}`);
            
            if (!fileContentResponse.ok) {
                throw new Error('Failed to fetch file content from repository');
            }
            
            const fileData = await fileContentResponse.json();
            const fileContent = fileData.content;
            
            if (!fileContent) {
                throw new Error('File content is empty or could not be retrieved');
            }
            
            // Now call the AI analysis API
            const analysisResponse = await fetch('/api/code-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repo_name: repoName,
                    file_path: filePath,
                    analysis_type: analysisType
                })
            });
            
            if (!analysisResponse.ok) {
                const errorData = await analysisResponse.json();
                throw new Error(errorData.error || 'AI analysis failed');
            }
            
            const result = await analysisResponse.json();
            
            // Add file metadata to the result
            result.fileInfo = {
                name: filePath.split('/').pop(),
                path: filePath,
                size: fileContent.length,
                type: filePath.split('.').pop().toLowerCase(),
                repo: repoName
            };
            
            return result;
            
        } catch (error) {
            console.error('AI Analysis Error:', error);
            throw new Error(`AI Analysis failed: ${error.message}`);
        }
    }
    


    

    
    // Render analysis results with visual indicators
    renderAnalysisResults(response, analysisType) {
        if (analysisType === 'vulnerability') {
            const severityColor = {
                'Low': '#10b981',
                'Medium': '#f59e0b', 
                'High': '#ef4444',
                'Critical': '#7c2d12'
            };
            
            const severityBg = {
                'Low': 'rgba(16, 185, 129, 0.1)',
                'Medium': 'rgba(245, 158, 11, 0.1)',
                'High': 'rgba(239, 68, 68, 0.1)',
                'Critical': 'rgba(124, 45, 18, 0.1)'
            };
            
            return `
                <div class="mb-3">
                    <div class="row g-2 mb-3">
                        <div class="col-md-4">
                            <div class="p-2 rounded text-center" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                                <div class="h3 mb-1" style="color: ${severityColor[response.severity]};">${response.score}/10</div>
                                <small class="text-light">Security Score</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-2 rounded text-center" style="background: ${severityBg[response.severity]}; border: 1px solid ${severityColor[response.severity]};">
                                <div class="h4 mb-1" style="color: ${severityColor[response.severity]};">${response.severity}</div>
                                <small class="text-light">Severity</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-2 rounded text-center" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                                <div class="h4 mb-1 text-light">${response.issues.length}</div>
                                <small class="text-light">Issues</small>
                            </div>
                        </div>
                    </div>
                    
                    <h6 class="text-light mb-2" style="font-size: 0.95em;">🔍 Security Issues:</h6>
                    ${response.issues.map(issue => `
                        <div class="mb-2 p-2 rounded" style="background: ${severityBg[issue.severity]}; border: 1px solid ${severityColor[issue.severity]};">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <strong class="text-light" style="font-size: 0.9em;">${issue.type}</strong>
                                <div class="d-flex align-items-center gap-1">
                                    <span class="badge" style="background: ${severityColor[issue.severity]}; font-size: 0.7em;">${issue.severity}</span>
                                    <small class="text-muted" style="font-size: 0.75em;">Line ${issue.line}</small>
                                </div>
                            </div>
                            <p class="mb-1" style="color: #cbd5e1; font-size: 0.85em;">${issue.description}</p>
                            <div class="p-2 rounded" style="background: rgba(0,0,0,0.3); border-left: 2px solid #00d4ff;">
                                <strong class="text-light" style="font-size: 0.8em;">💡 Fix:</strong>
                                <div style="color: #cbd5e1; margin-top: 2px; font-size: 0.8em;">${issue.recommendation}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            const priorityColor = {
                'Low': '#10b981',
                'Medium': '#f59e0b',
                'High': '#ef4444'
            };
            
            const priorityBg = {
                'Low': 'rgba(16, 185, 129, 0.1)',
                'Medium': 'rgba(245, 158, 11, 0.1)',
                'High': 'rgba(239, 68, 68, 0.1)'
            };
            
            return `
                <div class="mb-3">
                    <h6 class="text-light mb-3" style="font-size: 0.95em;">🔧 Code Refactoring Suggestions:</h6>
                    ${response.refactorings.map(refactor => `
                        <div class="mb-3 p-3 rounded" style="background: ${priorityBg[refactor.priority]}; border: 1px solid ${priorityColor[refactor.priority]};">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <strong class="text-light" style="font-size: 0.95em;">${refactor.title}</strong>
                                <div class="d-flex align-items-center gap-1">
                                    <span class="badge" style="background: ${priorityColor[refactor.priority]}; font-size: 0.7em;">${refactor.priority}</span>
                                    <small class="text-muted" style="font-size: 0.75em;">Line ${refactor.line}</small>
                                </div>
                            </div>
                            <p class="mb-2" style="color: #cbd5e1; font-size: 0.85em;">${refactor.description}</p>
                            
                            <div class="row g-2 mb-2">
                                <div class="col-md-6">
                                    <div class="p-2 rounded" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);">
                                        <strong class="text-light" style="font-size: 0.8em; color: #ef4444;">❌ Before:</strong>
                                        <pre style="background: #0d1117; color: #c9d1d9; font-size: 0.7em; padding: 8px; border-radius: 4px; margin: 4px 0 0 0; overflow-x: auto;"><code>${this.escapeHtml(refactor.before)}</code></pre>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="p-2 rounded" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);">
                                        <strong class="text-light" style="font-size: 0.8em; color: #10b981;">✅ After:</strong>
                                        <pre style="background: #0d1117; color: #c9d1d9; font-size: 0.7em; padding: 8px; border-radius: 4px; margin: 4px 0 0 0; overflow-x: auto;"><code>${this.escapeHtml(refactor.after)}</code></pre>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="p-2 rounded" style="background: rgba(0,0,0,0.3); border-left: 2px solid #00d4ff;">
                                <strong class="text-light" style="font-size: 0.8em;">🚀 Improvements:</strong>
                                <div class="mt-1">
                                    ${refactor.improvements.map(improvement => `<small style="color: #cbd5e1; font-size: 0.75em; margin-right: 8px;">${improvement}</small>`).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    // Enhanced AI-powered analysis results rendering
    renderEnhancedAnalysisResults(response, analysisType) {
        if (analysisType === 'vulnerability') {
            return this.renderEnhancedVulnerabilityResults(response);
        } else {
            return this.renderEnhancedRefactorResults(response);
        }
    }
    
    // Enhanced vulnerability analysis results with color highlighting
    renderEnhancedVulnerabilityResults(response) {
        const fileInfo = response.fileInfo || {};
        const aiContent = response.result || '';
        
        return `
            <div class="mb-3">

                
                <!-- AI Analysis Content with Color Highlighting -->
                <div class="p-3 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1);">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-brain me-2" style="color: #10b981;"></i>
                        <h6 class="text-light mb-0" style="font-size: 0.95rem;">Security Assessment</h6>
                    </div>
                    
                    <div class="mb-3">
                        <div class="p-3 rounded" style="background: rgba(0,0,0,0.3); border-left: 4px solid #00d4ff; max-height: 400px; overflow-y: auto;">
                            <div class="ai-content" style="color: #e2e8f0; line-height: 1.5; font-size: 0.9em;">
                                ${this.formatVulnerabilityResponse(aiContent)}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="this.copyToClipboard('${this.escapeHtml(aiContent)}')">
                            <i class="fas fa-copy me-1"></i>Copy Analysis
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="this.saveAnalysis('${this.escapeHtml(aiContent)}', 'vulnerability')">
                            <i class="fas fa-save me-1"></i>Save Report
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Enhanced refactor analysis results
    renderEnhancedRefactorResults(response) {
        const fileInfo = response.fileInfo || {};
        const aiContent = response.result || '';
        
        return `
            <div class="mb-3">

                
                <!-- AI Analysis Content -->
                <div class="p-3 rounded" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1);">
                    <div class="d-flex align-items-center mb-2">
                        <i class="fas fa-brain me-2" style="color: #10b981;"></i>
                        <h6 class="text-light mb-0" style="font-size: 0.95rem;">Refactoring Suggestions</h6>
                    </div>
                    
                    <div class="mb-3">
                        <div class="p-3 rounded" style="background: rgba(0,0,0,0.3); border-left: 4px solid #00d4ff; max-height: 400px; overflow-y: auto;">
                            <div class="ai-content" style="color: #e2e8f0; line-height: 1.5; font-size: 0.9em;">
                                ${this.formatAIResponse(aiContent)}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm" onclick="this.copyToClipboard('${this.escapeHtml(aiContent)}')">
                            <i class="fas fa-copy me-1"></i>Copy Suggestions
                        </button>
                        <button class="btn btn-outline-success btn-sm" onclick="this.saveAnalysis('${this.escapeHtml(aiContent)}', 'refactor')">
                            <i class="fas fa-save me-1"></i>Save Report
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Format AI response for better display
    formatAIResponse(content) {
        if (!content) return '<em class="text-muted">No analysis content available</em>';
        
        // Convert markdown-like formatting to HTML
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #00d4ff;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background: #0d1117; color: #c9d1d9; padding: 12px; border-radius: 6px; margin: 8px 0; overflow-x: auto; border: 1px solid rgba(255,255,255,0.1);"><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code style="background: rgba(0, 212, 255, 0.1); color: #00d4ff; padding: 2px 4px; border-radius: 3px; font-size: 0.9em;">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        return `<p>${formatted}</p>`;
    }
    
    // Format vulnerability response with color highlighting
    formatVulnerabilityResponse(content) {
        if (!content) return '<em class="text-muted">No security analysis available</em>';
        
        // Color highlighting for severity levels
        let formatted = content
            // Critical vulnerabilities - Red with glow
            .replace(/\b(Critical|CRITICAL)\b/g, '<span style="color: #ef4444; font-weight: bold; text-shadow: 0 0 8px rgba(239, 68, 68, 0.6); background: rgba(239, 68, 68, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">$1</span>')
            // High vulnerabilities - Orange with glow
            .replace(/\b(High|HIGH)\b/g, '<span style="color: #f97316; font-weight: bold; text-shadow: 0 0 6px rgba(249, 115, 22, 0.5); background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(249, 115, 22, 0.3);">$1</span>')
            // Medium vulnerabilities - Yellow with glow
            .replace(/\b(Medium|MEDIUM)\b/g, '<span style="color: #eab308; font-weight: bold; text-shadow: 0 0 6px rgba(234, 179, 8, 0.5); background: rgba(234, 179, 8, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(234, 179, 8, 0.3);">$1</span>')
            // Low vulnerabilities - Green with glow
            .replace(/\b(Low|LOW)\b/g, '<span style="color: #10b981; font-weight: bold; text-shadow: 0 0 6px rgba(16, 185, 129, 0.5); background: rgba(16, 185, 129, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">$1</span>')
            // Vulnerability types - Highlighted
            .replace(/\b(SQL Injection|XSS|Cross-Site Scripting|Code Injection|Path Traversal|RCE|Remote Code Execution|Authentication|Authorization|Input Validation|Output Encoding|Cryptographic|Session Management)\b/gi, '<span style="color: #00d4ff; font-weight: bold; background: rgba(0, 212, 255, 0.1); padding: 1px 4px; border-radius: 3px;">$1</span>')
            // Markdown formatting
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #00d4ff;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>')
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre style="background: #0d1117; color: #c9d1d9; padding: 8px; border-radius: 4px; margin: 6px 0; overflow-x: auto; border: 1px solid rgba(255,255,255,0.1); font-size: 0.85em;"><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code style="background: rgba(0, 212, 255, 0.1); color: #00d4ff; padding: 1px 3px; border-radius: 2px; font-size: 0.85em;">$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        return `<p>${formatted}</p>`;
    }
    
    // Helper methods for buttons
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccessNotification('Analysis copied to clipboard!');
        }).catch(() => {
            this.showErrorNotification('Failed to copy to clipboard');
        });
    }
    
    saveAnalysis(content, type) {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_');
        const filename = `ai_analysis_${type}_${timestamp}.txt`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showSuccessNotification('Analysis saved successfully!');
    }
    
    // Analytics Tab
    initAnalyticsTab() {
        document.getElementById('generate-report-btn')?.addEventListener('click', () => {
            this.generateReport();
        });
    }
    
    async loadAnalytics() {
        try {
            const analytics = await ApiClient.get('/api/analytics');
            this.renderAnalytics(analytics);
            
            // Only set up real-time updates if Analytics tab is active
            if (this.currentTab === 'analytics') {
                if (this.analyticsInterval) {
                    clearInterval(this.analyticsInterval);
                }
                
                this.analyticsInterval = setInterval(async () => {
                    try {
                        const updatedAnalytics = await ApiClient.get('/api/analytics');
                        this.renderAnalytics(updatedAnalytics);
                    } catch (error) {
                        console.error('Failed to update analytics:', error);
                    }
                }, 30000); // Update every 30 seconds
            }
            
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }
    
    // Update analytics when user performs actions
    updateAnalyticsOnAction() {
        // Trigger analytics update after user actions
        setTimeout(async () => {
            try {
                const analytics = await ApiClient.get('/api/analytics');
                this.renderAnalytics(analytics);
            } catch (error) {
                console.error('Failed to update analytics:', error);
            }
        }, 2000); // Update after 2 seconds
    }
    
    renderAnalytics(analytics) {
        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        
        // Update basic stat cards (guarded)
        setText('total-files-stat', analytics.total_files_generated || 0);
        setText('total-repos-stat', analytics.total_repos || 0);
        setText('quality-score-stat', analytics.average_quality_score ?? '0.0');
        // Removed top-notch field per request
        setText('total-testcases-stat', analytics.total_test_cases || analytics.total_files_generated || 0);
        
        // Update new stat cards (removed commits per request)
        this.updateStatCard('total-analyses-stat', analytics.total_analyses || 0);
        this.updateStatCard('productivity-score-stat', analytics.productivity_score || 0);
        
        // Update security metrics
        this.updateSecurityMetrics(analytics);
        
        // Update technology breakdown
        this.updateTechnologyBreakdown(analytics.technology_breakdown || {});
        
        // Update activity chart
        this.updateActivityChart(analytics.daily_activity || {});
        
        // Update quality chart
        this.updateQualityChart(analytics);
        
        // Update performance indicators (remove security health badge usage)
        this.updatePerformanceIndicatorsCompact(analytics);
    }
    
    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    updateSecurityMetrics(analytics) {
        const criticalEl = document.getElementById('critical-vulns-stat');
        const highEl = document.getElementById('high-vulns-stat');
        const mediumEl = document.getElementById('medium-vulns-stat');
        const lowEl = document.getElementById('low-vulns-stat');
        
        if (criticalEl) criticalEl.textContent = analytics.critical_vulnerabilities_found || 0;
        if (highEl) highEl.textContent = analytics.high_vulnerabilities_found || 0;
        if (mediumEl) mediumEl.textContent = analytics.medium_vulnerabilities_found || 0;
        if (lowEl) lowEl.textContent = analytics.low_vulnerabilities_found || 0;
    }
    
    updateTechnologyBreakdown(techBreakdown) {
        const tagsContainer = document.getElementById('tech-tags-container');
        if (!tagsContainer) return;
        
        if (Object.keys(techBreakdown).length === 0) {
            tagsContainer.innerHTML = '';
            return;
        }
        
        const sortedTechs = Object.entries(techBreakdown).sort((a, b) => b[1] - a[1]);
        const html = sortedTechs.map(([tech, count]) => `
            <span class="tag">
                <span>${tech}</span>
                <span class="badge rounded-pill">${count}</span>
            </span>
        `).join('');
        
        tagsContainer.innerHTML = html;
    }
    
    updateActivityChart(dailyActivity) {
        const ctx = document.getElementById('activity-chart');
        if (!ctx) return;
        
        if (this.activityChart) {
            this.activityChart.destroy();
        }
        
        const dates = Object.keys(dailyActivity).reverse();
        const testCasesData = dates.map(date => dailyActivity[date].test_cases);
        const analysesData = dates.map(date => dailyActivity[date].analyses);
        
        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
                datasets: [{
                    label: 'Test Cases',
                    data: testCasesData,
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }, {
                    label: 'Code Analyses',
                    data: analysesData,
                    borderColor: '#1a73e8',
                    backgroundColor: 'rgba(26, 115, 232, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    },
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                }
            }
        });
    }
    
    updatePerformanceIndicators(analytics) {
        // Update quality trend indicator
        const qualityTrendEl = document.getElementById('quality-trend-indicator');
        if (qualityTrendEl) {
            const trend = analytics.quality_trend || 'stable';
            const trendClass = {
                'improving': 'text-success',
                'stable': 'text-warning',
                'needs_improvement': 'text-danger'
            }[trend] || 'text-muted';
            
            qualityTrendEl.className = `badge ${trendClass}`;
            qualityTrendEl.textContent = trend.replace('_', ' ').toUpperCase();
        }
        
        // Security health indicator removed from UI; no-op if element absent
        const securityHealthEl = document.getElementById('security-health-indicator');
        if (securityHealthEl) {
            securityHealthEl.textContent = '';
        }
    }
    
    updateQualityChart(analytics) {
        const ctx = document.getElementById('quality-chart');
        if (!ctx) return;
        
        if (this.qualityChart) {
            this.qualityChart.destroy();
        }
        
        // Sample data for demonstration - in real app this would come from API
        const chartData = {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Average Quality Score',
                data: [6.5, 7.2, 8.1, analytics.average_quality_score || 7.5],
                borderColor: '#1a73e8', /* Consistent color */
                backgroundColor: 'rgba(26, 115, 232, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };
        
        this.qualityChart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 10,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cbd5e1'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#cbd5e1'
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#f8fafc'
                        }
                    }
                }
            }
        });
    }
    
    async generateReport() {
        const includeCharts = document.getElementById('include-charts').checked;
        const includeDetails = document.getElementById('include-details').checked;
        
        // Show loading state
        const reportBtn = document.getElementById('generate-report-btn');
        const originalText = reportBtn.innerHTML;
        reportBtn.disabled = true;
        reportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating AI Report...';
        
        try {
            // Get current analytics data
            const analytics = await ApiClient.get('/api/analytics');
            
            // Generate AI-powered report content
            const aiReportContent = await this.generateAIReportContent(analytics);
            
            // Generate HTML report
            const reportContent = this.createEnhancedReportHTML(analytics, aiReportContent, includeCharts, includeDetails);
            
            // Download as file
            const blob = new Blob([reportContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gitgenius-analytics-report-${new Date().toISOString().split('T')[0]}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Utils.showToast('AI-powered report generated and downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error generating report:', error);
            Utils.showToast('Failed to generate report. Please try again.', 'error');
        } finally {
            // Restore button state
            reportBtn.disabled = false;
            reportBtn.innerHTML = originalText;
        }
    }
    
    async generateAIReportContent(analytics) {
        try {
            const response = await fetch('/api/generate-ai-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ analytics })
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate AI report');
            }
            
            const data = await response.json();
            return data.report_content;
        } catch (error) {
            console.error('Error generating AI report:', error);
            return this.generateFallbackReportContent(analytics);
        }
    }
    
    generateFallbackReportContent(analytics) {
        return `
            <h2>📊 Analytics Summary</h2>
            <p>This report provides insights into your development workflow and code quality metrics.</p>
            
            <h3>🎯 Key Performance Indicators</h3>
            <ul>
                <li><strong>Productivity Score:</strong> ${analytics.productivity_score || 0}</li>
                <li><strong>Quality Trend:</strong> ${analytics.quality_trend || 'stable'}</li>
                <li><strong>Security Health:</strong> ${analytics.security_health || 'good'}</li>
            </ul>
            
            <h3>📈 Activity Overview</h3>
            <ul>
                <li><strong>Total Files Generated:</strong> ${analytics.total_files_generated || 0}</li>
                <li><strong>Total Repositories:</strong> ${analytics.total_repos || 0}</li>
                <li><strong>Total Test Cases:</strong> ${analytics.total_test_cases || analytics.total_files_generated || 0}</li>
                <li><strong>Total Analyses:</strong> ${analytics.total_analyses || 0}</li>
            </ul>
        `;
    }
    
    createEnhancedReportHTML(analytics, aiReportContent, includeCharts, includeDetails) {
        const currentDate = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitGenius Analytics Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #e2e8f0; 
            line-height: 1.6;
            min-height: 100vh;
        }
        
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 40px 20px; 
        }
        
        .header { 
            text-align: center; 
            margin-bottom: 50px; 
            padding: 40px 0;
            background: rgba(255,255,255,0.05);
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .header h1 { 
            font-size: 3em; 
            font-weight: 700; 
            background: linear-gradient(45deg, #00d4ff, #1a73e8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            color: #94a3b8;
            margin-bottom: 20px;
        }
        
        .generated-date { 
            color: #64748b; 
            font-size: 0.9em; 
            background: rgba(255,255,255,0.05);
            padding: 10px 20px;
            border-radius: 10px;
            display: inline-block;
        }
        
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 25px; 
            margin-bottom: 50px; 
        }
        
        .stat-card { 
            padding: 30px; 
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 15px; 
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        
        .stat-value { 
            font-size: 2.5em; 
            font-weight: 700; 
            background: linear-gradient(45deg, #00d4ff, #1a73e8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .stat-label { 
            color: #94a3b8; 
            font-size: 1.1em;
            font-weight: 500;
        }
        
        .section { 
            margin-bottom: 50px; 
            background: rgba(255,255,255,0.03);
            padding: 30px;
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        
        .section h2 { 
            font-size: 2em; 
            margin-bottom: 25px;
            background: linear-gradient(45deg, #00d4ff, #1a73e8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: flex;
            align-items: center;
        }
        
        .section h2::before {
            content: '';
            width: 4px;
            height: 30px;
            background: linear-gradient(45deg, #00d4ff, #1a73e8);
            margin-right: 15px;
            border-radius: 2px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 25px 0;
        }
        
        .metric-item {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        
        .metric-label {
            color: #94a3b8;
            font-size: 0.9em;
            margin-bottom: 5px;
        }
        
        .metric-value {
            font-size: 1.5em;
            font-weight: 600;
            color: #e2e8f0;
        }
        
        .ai-content {
            background: rgba(0, 212, 255, 0.05);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
        }
        
        .ai-content h3 {
            color: #00d4ff;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        
        .ai-content p, .ai-content ul {
            color: #cbd5e1;
            line-height: 1.8;
        }
        
        .ai-content ul {
            margin-left: 20px;
        }
        
        .ai-content li {
            margin-bottom: 10px;
        }
        
        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 30px;
            background: rgba(255,255,255,0.02);
            border-radius: 15px;
            border: 1px solid rgba(255,255,255,0.05);
        }
        
        .footer p {
            color: #64748b;
            font-style: italic;
        }
        
        .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .badge.success { background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); }
        .badge.warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge.danger { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        
        @media print {
            body { background: white; color: black; }
            .header, .section { background: white; border: 1px solid #ddd; }
            .stat-value, .section h2 { color: #1a73e8; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 GitGenius Analytics Report</h1>
            <div class="subtitle">AI-Powered Development Analytics & Insights</div>
            <div class="generated-date">Generated on ${currentDate}</div>
        </div>
        
        <div class="section">
            <h2>📊 Key Performance Metrics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${analytics.total_files_generated || 0}</div>
                    <div class="stat-label">Files Generated</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.total_repos || 0}</div>
                    <div class="stat-label">Repositories</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.total_test_cases || analytics.total_files_generated || 0}</div>
                    <div class="stat-label">Test Cases</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.total_analyses || 0}</div>
                    <div class="stat-label">Code Analyses</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Quality & Performance Indicators</h2>
            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="metric-label">Average Quality Score</div>
                    <div class="metric-value">${analytics.average_quality_score || 0}/10</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Top-Notch Code</div>
                    <div class="metric-value">${analytics.top_notch_percentage || 0}%</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Productivity Score</div>
                    <div class="metric-value">${analytics.productivity_score || 0}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Quality Trend</div>
                    <div class="metric-value">
                        <span class="badge ${analytics.quality_trend === 'improving' ? 'success' : analytics.quality_trend === 'stable' ? 'warning' : 'danger'}">
                            ${analytics.quality_trend || 'stable'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        ${includeDetails ? `
        <div class="section">
            <h2>🔒 Security Analysis</h2>
            <div class="metrics-grid">
                <div class="metric-item">
                    <div class="metric-label">Critical Vulnerabilities</div>
                    <div class="metric-value">${analytics.critical_vulnerabilities_found || 0}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">High Vulnerabilities</div>
                    <div class="metric-value">${analytics.high_vulnerabilities_found || 0}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Medium Vulnerabilities</div>
                    <div class="metric-value">${analytics.medium_vulnerabilities_found || 0}</div>
                </div>
                <div class="metric-item">
                    <div class="metric-label">Low Vulnerabilities</div>
                    <div class="metric-value">${analytics.low_vulnerabilities_found || 0}</div>
                </div>
            </div>
            <div style="margin-top: 20px;">
                <strong>Security Overview:</strong> Vulnerabilities summarized above
            </div>
        </div>
        ` : ''}
        
        <div class="ai-content">
            <h3>🤖 AI-Generated Insights</h3>
            ${aiReportContent}
        </div>
        
        <div class="footer">
            <p>Generated by GitGenius - Advanced AI-Powered Development Analytics Platform</p>
            <p>Powered by Groq AI for intelligent insights and recommendations</p>
        </div>
    </div>
</body>
</html>
        `;
    }
    
    // Test Cases Tab
    async loadTestCases() {
        if (this.currentTab !== 'test-cases') return;
        
        const container = document.getElementById('test-cases-list');
        Utils.showLoading(container);
        
        // Get test cases from localStorage
        const testCases = this.getTestCasesFromStorage();
        this.renderTestCases(testCases);
    }
    
    getTestCasesFromStorage() {
        try {
            const stored = localStorage.getItem('gitgenius_test_cases');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading test cases from storage:', error);
            return [];
        }
    }
    
    saveTestCasesToStorage(testCases) {
        try {
            localStorage.setItem('gitgenius_test_cases', JSON.stringify(testCases));
        } catch (error) {
            console.error('Error saving test cases to storage:', error);
        }
    }
    
    addTestCaseToStorage(testCase) {
        const testCases = this.getTestCasesFromStorage();
        testCase.id = Date.now().toString(); // Simple ID generation
        testCase.created_at = new Date().toISOString();
        testCases.unshift(testCase); // Add to beginning
        this.saveTestCasesToStorage(testCases);
        return testCase;
    }
    
    addSampleTestCase() {
        const sampleTestCase = {
            name: 'Sample Test Suite - Demo',
            repository: 'demo/sample-repo',
            technology: 'python',
            edge_cases: ['null-values', 'boundary-values'],
            description: 'This is a sample test case for demonstration purposes.',
            content: `import pytest
import unittest
from unittest.mock import Mock, patch

class TestSampleCode(unittest.TestCase):
    
    def test_basic_functionality(self):
        """Test basic functionality"""
        # Arrange
        expected = "Hello, World!"
        
        # Act
        result = get_greeting()
        
        # Assert
        self.assertEqual(result, expected)
    
    def test_null_values(self):
        """Test handling of null values"""
        # Test null input
        result = process_input(None)
        self.assertIsNone(result)
    
    def test_boundary_values(self):
        """Test boundary values"""
        # Test empty string
        result = validate_string("")
        self.assertFalse(result)
        
        # Test very long string
        long_string = "a" * 1000
        result = validate_string(long_string)
        self.assertTrue(result)

def get_greeting():
    return "Hello, World!"

def process_input(value):
    if value is None:
        return None
    return str(value)

def validate_string(s):
    return len(s) > 0

if __name__ == '__main__':
    unittest.main()`,
            test_count: 3,
            file_path: 'tests/sample_tests.py',
            commit_message: 'Add sample test cases for demonstration'
        };
        
        this.addTestCaseToStorage(sampleTestCase);
        console.log('Sample test case added for demonstration');
    }
    
    renderTestCases(testCases) {
        const container = document.getElementById('test-cases-list');
        
        if (!testCases || testCases.length === 0) {
            container.innerHTML = `
                <div class="empty-state text-center p-5">
                    <i class="fas fa-flask fa-3x mb-3 text-muted"></i>
                    <h4>No test cases yet</h4>
                    <p class="text-muted">Generate some test cases to see them here.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = testCases.map(testCase => `
            <div class="test-case-card glass-card">
                <div class="test-case-header">
                    <div>
                        <h4 class="test-case-title">${testCase.name}</h4>
                        <p class="test-case-meta">${testCase.repository} • ${Utils.formatDate(testCase.created_at)}</p>
                    </div>
                    <div class="test-case-stats">
                        <div class="test-case-stat">
                            <strong>${testCase.test_count}</strong><br>
                            <small>Tests</small>
                        </div>
                    </div>
                </div>
                <div class="test-case-content">
                    <p>${testCase.description || 'No description available.'}</p>
                    <div class="badge bg-primary">${testCase.technology}</div>
                    ${testCase.edge_cases ? testCase.edge_cases.map(ec => `<span class="badge bg-secondary ms-1">${ec}</span>`).join('') : ''}
                </div>
                <div class="test-case-actions">
                    <button class="btn btn-sm btn-outline-primary view-test-btn" data-id="${testCase.id}">
                        <i class="fas fa-eye me-1"></i>View
                    </button>
                    <button class="btn btn-sm btn-outline-success copy-test-btn" data-id="${testCase.id}">
                        <i class="fas fa-copy me-1"></i>Copy
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-test-btn" data-id="${testCase.id}">
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        container.querySelectorAll('.view-test-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const testId = btn.getAttribute('data-id');
                this.viewTestCase(testId);
            });
        });
        
        container.querySelectorAll('.copy-test-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const testId = btn.getAttribute('data-id');
                this.copyTestCase(testId);
            });
        });
        
        container.querySelectorAll('.delete-test-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const testId = btn.getAttribute('data-id');
                this.deleteTestCase(testId);
            });
        });
    }
    
    // Pull Requests Tab
    initPullRequestsTab() {
        // Initialize pull requests monitoring
    }
    
    async loadPullRequests() {
        if (this.currentTab !== 'pull-requests') return;
        
        const container = document.getElementById('pull-requests-list');
        Utils.showLoading(container);
        
        try {
            const pullRequests = await ApiClient.get('/api/pull-requests');
            this.renderPullRequests(pullRequests);
        } catch (error) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load pull requests: ${error.message}
                </div>
            `;
        }
    }
    
    renderPullRequests(pullRequests) {
        const container = document.getElementById('pull-requests-list');
        
        if (!pullRequests || pullRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state text-center p-5">
                    <i class="fas fa-code-branch fa-3x mb-3 text-muted"></i>
                    <h4>No pull requests found</h4>
                    <p class="text-muted">No active pull requests in your repositories.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pullRequests.map(repo => `
            <div class="glass-card mb-4">
                <div class="card-header">
                    <h5>
                        <i class="fas fa-folder me-2"></i>
                        ${repo.repo_name}
                    </h5>
                </div>
                <div class="card-body">
                    ${repo.pull_requests.length === 0 ? `
                        <p class="text-muted">No pull requests</p>
                    ` : `
                        <div class="pr-list">
                            ${repo.pull_requests.map(pr => `
                                <div class="pr-item d-flex justify-content-between align-items-center p-3 mb-2 bg-dark rounded">
                                    <div>
                                        <h6 class="mb-1">
                                            <a href="${pr.html_url}" target="_blank" class="text-primary text-decoration-none">
                                                ${pr.title}
                                            </a>
                                        </h6>
                                        <small class="text-muted">
                                            #${pr.number} by ${pr.user.login} • ${Utils.formatDate(pr.created_at)}
                                        </small>
                                    </div>
                                    <span class="badge bg-${pr.state === 'open' ? 'success' : 'secondary'}">${pr.state}</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `).join('');
    }
    
    // Copy test content functionality
    async copyTestContent(isMaximized = false) {
        try {
            const testContent = this.monacoEditor ? this.monacoEditor.getValue() : '';
            
            if (!testContent.trim() || testContent === '# Generated test cases will appear here...') {
                Utils.showToast('No test content to copy', 'warning');
                return;
            }
            
            await navigator.clipboard.writeText(testContent);
            
            const buttonId = isMaximized ? 'copy-tests-maximized-btn' : 'copy-tests-btn';
            const button = document.getElementById(buttonId);
            
            // Temporarily change button text to show success
            const originalHtml = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
            button.classList.add('btn-success');
            
            setTimeout(() => {
                button.innerHTML = originalHtml;
                button.classList.remove('btn-success');
            }, 2000);
            
            Utils.showToast('Test code copied to clipboard!', 'success');
            
        } catch (error) {
            Utils.showToast('Failed to copy to clipboard', 'danger');
        }
    }
    
    // Maximize editor functionality
    maximizeEditor() {
        const testContent = this.monacoEditor ? this.monacoEditor.getValue() : '';
        
        if (!testContent.trim() || testContent === '# Generated test cases will appear here...') {
            Utils.showToast('No test content to maximize', 'warning');
            return;
        }
        
        // Show the maximized modal
        const modal = new bootstrap.Modal(document.getElementById('maximizeEditorModal'));
        modal.show();
        
        // Initialize maximized Monaco editor
        setTimeout(() => {
            this.initMaximizedEditor(testContent);
        }, 300); // Small delay to ensure modal is fully shown
    }
    
    // Initialize maximized Monaco editor
    initMaximizedEditor(content) {
        if (this.maximizedEditor) {
            this.maximizedEditor.dispose();
        }
        
        require(['vs/editor/editor.main'], () => {
            this.maximizedEditor = monaco.editor.create(document.getElementById('test-editor-maximized'), {
                value: content,
                language: 'python',
                theme: 'vs-dark',
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                fontSize: 14,
                lineNumbers: 'on',
                folding: true,
                renderWhitespace: 'selection'
            });
        });
    }
    
    // Success notification with auto modal show
    showTestGenerationSuccess(testContent) {
        // First show the success notification
        this.showSuccessNotification();
        
        // Then automatically open the maximized modal after a short delay
        setTimeout(() => {
            this.maximizeEditor();
        }, 1500);
    }
    
    // Enhanced success notification
    showSuccessNotification() {
        // Create and show a custom success notification
        const notification = document.createElement('div');
        notification.className = 'custom-notification success-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="notification-text">
                    <h5>Tests Generated Successfully! 🎉</h5>
                    <p>Your AI-powered test cases are ready. Opening in fullscreen view...</p>
                </div>
                <button class="btn-close-notification" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="notification-progress"></div>
        `;
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // Test case action methods
    viewTestCase(testId) {
        try {
            const testCases = this.getTestCasesFromStorage();
            const testCase = testCases.find(tc => tc.id === testId);
            
            if (!testCase) {
                Utils.showToast('Test case not found!', 'warning');
                return;
            }
            
            // Create a modal to show the test case - compact, dark themed
            const modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content" style="background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 15px;">
                        <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);">
                            <h5 class="modal-title text-light" style="display: flex; align-items: center;">
                                <i class="fas fa-code me-2" style="color: #00d4ff;"></i>
                                ${testCase.name}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" style="filter: invert(1); opacity: 0.8;"></button>
                        </div>
                        <div class="modal-body" style="padding: 0;">
                            <div id="view-test-editor-${testId}" style="height: 70vh; min-height: 500px;"></div>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);">
                            <button type="button" class="btn copy-content-btn" style="background: linear-gradient(45deg, #10b981, #059669); border: none; color: white; border-radius: 8px;">
                                <i class="fas fa-copy me-1"></i>Copy Code
                            </button>
                            <button type="button" class="btn" data-bs-dismiss="modal" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; border-radius: 8px;">
                                <i class="fas fa-times me-1"></i>Close
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
            
            // Add copy button functionality
            const copyBtn = modal.querySelector('.copy-content-btn');
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(testCase.content || '');
                    copyBtn.innerHTML = '<i class="fas fa-check me-1"></i>Copied!';
                    copyBtn.classList.add('btn-success');
                    copyBtn.classList.remove('btn-outline-success');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy me-1"></i>Copy Content';
                        copyBtn.classList.remove('btn-success');
                        copyBtn.classList.add('btn-outline-success');
                    }, 2000);
                    
                    Utils.showToast('Test content copied to clipboard!', 'success');
                } catch (error) {
                    Utils.showToast('Failed to copy to clipboard', 'danger');
                }
            });
            
            // Initialize Monaco editor for viewing
            setTimeout(() => {
                require(['vs/editor/editor.main'], () => {
                    monaco.editor.create(document.getElementById(`view-test-editor-${testId}`), {
                        value: testCase.content || '# No content available',
                        language: 'python',
                        theme: 'vs-dark',
                        readOnly: true,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        fontSize: 14,
                        lineNumbers: 'on',
                        folding: true
                    });
                });
            }, 300);
            
            // Clean up modal on close
            modal.addEventListener('hidden.bs.modal', () => {
                modal.remove();
            });
            
        } catch (error) {
            Utils.showToast(`Failed to load test case: ${error.message}`, 'danger');
        }
    }
    
    copyTestCase(testId) {
        try {
            const testCases = this.getTestCasesFromStorage();
            const testCase = testCases.find(tc => tc.id === testId);
            
            if (!testCase) {
                Utils.showToast('Test case not found!', 'warning');
                return;
            }
            
            if (testCase.content) {
                navigator.clipboard.writeText(testCase.content).then(() => {
                    Utils.showToast('Test content copied to clipboard! 📋', 'success');
                }).catch(() => {
                    Utils.showToast('Failed to copy to clipboard', 'danger');
                });
            } else {
                Utils.showToast('No content available to copy', 'warning');
            }
        } catch (error) {
            Utils.showToast(`Failed to copy test case: ${error.message}`, 'danger');
        }
    }
    
    deleteTestCase(testId) {
        if (!confirm('Are you sure you want to delete this test case? This action cannot be undone.')) {
            return;
        }
        
        try {
            const testCases = this.getTestCasesFromStorage();
            const filteredTestCases = testCases.filter(tc => tc.id !== testId);
            
            this.saveTestCasesToStorage(filteredTestCases);
            Utils.showToast('Test case deleted successfully! 🗑️', 'success');
            
            // Reload test cases
            this.loadTestCases();
        } catch (error) {
            Utils.showToast(`Failed to delete test case: ${error.message}`, 'danger');
        }
    }
    
    // Modal initialization
    initModals() {
        // File browser modal
        const fileBrowserModal = document.getElementById('fileBrowserModal');
        fileBrowserModal.addEventListener('hidden.bs.modal', () => {
            // Don't reset currentRepo - keep it for commit operations
            // this.currentRepo = null;  // Removed to persist repository selection
            this.currentPreviewFile = null;
            document.getElementById('refactor-btn').disabled = true;
            document.getElementById('vulnerability-btn').disabled = true;
        });
        
        // Test editor maximized modal cleanup
        const testEditorModal = document.getElementById('maximizeEditorModal');
        if (testEditorModal) {
            testEditorModal.addEventListener('hidden.bs.modal', () => {
                if (this.maximizedEditor) {
                    this.maximizedEditor.dispose();
                    this.maximizedEditor = null;
                }
            });
        }
        
        // Analysis buttons in modal
        document.getElementById('refactor-btn')?.addEventListener('click', () => {
            if (this.currentPreviewFile) {
                this.analyzeCode(this.currentPreviewFile.repo, this.currentPreviewFile.path, 'refactor');
            }
        });
        
        document.getElementById('vulnerability-btn')?.addEventListener('click', () => {
            if (this.currentPreviewFile) {
                this.analyzeCode(this.currentPreviewFile.repo, this.currentPreviewFile.path, 'vulnerability');
            }
        });
    }
    
    updatePerformanceIndicatorsCompact(analytics) {
        // Wrapper to keep compatibility and avoid referencing removed UI elements
        this.updatePerformanceIndicators(analytics);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});