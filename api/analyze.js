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
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    // Enhanced prompt for better source suggestions
    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "system",
                content: `You are an expert at finding relevant and reliable web sources. When given a task, suggest 3-5 specific URLs that would be most helpful for that task. Consider:
                - Official websites and directories
                - Reputable review sites
                - Local business listings
                - Specialized forums or communities
                Return only a JSON array of URLs, nothing else.`
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
        
        // Enhanced content extraction
        const content = {
            text: dom.window.document.body.textContent,
            title: dom.window.document.title,
            headings: Array.from(dom.window.document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(Boolean),
            links: Array.from(dom.window.document.querySelectorAll('a'))
                .map(a => ({ text: a.textContent.trim(), href: a.href }))
                .filter(l => l.text && l.href)
        };

        const screenshots = await getScreenshots(url);

        return {
            url,
            content: JSON.stringify(content).slice(0, 15000), // Stringify the structured content
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

        // Combine content from all sites for analysis
        const combinedContent = sitesData.map(site => {
            const content = JSON.parse(site.content);
            return `Content from ${site.url}:
Title: ${content.title}
Main Headings: ${content.headings.join(' | ')}
Key Information: ${content.text.slice(0, 1000)}`;
        }).join('\n\n');

        console.log('Making OpenAI request for analysis');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Analyze the content provided and give a comprehensive answer to the user's task. Follow these guidelines:
                    - Present information in clear, numbered points
                    - For each point, cite the source URL
                    - Highlight key facts and details
                    - Note any discrepancies between sources
                    - Include relevant contact information or addresses if available
                    - Add any important warnings or considerations
                    Keep the response concise but informative.`
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
