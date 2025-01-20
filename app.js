// Handles UI interactions and form submissions
document.getElementById('agentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const resultDiv = document.getElementById('result');
    const screenshotsDiv = document.getElementById('screenshots');
    
    const url = document.getElementById('url').value;
    const task = document.getElementById('task').value;

    // Reset previous results
    errorDiv.classList.remove('active');
    resultDiv.textContent = '';
    screenshotsDiv.innerHTML = '';

    // Show loading state
    submitBtn.disabled = true;
    loadingDiv.classList.add('active');

    try {
        // Create new agent instance
        const agent = new WebAgent();
        await agent.initialize();
        
        // Execute the task
        const result = await agent.executeTask(url, task);
        
        // Display results
        resultDiv.textContent = JSON.stringify(result.data, null, 2);
        
        // Display screenshots if any
        if (result.screenshots && result.screenshots.length > 0) {
            result.screenshots.forEach((screenshot, index) => {
                const screenshotDiv = document.createElement('div');
                screenshotDiv.className = 'screenshot';
                
                const img = document.createElement('img');
                img.src = `data:image/png;base64,${screenshot}`;
                img.alt = `Screenshot ${index + 1}`;
                
                screenshotDiv.appendChild(img);
                screenshotsDiv.appendChild(screenshotDiv);
            });
        }
        
        // Clean up
        await agent.close();
        
    } catch (error) {
        errorDiv.textContent = `Error: ${error.message}`;
        errorDiv.classList.add('active');
    } finally {
        // Reset UI state
        submitBtn.disabled = false;
        loadingDiv.classList.remove('active');
    }
});