document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('searchForm');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultsDiv = document.getElementById('results');
    const searchInput = document.getElementById('searchInput');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = searchInput.value.trim();
        
        if (!query) return;

        // Reset UI state
        loadingDiv.classList.add('active');
        errorDiv.classList.remove('active');
        errorDiv.textContent = '';
        resultsDiv.innerHTML = '';
        searchInput.disabled = true;

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ task: query })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to process request');
            }

            displayResults(data.data);

        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.classList.add('active');
        } finally {
            loadingDiv.classList.remove('active');
            searchInput.disabled = false;
        }
    });

    function displayResults(data) {
        // Create sources card if sources exist
        if (data.sources && data.sources.length > 0) {
            const sourcesCard = createCard('Sources', `
                <div class="sources-list">
                    ${data.sources.map(source => `
                        <a href="${source}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="source-link">
                            ${new URL(source).hostname}
                        </a>
                    `).join('')}
                </div>
            `);
            resultsDiv.appendChild(sourcesCard);
        }

        // Create analysis card
        const analysisCard = createCard('Results', `
            <div class="analysis-content">${formatAnalysis(data.analysis)}</div>
        `);
        resultsDiv.appendChild(analysisCard);

        // Create screenshots card if screenshots exist
        if (data.screenshots && data.screenshots.length > 0) {
            const screenshotsCard = createCard('Visual Results', `
                <div class="screenshots-grid">
                    ${data.screenshots.map(screenshot => `
                        <div class="screenshot-container">
                            <img src="data:image/png;base64,${screenshot.image}" 
                                 alt="Screenshot from ${screenshot.source}">
                            <div class="screenshot-caption">
                                ${new URL(screenshot.source).hostname}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `);
            resultsDiv.appendChild(screenshotsCard);
        }
    }

    function createCard(title, content) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-header">
                <h2 class="card-title">${title}</h2>
            </div>
            <div class="card-content">
                ${content}
            </div>
        `;
        return card;
    }

    function formatAnalysis(analysis) {
        // Split by numbered points and preserve formatting
        return analysis
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n\n');
    }
});
