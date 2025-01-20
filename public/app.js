<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Agent</title>
    <style>
        :root {
            --primary-color: #2D3748;
            --accent-color: #4299E1;
            --background-color: #F7FAFC;
            --text-color: #1A202C;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            background: var(--background-color);
            color: var(--text-color);
        }

        .container {
            max-width: 1200px;
            margin: 40px auto;
            padding: 0 20px;
        }

        .hero {
            text-align: center;
            margin-bottom: 60px;
        }

        .hero h1 {
            font-size: 3.5rem;
            font-weight: 800;
            color: var(--primary-color);
            margin-bottom: 20px;
            line-height: 1.2;
        }

        .hero p {
            font-size: 1.25rem;
            color: #4A5568;
            max-width: 600px;
            margin: 0 auto;
        }

        .form-container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            max-width: 800px;
            margin: 0 auto;
        }

        .form-group {
            margin-bottom: 24px;
        }

        .screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
    margin-top: 20px;
}

.sources-section {
    margin-bottom: 24px;
}

.sources-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.source-item {
    background: #EDF2F7;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.9rem;
    color: #4A5568;
}

.source-url {
    word-break: break-all;
}

        label {
            display: block;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--primary-color);
            font-size: 1.1rem;
        }

        input, textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #E2E8F0;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }

        textarea {
            min-height: 120px;
            resize: vertical;
        }

        button {
            background: var(--accent-color);
            color: white;
            padding: 14px 28px;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 600;
            width: 100%;
            cursor: pointer;
            transition: transform 0.2s ease, background-color 0.2s ease;
        }

        button:hover {
            background: #3182CE;
            transform: translateY(-1px);
        }

        button:active {
            transform: translateY(1px);
        }

        .loading {
            text-align: center;
            padding: 20px;
            display: none;
            color: var(--primary-color);
        }

        .loading.active {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        }

        .loading::after {
            content: '';
            width: 20px;
            height: 20px;
            border: 3px solid #E2E8F0;
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error {
            background: #FED7D7;
            color: #C53030;
            padding: 12px;
            border-radius: 8px;
            margin-top: 16px;
            display: none;
        }

        .error.active {
            display: block;
        }

        #result {
            margin-top: 30px;
            padding: 24px;
            background: #EDF2F7;
            border-radius: 12px;
            font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
            line-height: 1.6;
        }

        #result h2 {
            font-size: 1.5rem;
            color: var(--primary-color);
            margin-bottom: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        #result .section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        #result .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--primary-color);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #result .section-title::before {
            content: '';
            display: inline-block;
            width: 12px;
            height: 12px;
            background: var(--accent-color);
            border-radius: 50%;
        }

        #result .data-item {
            padding: 8px 0;
            border-bottom: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .screenshot-container {
    margin-top: 20px;
}

.screenshot {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    background: white;
    padding: 16px;
}

.screenshot img {
    width: 100%;
    height: auto;
    border-radius: 8px;
    display: block;
}

.screenshot-caption {
    text-align: center;
    color: #4A5568;
    margin-top: 12px;
    font-size: 0.9rem;
}

.section-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-color);
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--accent-color);
}

        #result .data-item:last-child {
            border-bottom: none;
        }

        #result .data-label {
            color: #4A5568;
            font-weight: 500;
        }

        #result .data-value {
            color: var(--text-color);
            font-weight: 600;
        }

        #result .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }

        #result .metric-card {
            background: #F7FAFC;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
        }

        #result .metric-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--accent-color);
            margin-bottom: 4px;
        }

        #result .metric-label {
            color: #4A5568;
            font-size: 0.9rem;
        }

        #result code {
            background: #2D3748;
            color: #EDF2F7;
            padding: 16px;
            border-radius: 6px;
            display: block;
            overflow-x: auto;
            margin: 12px 0;
        }

        #result ul, #result ol {
            margin: 12px 0;
            padding-left: 24px;
        }

        #result li {
            margin: 6px 0;
        }

        #result .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.875rem;
            font-weight: 500;
        }

        #result .status-success {
            background: #C6F6D5;
            color: #2F855A;
        }

        #result .status-warning {
            background: #FEEBC8;
            color: #C05621;
        }

        #result .status-error {
            background: #FED7D7;
            color: #C53030;
        }

        .screenshots {
            margin-top: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 24px;
        }

        .screenshot {
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s ease;
        }

        .screenshot:hover {
            transform: translateY(-4px);
        }

        .screenshot img {
            width: 100%;
            height: auto;
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
    <div class="hero">
    <h1>Web Agent</h1>
    <p>Ask our web agent anything, and it will search and analyze the web for you.</p>
</div>
        
        <div class="form-container">
        <form id="agentForm">
        <div class="form-group">
            <label for="task">What would you like to find?</label>
            <textarea id="task" required 
                      placeholder="Ask anything (e.g., 'find good Muay Thai gyms in London' or 'search for best Italian restaurants in New York')"></textarea>
        </div>
        <button type="submit" id="submitBtn">Search Web</button>
    </form>
            
            <div class="loading" id="loading">
                Processing your request...
            </div>

            <div class="error" id="error"></div>

            <div id="result"></div>
            
            <div class="screenshots" id="screenshots"></div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
