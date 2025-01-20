const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function getScreenshots(url, retries = 2) {
    try {
        console.log('Getting screenshot');
        const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&width=800&height=600&fresh=true&format=jpeg&quality=80&response_type=json&full_page=false`;
        
        const screenshotResponse = await fetch(screenshotUrl, {
            timeout: 8000
        });
        
        if (screenshotResponse.ok) {
            const data = await screenshotResponse.json();
            const imageResponse = await fetch(data.url, {
                timeout: 5000
            });
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            return [{
                label: 'Page Snapshot',
                image: imageBuffer.toString('base64')
            }];
        }
    } catch (error) {
        console.log('Screenshot failed:', error.message);
    }
    
    return []; // Return empty array if screenshot fails
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

        // Get screenshots
        console.log('Getting screenshots');
        const screenshots = await getScreenshots(url);
        console.log(`Got ${screenshots.length} screenshots`);

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
