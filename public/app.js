document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('agentForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');

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
        // Split by numbered points and preserve formatting
        return analysis
            .split('\n')
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                // Check if line is a numbered point
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
        // Clean up the text
        const cleanText = analysisText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Split by numbered points if they exist
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
