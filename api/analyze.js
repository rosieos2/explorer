const { OpenAI } = require('openai');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// API and configuration constants
const SEARCH_API_KEY = process.env.BING_API_KEY;
const SEARCH_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';
const FETCH_TIMEOUT = 15000;
const SCREENSHOT_TIMEOUT = 20000;

// Rate limiting and retry configuration
const RETRY_DELAYS = [1000, 2000, 4000]; // Delays between retries in milliseconds
const RATE_LIMIT_DELAY = 1000; // Delay between searches in milliseconds

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getScreenshots(url) {
    try {
        console.log('Getting screenshot for:', url);
        
        const screenshotUrl = `https://api.apiflash.com/v1/urltoimage?access_key=${process.env.APIFLASH_KEY}&url=${encodeURIComponent(url)}&width=800&height=600&fresh=true&format=jpeg&quality=80&response_type=json&full_page=false`;
        
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
                label: url,
                image: imageBuffer.toString('base64')
            }];
        }
    } catch (error) {
        console.log('Screenshot failed:', error.message);
    }
    return [];
}

async function findRelevantSources(query) {
    try {
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const searchCompletion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a search optimization expert. Your task is to:" +
                            "1. Analyze the user's query and identify key topics/entities" +
                            "2. Add relevant context and specific terms to improve search accuracy" +
                            "3. Include time-based terms for recent information if appropriate" +
                            "4. Format the query to maximize relevance in web searches" +
                            "5. Remove any special characters that might interfere with search" +
                            "Return only the optimized search query, no explanations."
                },
                {
                    role: "user",
                    content: query
                }
            ],
            max_tokens: 100
        });

        const searchQuery = searchCompletion.choices[0].message.content;
        
        // Define different search parameters for multiple attempts
        const searchParams = [
            { freshness: 'Day', count: 10 },
            { freshness: 'Week', count: 10 },
            { freshness: 'Month', count: 10 },
            { count: 10 } // No freshness parameter as fallback
        ];

        const urls = new Set();
        
        // Try each search parameter set sequentially until we get results
        for (const params of searchParams) {
            const searchUrl = new URL(SEARCH_ENDPOINT);
            searchUrl.searchParams.set('q', searchQuery);
            searchUrl.searchParams.set('count', params.count.toString());
            searchUrl.searchParams.set('responseFilter', 'Webpages');
            if (params.freshness) {
                searchUrl.searchParams.set('freshness', params.freshness);
            }

            // Add retry logic for each search attempt
            let lastError = null;
            for (let retryCount = 0; retryCount <= RETRY_DELAYS.length; retryCount++) {
                try {
                    // Add delay between requests to respect rate limits
                    if (retryCount > 0) {
                        const delayTime = RETRY_DELAYS[retryCount - 1];
                        console.log(`Retrying search after ${delayTime}ms delay...`);
                        await delay(delayTime);
                    }

                    const response = await fetch(searchUrl.toString(), {
                        headers: {
                            'Ocp-Apim-Subscription-Key': SEARCH_API_KEY
                        }
                    });

                    if (response.status === 429) {
                        console.log('Rate limit hit, will retry...');
                        lastError = new Error('Rate limit exceeded');
                        continue;
                    }

                    if (!response.ok) {
                        console.log(`Search failed with params ${JSON.stringify(params)}: ${response.status}`);
                        lastError = new Error(`HTTP ${response.status}`);
                        continue;
                    }

                    // If we get here, the request was successful
                    lastError = null;
                    const result = await response.json();
                    
                    if (result?.webPages?.value) {
                        result.webPages.value.forEach(page => {
                            try {
                                const url = new URL(page.url);
                                if (url.protocol === 'https:' || url.protocol === 'http:') {
                                    urls.add(page.url);
                                }
                            } catch {
                                // Invalid URL, skip
                            }
                        });
                    }

                    // If we found URLs, break out of the retry loop
                    if (urls.size > 0) {
                        break;
                    }

                    // Add delay before next search parameter set
                    await delay(RATE_LIMIT_DELAY);
                    break; // Break retry loop on success

                } catch (error) {
                    console.log(`Search attempt failed with params ${JSON.stringify(params)}:`, error);
                    lastError = error;
                    // Continue to next retry
                }
            }

            // If we found URLs, break out of the params loop
            if (urls.size > 0) {
                break;
            }

            // If all retries failed, continue to next params set
            if (lastError) {
                console.log(`All retries failed for params ${JSON.stringify(params)}, trying next parameter set...`);
                continue;
            }
        }
        
        return Array.from(urls);

    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

