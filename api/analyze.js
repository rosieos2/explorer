const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// Search API configuration
const SEARCH_API_KEY = process.env.BING_API_KEY;
const SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const FETCH_TIMEOUT = 15000;
const SCREENSHOT_TIMEOUT = 20000;

async function getScreenshots(url, task) {
    try {
        console.log('Getting screenshot for:', url);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Only take screenshots of pages that are likely to have valuable visual content
        if (url.includes('video') || url.includes('gallery') || url.includes('image') || 
            url.includes('photo') || url.includes('watch') || url.includes('highlights')) {
            
            const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&width=600&height=400&fresh=true&format=jpeg&quality=60&response_type=json&full_page=false&delay=2`;
            
            const screenshotResponse = await fetch(screenshotUrl, {
                timeout: SCREENSHOT_TIMEOUT
            });
            
            if (screenshotResponse.ok) {
                const data = await screenshotResponse.json();
                const imageResponse = await fetch(data.url, {
                    timeout: FETCH_TIMEOUT
                });
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                return [{
                    label: 'Relevant Content',
                    image: imageBuffer.toString('base64')
                }];
            }
        }
    } catch (error) {
        console.log('Screenshot failed:', error.message);
    }
    return [];
}

async function findRelevantSources(query) {
    try {
        // First, optimize the search query using GPT
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const searchCompletion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "Convert user queries into optimal search terms that will find the most relevant and recent information. Think like a human performing a web search. Return only the optimized search query."
                },
                {
                    role: "user",
                    content: query
                }
            ],
            max_tokens: 50
        });

        const searchQuery = searchCompletion.choices[0].message.content;
        
        // Perform web search with Bing API
        const searchResponse = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(searchQuery)}&count=10&responseFilter=Webpages`, {
            headers: {
                'Ocp-Apim-Subscription-Key': SEARCH_API_KEY
            }
        });

        if (!searchResponse.ok) {
            throw new Error('Search API error');
        }

        const searchResults = await searchResponse.json();
        
        // Just return valid URLs from the search results
        if (searchResults?.webPages?.value) {
            return searchResults.webPages.value
                .map(result => result.url)
                .filter(url => {
                    try {
                        const urlObj = new URL(url);
                        return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
                    } catch {
                        return false;
                    }
                });
        }
        
        return [];

    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

// Separate function for fallback sources
function getFallbackSources(query) {
    const cleanQuery = encodeURIComponent(query);
    
    // General-purpose fallback sources
    const fallbackSources = [
        `https://www.reuters.com/search/news?blob=${cleanQuery}`,
        `https://www.bbc.com/search?q=${cleanQuery}`,
        `https://www.theguardian.com/search?q=${cleanQuery}`,
        `https://medium.com/search?q=${cleanQuery}`,
        `https://wikipedia.org/wiki/Special:Search?search=${cleanQuery}`
    ];

    return fallbackSources;
}

async function analyzeSite(url, task) {
    try {
        console.log('Analyzing site:', url);
        const response = await fetch(url, {
            timeout: FETCH_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status}`);
        }

        const html = await response.text();
        const dom = new JSDOM(html);

        // Extract main content
        const mainContent = {
            title: dom.window.document.title,
            article: dom.window.document.querySelector('article')?.textContent?.trim(),
            headings: Array.from(dom.window.document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(Boolean)
                .slice(0, 10),
            paragraphs: Array.from(dom.window.document.querySelectorAll('article p, main p, .content p'))
                .map(p => p.textContent.trim())
                .filter(Boolean)
                .filter(text => text.length > 50)
                .slice(0, 20)
        };

        const screenshots = await getScreenshots(url);

        return {
            url,
            content: JSON.stringify(mainContent),
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

        if (!process.env.BING_API_KEY) {
            throw new Error('Search API key is not configured');
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
${content.headings?.join('\n') || ''}
${content.paragraphs?.join('\n') || ''}`;
        }).join('\n\n').slice(0, 12000);

        console.log('Making OpenAI request for analysis');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a precise and factual information provider. When analyzing content:" +
                             "1. Always provide specific, concrete information" +
                             "2. Include names, addresses, and details when available" +
                             "3. If exact information isn't found, explicitly state that and suggest what specific information is missing" +
                             "4. Don't add conversational fluff or general context if not asked" +
                             "5. Present information in clear, numbered points" +
                             "6. Focus only on answering exactly what was asked" +
                             "If no specific information is found, state clearly: 'No specific information found for [query]. Consider searching for: [specific alternative search terms]'"
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
