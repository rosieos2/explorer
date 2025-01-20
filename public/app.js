// app.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('agentForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const url = document.getElementById('url').value;
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
                body: JSON.stringify({ url, task })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to process request');
            }

            // Display screenshots if available
            if (data.data.screenshots && data.data.screenshots.length > 0) {
                displayScreenshots(data.data.screenshots);
            }

            // Process and display the analysis results
            displayResults(data.data);

        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.classList.add('active');
        } finally {
            loadingDiv.classList.remove('active');
            submitBtn.disabled = false;
        }
    });

    function displayResults(data) {
        const analysis = data.analysis;
        const sections = parseAnalysis(analysis);

        resultDiv.innerHTML = `
            <div class="section">
                <div class="section-title">Analysis Results</div>
                ${formatSectionContent(sections.content)}
            </div>
        `;
    }

    function parseAnalysis(analysisText) {
        // Clean up the text
        const cleanText = analysisText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Split by numbered points if they exist, otherwise keep as is
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

    function displayScreenshots(screenshots) {
        screenshotsDiv.innerHTML = `
            <div class="section">
                <div class="section-title">Relevant Content</div>
                <div class="screenshots-grid">
                    ${screenshots.map(shot => `
                        <div class="screenshot-container">
                            <div class="screenshot">
                                <img src="data:image/png;base64,${shot.image}" 
                                     alt="Relevant content section">
                            </div>
                            <div class="screenshot-caption">
                                Found in ${shot.selector}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
});
