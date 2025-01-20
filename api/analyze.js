// api/analyze.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;

    if (!url || !task) {
        return res.status(400).json({ error: 'URL and task are required' });
    }

    let browser = null;

    try {
        // Launch browser
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Take screenshot
        const screenshot = await page.screenshot({
            fullPage: true,
            encoding: 'base64'
        });

        // Get page content
        const content = await page.evaluate(() => {
            return {
                text: document.body.innerText,
                links: Array.from(document.getElementsByTagName('a')).map(a => ({
                    text: a.innerText,
                    href: a.href
                })),
                title: document.title
            };
        });

        // Analyze with GPT
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a web analysis expert. Analyze the content and provide relevant information."
                },
                {
                    role: "user",
                    content: `Analyze this webpage content for the task: ${task}\n\nContent: ${content.text.slice(0, 1500)}`
                }
            ]
        });

        // Return results
        res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                pageInfo: content,
                screenshot: screenshot
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}