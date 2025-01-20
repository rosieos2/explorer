const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function getScreenshots(url, retries = 2) {
    try {
        console.log('Getting screenshot for:', url);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&width=600&height=400&fresh=true&format=jpeg&quality=60&response_type=json&full_page=false&delay=2`;
        
        const screenshotResponse = await fetch(screenshotUrl, {
            timeout: 15000
        });
        
        if (screenshotResponse.ok) {
            const data = await screenshotResponse.json();
            const imageResponse = await fetch(data.url, {
                timeout: 10000
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
    return [];
}

async function findRelevantSources(task) {
    // Ask GPT to suggest relevant URLs based on the task
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "system",
                content: "You are an expert at finding relevant and reliable web sources. When given a task, suggest 2-3 specific URLs that would be most helpful for that task. Return only a JSON array of URLs, nothing else."
            },
            {
                role: "user",
                content: task
            }
        ]
    });

    try {
        return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
        console.log('Error parsing URLs:', error);
        return [];
    }
}

async function analyzeSite(url, task) {
    try {
        console.log('Analyzing site:', url);
        const pageResponse = await fetch(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const htmlContent = await pageResponse.text();
        const dom = new JSDOM(htmlContent);
        const content = dom.window.document.body.textContent;
        const screenshots = await getScreenshots(url);

        return {
            url,
            content: content.slice(0, 15000),
            screenshots
        };
    } catch (error) {
        console.log(`Failed to analyze ${url}:`, error.message);
        return null;
    }
}

module.exports = async (req, res) => {
    console.log('API endpoint hit');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;

    if (!url && !task) {
        return res.status(400).json({ error: 'URL or task is required' });
    }

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        let sitesData = [];

        if (url) {
            // Single site analysis
            const siteData = await analyzeSite(url, task);
            if (siteData) sitesData.push(siteData);
        } else {
            // Multi-site analysis based on task
            console.log('Finding relevant sources for task:', task);
            const relevantUrls = await findRelevantSources(task);
            console.log('Found relevant URLs:', relevantUrls);

            const analysisPromises = relevantUrls.map(url => analyzeSite(url, task));
            sitesData = (await Promise.all(analysisPromises)).filter(Boolean);
        }

        if (sitesData.length === 0) {
            throw new Error('Failed to analyze any sites');
        }

        // Combine content from all sites for analysis
        const combinedContent = sitesData.map(site => 
            `Content from ${site.url}:\n${site.content}`
        ).join('\n\n');

        console.log('Making OpenAI request for analysis');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Analyze the content provided and give a comprehensive answer to the user's task. Present information in clear, numbered points. For each point, cite the source URL. If you find conflicting information, note the discrepancies."
                },
                {
                    role: "user",
                    content: `Task: ${task}\n\n${combinedContent}`
                }
            ]
        });

        // Combine all screenshots
        const allScreenshots = sitesData.flatMap(site => 
            site.screenshots.map(shot => ({
                ...shot,
                source: site.url
            }))
        );

        console.log('Sending successful response');
        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                screenshots: allScreenshots,
                sources: sitesData.map(site => site.url)
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: error.message,
            type: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