function extractMainContent(document) {
    const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '[class*="article"]',
        '[class*="post"]',
        '[class*="content"]'
    ];

    for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent.trim();
            if (text.length > 100) {
                return text;
            }
        }
    }
    return null;
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

        // Enhanced content extraction
        const mainContent = {
            title: dom.window.document.title,
            article: extractMainContent(dom.window.document),
            headings: Array.from(dom.window.document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(Boolean)
                .slice(0, 15),
            paragraphs: Array.from(dom.window.document.querySelectorAll('article p, main p, .content p, [class*="article"] p, [class*="post"] p'))
                .map(p => p.textContent.trim())
                .filter(Boolean)
                .filter(text => text.length > 40)
                .slice(0, 30)
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

async function analyzeContent(task, sitesData) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const combinedContent = sitesData.map(site => {
        const content = JSON.parse(site.content);
        return `URL: ${site.url}
${content.title}
${content.headings?.join('\n') || ''}
${content.paragraphs?.join('\n') || ''}`;
    }).join('\n\n').slice(0, 15000);

    const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
            {
                role: "system",
                content: `You are a precise information analyzer. Your task is to:
1. Analyze the provided content and extract information specifically relevant to the user's query
2. Ensure all information is directly related to the query - discard irrelevant information
3. Present findings in clear, concise bullet points
4. Include specific details like names, dates, and quotes when available
5. Do not include source citations or URLs in the output
6. If information seems unrelated to the query, exclude it entirely

Format your response as a series of clear bullet points. Each point should be self-contained and directly related to the query.`
            },
            {
                role: "user",
                content: `Query: ${task}\n\nContent to analyze:\n${combinedContent}`
            }
        ],
        max_tokens: 1000
    });

    return completion.choices[0].message.content;
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { task } = req.body;

    if (!task) {
        return res.status(400).json({ error: 'Task is required' });
    }

    try {
        // Validate API keys
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        if (!process.env.BING_API_KEY) {
            throw new Error('Search API key is not configured');
        }

        if (!process.env.APIFLASH_KEY) {
            throw new Error('APIFlash key is not configured');
        }

        console.log('Finding relevant sources for task:', task);
        const relevantUrls = await findRelevantSources(task);
        console.log('Found relevant URLs:', relevantUrls);

        const analysisPromises = relevantUrls.map(url => analyzeSite(url, task));
        let sitesData = (await Promise.all(analysisPromises)).filter(Boolean);

        if (sitesData.length === 0) {
            console.log('No sites analyzed successfully, retrying with modified query...');
            // Try again with a more generalized search
            const generalQuery = task.split(' ').slice(0, 2).join(' ') + ' latest news';
            const fallbackUrls = await findRelevantSources(generalQuery);
            const fallbackAnalysis = await Promise.all(fallbackUrls.map(url => analyzeSite(url, task)));
            sitesData = fallbackAnalysis.filter(Boolean);
            
            if (sitesData.length === 0) {
                throw new Error('Unable to find any relevant information. Please try rephrasing your query.');
            }
        }

        const analysis = await analyzeContent(task, sitesData);

        const allScreenshots = sitesData.flatMap(site => 
            site.screenshots.map(shot => ({
                ...shot,
                source: site.url
            }))
        );

        return res.status(200).json({
            success: true,
            data: {
                analysis,
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
}

module.exports = handler;
