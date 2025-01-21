document.addEventListener('DOMContentLoaded', () => {
    // Check for first-time users
    if (!localStorage.getItem('hasSeenTutorial')) {
        showTutorial();
    }

    // Dark mode toggle
    const darkModeToggle = document.getElementById('darkModeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    darkModeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    const form = document.getElementById('agentForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');
    const terminalContent = document.getElementById('terminalContent');
    const searchInput = document.getElementById('terminalSearch');
    const resultsTerminal = document.querySelector('.results-terminal'); // Added this line
    const closeBtn = document.querySelector('.term-button.red');
const minimizeBtn = document.querySelector('.term-button.yellow');

if (resultsTerminal) {
    const minimizeBtn = document.querySelector('.term-button.minimize');
    
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            const terminalBody = resultsTerminal.querySelector('.terminal-body');
            
            if (isMinimized) {
                // Restore
                resultsTerminal.style.height = '';
                terminalBody.style.display = 'block';
                isMinimized = false;
            } else {
                // Minimize
                resultsTerminal.style.height = '40px';
                terminalBody.style.display = 'none';
                isMinimized = true;
            }
        });
    }
}
    
    // Make the terminal draggable
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    let isMinimized = false;
    
    const dragStart = (e) => {
        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }
    
        if (e.target.classList.contains('terminal-header-bar')) {
            isDragging = true;
        }
    };
    
    const drag = (e) => {
        if (isDragging) {
            e.preventDefault();
    
            if (e.type === "touchmove") {
                currentX = e.touches[0].clientX - initialX;
                currentY = e.touches[0].clientY - initialY;
            } else {
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
            }
    
            xOffset = currentX;
            yOffset = currentY;
    
            setTranslate(currentX, currentY, resultsTerminal);
        }
    };
    
    const dragEnd = () => {
        isDragging = false;
    };
    
    const setTranslate = (xPos, yPos, el) => {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    };
    
    if (resultsTerminal) {
        resultsTerminal.addEventListener('touchstart', dragStart, false);
        resultsTerminal.addEventListener('touchend', dragEnd, false);
        resultsTerminal.addEventListener('touchmove', drag, false);
        resultsTerminal.addEventListener('mousedown', dragStart, false);
        resultsTerminal.addEventListener('mouseup', dragEnd, false);
        resultsTerminal.addEventListener('mousemove', drag, false);
    }

    // Initialize terminal update
    function fetchRecentPrompts() {
        fetch('/api/prompts')
            .then(response => response.json())
            .then(data => {
                const searchTerm = searchInput.value.toLowerCase();
                terminalContent.innerHTML = '';
                
                const prompts = data.prompts || [];
                prompts.forEach(prompt => {
                    const line = createTerminalLine(prompt.prompt, prompt.timestamp);
                    
                    // Apply current search filter
                    if (searchTerm && !prompt.prompt.toLowerCase().includes(searchTerm)) {
                        line.classList.add('hidden');
                    }
                    
                    terminalContent.appendChild(line);
                });
                
                // Add typing animation to the latest prompt
                if (prompts.length > 0) {
                    const latestLine = terminalContent.lastElementChild;
                    latestLine.querySelector('.terminal-command').classList.add('typing');
                }

                terminalContent.scrollTop = terminalContent.scrollHeight;
            })
            .catch(error => console.error('Error fetching prompts:', error));
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const terminalLines = document.querySelectorAll('.terminal-line');
        
        terminalLines.forEach(line => {
            const content = line.querySelector('.terminal-command').textContent.toLowerCase();
            if (content.includes(searchTerm)) {
                line.classList.remove('hidden');
            } else {
                line.classList.add('hidden');
            }
        });
    });

    function createTerminalLine(content, timestamp) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        const time = document.createElement('span');
        time.className = 'terminal-timestamp';
        time.textContent = new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const dir = document.createElement('span');
        dir.className = 'terminal-dir';
        dir.textContent = 'C:\\webagent>';
        
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = '>';
        
        const text = document.createElement('span');
        text.className = 'terminal-command';
        text.textContent = content;
        
        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'terminal-copy-btn';
        copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>`;
        
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            try {
                await navigator.clipboard.writeText(content);
                copyBtn.classList.add('copy-success');
                setTimeout(() => copyBtn.classList.remove('copy-success'), 1000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
        
        line.appendChild(time);
        line.appendChild(dir);
        line.appendChild(prompt);
        line.appendChild(text);
        line.appendChild(copyBtn);
        
        return line;
    }

    // Update terminal every 3 seconds
    setInterval(fetchRecentPrompts, 3000);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const task = document.getElementById('task').value;
        
        // Add progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-bar-fill';
        progressBar.appendChild(progressFill);
        loadingDiv.appendChild(progressBar);

        loadingDiv.classList.add('active');
        submitBtn.disabled = true;
        errorDiv.classList.remove('active');
        screenshotsDiv.innerHTML = '';
        resultDiv.innerHTML = '';

        try {
            // Simulate progress
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                progressFill.style.width = `${progress}%`;
            }, 500);

            // Save prompt to database
            await fetch('/api/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: task })
            });

            // Process the analysis
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ task })
            });

            const data = await response.json();
            
            clearInterval(progressInterval);
            progressFill.style.width = '100%';
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to process request');
            }

            // Show the results terminal
            resultsTerminal.classList.add('active'); // Added this line

            // Display sources if available
            if (data.data.sources && data.data.sources.length > 0) {
                const sourcesHtml = `
    <div class="section sources-section">
        <div class="section-title">Sources Searched</div>
        <div class="sources-list">
            ${data.data.sources.map(source => 
                `<a href="${source}" target="_blank" rel="noopener noreferrer" class="source-url">${new URL(source).hostname}</a>`
            ).join('\n')}
        </div>
    </div>
