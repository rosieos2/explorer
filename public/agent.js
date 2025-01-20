// agent.js
class WebAgent {
    async executeTask(url, task) {
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    task: task
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            const result = await response.json();

            if (result.data.screenshot) {
                // Display screenshot
                const screenshotsDiv = document.getElementById('screenshots');
                const screenshotDiv = document.createElement('div');
                screenshotDiv.className = 'screenshot';
                
                const img = document.createElement('img');
                img.src = `data:image/png;base64,${result.data.screenshot}`;
                img.alt = 'Page Screenshot';
                
                screenshotDiv.appendChild(img);
                screenshotsDiv.appendChild(screenshotDiv);
            }

            return result.data;

        } catch (error) {
            console.error('Task execution failed:', error);
            throw new Error(`Failed to execute task: ${error.message}`);
        }
    }
}