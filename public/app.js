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
            metrics: [],
            details: []
        };

        // Split analysis into paragraphs
        const paragraphs = analysisText.split('\n\n').filter(p => p.trim());

        // Extract metrics (numbers with labels)
        const numberPattern = /(\d+(?:\.\d+)?)\s*(?:percent|%|\b)/g;
        let metricsFound = 0;
        paragraphs.forEach(para => {
            const matches = para.match(numberPattern);
            if (matches && metricsFound < 3) {
                matches.forEach(match => {
                    if (metricsFound < 3) {
                        sections.metrics.push({
                            value: match,
                            label: para.split(match)[1]?.split('.')[0]?.trim() || 'Metric'
                        });
                        metricsFound++;
                    }
                });
            }
        });

        // Process remaining content into sections
        let currentSection = { title: 'Overview', content: [] };
        
        paragraphs.forEach(para => {
            if (para.includes(':') && para.length < 50) {
                // This looks like a section header
                if (currentSection.content.length > 0) {
                    sections.details.push(currentSection);
                }
                currentSection = {
                    title: para.split(':')[0].trim(),
                    content: [para.split(':')[1].trim()]
                };
            } else {
                currentSection.content.push(para);
            }
        });
        
        // Add the last section
        if (currentSection.content.length > 0) {
            sections.details.push(currentSection);
        }

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
