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

            // Process and display the analysis results
            displayResults(data.data);

            // Display screenshot if available
            if (data.data.screenshot) {
                displayScreenshot(data.data.screenshot);
            }

        } catch (error) {
            errorDiv.textContent = `Error: ${error.message}`;
            errorDiv.classList.add('active');
        } finally {
            loadingDiv.classList.remove('active');
            submitBtn.disabled = false;
        }
    });

    function displayResults(data) {
        // Convert the analysis text into structured sections
        const analysis = data.analysis;
        
        // Parse the analysis text to find common patterns like lists, key findings, etc.
        const sections = parseAnalysis(analysis);

        resultDiv.innerHTML = `
            <h2>Analysis Results</h2>
            
            <div class="section">
                <div class="section-title">Key Findings</div>
                <div class="metrics-grid">
                    ${sections.metrics.map(metric => `
                        <div class="metric-card">
                            <div class="metric-value">${metric.value}</div>
                            <div class="metric-label">${metric.label}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${sections.details.map(section => `
                <div class="section">
                    <div class="section-title">${section.title}</div>
                    ${formatSectionContent(section.content)}
                </div>
            `).join('')}
        `;
    }

    function parseAnalysis(analysisText) {
        // Initialize sections structure
        const sections = {
            metrics: [
                {
                    value: 'Live',
                    label: 'Updates'
                },
                {
                    value: '24/7',
                    label: 'Coverage'
                },
                {
                    value: 'Now',
                    label: 'Transfer Window'
                }
            ],
            details: []
        };

        // Clean up the text by removing asterisks and fixing line breaks
        const cleanText = analysisText
            .replace(/\*/g, '')  // Remove asterisks
            .replace(/\s*\n\s*([a-z])/g, ' $1')  // Join broken sentences
            .split(/\d+\.\s+/)   // Split by numbered points
            .filter(text => text.trim());  // Remove empty items

        // Create sections from the cleaned text
        sections.details = [
            {
                title: 'Latest Transfer News',
                content: cleanText.map(text => text.trim())
            }
        ];

        return sections;
    }

    function formatSectionContent(content) {
        if (Array.isArray(content)) {
            return content.map(item => {
                if (item.includes('•') || item.includes('-')) {
                    // Convert bullet points to structured list
                    const listItems = item.split(/[•-]/).filter(i => i.trim());
                    return `
                        <ul>
                            ${listItems.map(li => `
                                <li>${li.trim()}</li>
                            `).join('')}
                        </ul>
                    `;
                }
                return `<p>${item}</p>`;
            }).join('');
        }
        return `<p>${content}</p>`;
    }

    function displayScreenshot(screenshot) {
        screenshotsDiv.innerHTML = `
            <div class="screenshot">
                <img src="data:image/png;base64,${screenshot}" 
                     alt="Page Screenshot">
            </div>
        `;
    }
});
