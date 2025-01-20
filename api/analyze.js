const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { OpenAI } = require('openai');

module.exports = async (req, res) => {
    console.log('API endpoint hit');

    if (req.method !== 'POST') {
        console.log('Wrong method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Log the incoming request
    console.log('Request body:', req.body);
    const { url, task } = req.body;

    if (!url || !task) {
        console.log('Missing url or task');
        return res.status(400).json({ error: 'URL and task are required' });
    }

    let browser = null;

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

        // Launch browser with more detailed options
        console.log('Launching browser');
        browser = await puppeteer.launch({
            args: [...chromium.args, '--no-sandbox'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: true,
            ignoreHTTPSErrors: true
        });

        console.log('Creating new page');
        const page = await browser.newPage();

        // Set a reasonable timeout
        await page.setDefaultNavigationTimeout(30000);

        console.log('Navigating to URL:', url);
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        console.log('Getting page content');
        const content = await page.evaluate(() => document.body.innerText);

        console.log('Taking screenshot');
        const screenshot = await page.screenshot({ 
            encoding: 'base64',
            fullPage: true
        });

        console.log('Making OpenAI request');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a web analysis expert. Analyze the content and provide relevant information."
                },
                {
                    role: "user",
                    content: `Analyze this webpage content for the task: ${task}\n\nContent: ${content.slice(0, 1500)}`
                }
            ]
        });

        console.log('Sending successful response');
        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                screenshot: screenshot
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

    } finally {
        if (browser) {
            console.log('Closing browser');
            await browser.close();
        }
    }
};