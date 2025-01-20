const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function getScreenshots(url, retries = 2) {
    try {
        console.log('Getting screenshot for:', url);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&width=600&height=400&fresh=true&format=jpeg&quality=60&response_type=json&full_page=false&delay=2`;
        
        const screenshotResponse = await fetch(screenshotUrl, {
            timeout: 30000
        });
        
        if (screenshotResponse.ok) {
            const data = await screenshotResponse.json();
            const imageResponse = await fetch(data.url, {
                timeout: 30000
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
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are an expert at finding relevant and reliable web sources. When given a task, provide ONLY real, complete URLs that currently exist and contain relevant information. For example:
                    - For gaming cafes in London: "https://www.timeout.com/london/things-to-do/best-gaming-cafes-in-london"
                    - NOT just "www.timeout.com" or "timeout.com/london"
                    Return only complete, working URLs in a JSON array. Double check that each URL pattern matches real pages.`
                },
                {
                    role: "user",
                    content: task
                }
            ],
            max_tokens: 500
        });

        const urls = JSON.parse(completion.choices[0].message.content);
        
        // Validate URLs
        return urls.filter(url => {
            try {
                const urlObj = new URL(url);
                return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
            } catch {
                return false;
            }
        });
    } catch (error) {
        console.log('Error finding sources:', error);
        return [];
    }
}

async function analyzeSite(url, task) {
    try {
        console.log('Analyzing site:', url);
        const pageResponse = await fetch(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        // Check if page exists
        if (!pageResponse.ok) {
            console.log(`Failed to fetch ${url}: ${pageResponse.status} ${pageResponse.statusText}`);
            return null;
        }

        const htmlContent = await pageResponse.text();
        const dom = new JSDOM(htmlContent);
        
        // Extract specific content instead of full body text
        const mainContent = {
            title: dom.window.document.title,
            headings: Array.from(dom.window.document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(Boolean)
                .slice(0, 10),
            paragraphs: Array.from(dom.window.document.querySelectorAll('p'))
                .map(p => p.textContent.trim())
                .filter(Boolean)
                .slice(0, 20)
        };

        const screenshots = await getScreenshots(url);

        return {
            url,
            content: JSON.stringify(mainContent).slice(0, 8000),
            screenshots
        };
    } catch (error) {
        console.log(`Failed to analyze ${url}:`, error.message);
        return null;
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { task } = req.body;

    if (!task) {
        return res.status(400).json({ error: 'Task is required' });
    }

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('Finding relevant sources for task:', task);
        const relevantUrls = await findRelevantSources(task);
        console.log('Found relevant URLs:', relevantUrls);

        const analysisPromises = relevantUrls.map(url => analyzeSite(url, task));
        const sitesData = (await Promise.all(analysisPromises)).filter(Boolean);

        if (sitesData.length === 0) {
            throw new Error('Failed to analyze any sites');
        }

        // Format content for analysis
        const combinedContent = sitesData.map(site => {
            const content = JSON.parse(site.content);
            return `Content from ${site.url}:
Title: ${content.title}
Key Information:
${content.headings.join('\n')}
${content.paragraphs.join('\n')}`;
        }).join('\n\n').slice(0, 12000);

        console.log('Making OpenAI request for analysis');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Analyze the content provided and give a comprehensive answer to the user's task. Present information in clear, numbered points. For each point, cite the source URL where possible. Focus on the most relevant and useful information. If no useful information is found, clearly state this and suggest alternative approaches."
                },
                {
                    role: "user",
                    content: `Task: ${task}\n\n${combinedContent}`
                }
            ],
            max_tokens: 1000
        });

        const allScreenshots = sitesData.flatMap(site => 
            site.screenshots.map(shot => ({
                ...shot,
                source: site.url
            }))
        );

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
            error: error.message
        });
    }
};
