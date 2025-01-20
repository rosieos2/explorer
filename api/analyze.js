const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { OpenAI } = require('openai');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;
    console.log('Received request:', { url, task });

    let browser = null;

    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath,
            headless: true
        });

        const page = await browser.newPage();
        await page.goto(url);

        const content = await page.evaluate(() => document.body.innerText);
        const screenshot = await page.screenshot({ encoding: 'base64' });

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a web analysis expert."
                },
                {
                    role: "user",
                    content: `Task: ${task}\n\nContent: ${content.slice(0, 1500)}`
                }
            ]
        });

        res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                screenshot: screenshot
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
};