`;
                resultDiv.innerHTML = sourcesHtml + resultDiv.innerHTML;
            }

            // Process and display the analysis results
            const analysisHtml = `
                <div class="section">
                    <div class="section-title">Search Results</div>
                    <div class="analysis-content">
                        ${formatAnalysis(data.data.analysis)}
                    </div>
                </div>
            `;
            resultDiv.innerHTML += analysisHtml;

            // Display screenshots if available
            if (data.data.screenshots && data.data.screenshots.length > 0) {
                displayScreenshots(data.data.screenshots);
            }

            // Update stats
            updateStats();

        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.classList.add('active');
        } finally {
            loadingDiv.classList.remove('active');
            submitBtn.disabled = false;
            // Remove progress bar
            progressBar.remove();
        }
    });

    function formatAnalysis(analysis) {
        return analysis
            .split('\n')
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                const isNumberedPoint = /^\d+\.\s/.test(trimmed);
                return `<div class="data-item">
                    <span class="data-value">${isNumberedPoint ? trimmed : '• ' + trimmed}</span>
                </div>`;
            })
            .filter(Boolean)
            .join('');
    }

    function displayScreenshots(screenshots) {
        const screenshotsHtml = `
            <div class="section">
                <div class="section-title">Visual Results</div>
                <div class="screenshots-grid">
                    ${screenshots.map(shot => `
                        <div class="screenshot-container">
                            <div class="screenshot">
                                <img src="data:image/png;base64,${shot.image}" 
                                     alt="Relevant content section">
                                <div class="screenshot-caption">
                                    Source: ${new URL(shot.source).hostname}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        screenshotsDiv.innerHTML = screenshotsHtml;
    }

    // Tutorial functions
    function showTutorial() {
        const modal = document.getElementById('tutorialModal');
        modal.classList.add('active');
        localStorage.setItem('hasSeenTutorial', 'true');

        document.getElementById('tutorialClose').addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Animate stats
    function animateStats() {
        const stats = document.querySelectorAll('.stat-value');
        stats.forEach(stat => {
            const target = parseInt(stat.textContent.replace(/,/g, ''));
            let current = 0;
            const increment = target / 100;
            const duration = 1000; // 1 second
            const steps = 100;
            const step = duration / steps;

            const timer = setInterval(() => {
                current += increment;
                if (current >= target) {
                    clearInterval(timer);
                    current = target;
                }
                stat.textContent = Math.floor(current).toLocaleString();
            }, step);
        });
    }

    // Real-time stats updates
    async function updateStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) {
                // Use default values if API is not available
                const defaultStats = {
                    totalPrompts: 147382,
                    activeUsers: 1293,
                    dataSize: 3000000000 // 3GB in bytes
                };
                updateStatsDisplay(defaultStats);
                return;
            }
            const data = await response.json();
            updateStatsDisplay(data);
        } catch (error) {
            console.log('Using default stats due to API unavailability');
            // Use default values
            const defaultStats = {
                totalPrompts: 147382,
                activeUsers: 1293,
                dataSize: 3000000000
            };
            updateStatsDisplay(defaultStats);
        }
    }
    
    function updateStatsDisplay(data) {
        const promptCount = document.getElementById('promptCount');
        const activeUsers = document.getElementById('activeUsers');
        const dataSize = document.getElementById('dataSize');
    
        if (promptCount) promptCount.textContent = data.totalPrompts.toLocaleString();
        if (activeUsers) activeUsers.textContent = data.activeUsers.toLocaleString();
        if (dataSize) dataSize.textContent = formatDataSize(data.dataSize);
    
        animateStats();
    }

    function formatDataSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }

    // Initialize stats and chart
    updateStats();
    setInterval(updateStats, 30000); // Update every 30 seconds
});
