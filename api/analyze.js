const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function findRelevantSections(content, task) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "system",
                content: "You are an expert at HTML analysis. Based on the content and task, return just a JSON array of CSS selectors that would target the most relevant sections. Keep it focused and specific."
            },
            {
                role: "user",
                content: `Find CSS selectors for sections relevant to this task: ${task}\n\nContent: ${content.slice(0, 5000)}`
            }
        ]
    });

    try {
        return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
        console.log('Error parsing selectors, using defaults');
        return ['.article', '.content', 'main'];
    }
}

async function getScreenshots(url, selectors, retries = 2) {
    const screenshots = [];
    
    for (const selector of selectors) {
        for (let i = 0; i < retries; i++) {
            try {
                console.log(`Screenshot attempt ${i + 1} for selector: ${selector}`);
                const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&selector=${encodeURIComponent(selector)}&width=800&height=600&fresh=true&response_type=json`;
                
                const screenshotResponse = await fetch(screenshotUrl, {
                    timeout: 5000
                });
                
                if (screenshotResponse.ok) {
                    const data = await screenshotResponse.json();
                    const imageResponse = await fetch(data.url, {
                        timeout: 5000
                    });
                    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                    screenshots.push({
                        selector: selector,
                        image: imageBuffer.toString('base64')
                    });
                    break; // Success, move to next selector
                }
            } catch (error) {
                console.log(`Screenshot attempt ${i + 1} failed for ${selector}:`, error.message);
                if (i === retries - 1) continue; // Move to next selector on failure
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return screenshots;
}

module.exports = async (req, res) => {
    console.log('API endpoint hit');

    if (req.method !== 'POST') {
        console.log('Wrong method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Request body:', req.body);
    const { url, task } = req.body;

    if (!url || !task) {
        console.log('Missing url or task');
        return res.status(400).json({ error: 'URL and task are required' });
    }

    try {
        // Check OpenAI key
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        // Initialize OpenAI
        console.log('Initializing OpenAI');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Get webpage content
        console.log('Fetching webpage content');
        const pageResponse = await fetch(url, {
            timeout: 10000
        });
        const htmlContent = await pageResponse.text();

        // Parse the HTML content
        const dom = new JSDOM(htmlContent);
        const content = dom.window.document.body.textContent;

        // Get relevant selectors based on the task
        const relevantSelectors = await findRelevantSections(content, task);

        // Get screenshots of relevant sections
        console.log('Getting targeted screenshots');
        const screenshots = await getScreenshots(url, relevantSelectors);

        console.log('Making OpenAI request for analysis');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a web analysis expert. Analyze the content based on the specific task requested. Present your findings in clear, numbered points. Each point should be complete and relevant to the requested task."
                },
                {
                    role: "user",
                    content: `Analyze this webpage content for the following task: ${task}\n\nContent: ${content.slice(0, 15000)}`
                }
            ]
        });

        console.log('Sending successful response');
        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                screenshots: screenshots
            }
        });

    } catch (error) {
        console.error('Detailed API Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        return res.status(500).json({ 
            error: error.message,
            type: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
