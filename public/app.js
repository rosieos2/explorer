document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('agentForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');
    const terminalContent = document.getElementById('terminalContent');

    // Initialize terminal update
    function fetchRecentPrompts() {
        fetch('/api/prompts')
            .then(response => response.json())
            .then(data => {
                terminalContent.innerHTML = '';
                // Check if we have prompts and it's an array
                const prompts = data.prompts || [];
                
                prompts.forEach(prompt => {
                    const timestamp = new Date(prompt.timestamp).toLocaleTimeString();
                    const line = createTerminalLine(prompt.prompt, timestamp);
                    terminalContent.appendChild(line);
                });
                terminalContent.scrollTop = terminalContent.scrollHeight;
            })
            .catch(error => console.error('Error fetching prompts:', error));
    }

    function createTerminalLine(content, timestamp) {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        
        const time = document.createElement('span');
        time.className = 'terminal-timestamp';
        time.textContent = timestamp;
        
        const prompt = document.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = '>';
        
        const text = document.createElement('span');
        text.className = 'terminal-command';
        text.textContent = content;
        
        line.appendChild(time);
        line.appendChild(prompt);
        line.appendChild(text);
        
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
