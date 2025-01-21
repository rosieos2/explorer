document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('agentForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');
    const terminalContent = document.getElementById('terminalContent');
    const searchInput = document.getElementById('terminalSearch');

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
            
            // Copy the content
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
        
        // Get task value
        const task = document.getElementById('task').value;

        // Reset and show loading state
        loadingDiv.classList.add('active');
        submitBtn.disabled = true;
        errorDiv.classList.remove('active');
        screenshotsDiv.innerHTML = '';
        resultDiv.innerHTML = '';

        try {
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
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to process request');
            }

            // Display sources if available
            if (data.data.sources && data.data.sources.length > 0) {
                const sourcesHtml = `
                    <div class="section sources-section">
                        <div class="section-title">Sources Searched</div>
                        <div class="sources-list">
                            ${data.data.sources.map(source => `
                                <div class="source-item">
                                    <a href="${source}" target="_blank" rel="noopener noreferrer" class="source-url">
                                        ${new URL(source).hostname}
                                    </a>
                                </div>
                            `).join('')}
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

        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.classList.add('active');
        } finally {
            loadingDiv.classList.remove('active');
            submitBtn.disabled = false;
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

    function parseAnalysis(analysisText) {
        const cleanText = analysisText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const formattedText = cleanText
            .join('\n')
            .split(/(?=\d+\.\s+)/g)
            .map(text => text.trim())
            .filter(text => text.length > 0);

        return {
            content: formattedText
        };
    }

    function formatSectionContent(content) {
        if (Array.isArray(content)) {
            return content.map(item => {
                const isNumberedPoint = /^\d+\.\s/.test(item);
                const formattedItem = isNumberedPoint ? item : `• ${item}`;
                return `<div class="data-item">
                    <span class="data-value">${formattedItem}</span>
                </div>`;
            }).join('');
        }
        return `<p>${content}</p>`;
    }
});
