// app.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('agentForm');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        resultDiv.textContent = 'Working on it...';
        
        const url = document.getElementById('url').value;
        const task = document.getElementById('task').value;

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

            // Display results
            resultDiv.innerHTML = `
                <h3>Analysis Results:</h3>
                <pre>${JSON.stringify(data.data.analysis, null, 2)}</pre>
            `;

            // Display screenshot if available
            if (data.data.screenshot) {
                screenshotsDiv.innerHTML = `
                    <div class="screenshot">
                        <img src="data:image/png;base64,${data.data.screenshot}" 
                             alt="Page Screenshot">
                    </div>
                `;
            }

        } catch (error) {
            resultDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Run Agent';
        }
    });
});