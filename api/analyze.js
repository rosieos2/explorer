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
       
       // Log the response status
       console.log(`APIFlash response status: ${screenshotResponse.status}`);
       
       if (!screenshotResponse.ok) {
           const errorText = await screenshotResponse.text();
           console.log('APIFlash error:', errorText);
           throw new Error(`APIFlash request failed: ${screenshotResponse.status} - ${errorText}`);
       }

       const data = await screenshotResponse.json();
       console.log('APIFlash response:', data);  // Log the response data

       if (!data.url) {
           throw new Error('No screenshot URL in APIFlash response');
       }

       const imageResponse = await fetch(data.url, {
           timeout: FETCH_TIMEOUT
       });

       if (!imageResponse.ok) {
           throw new Error(`Failed to fetch screenshot image: ${imageResponse.status}`);
       }

       const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
       console.log('Screenshot captured successfully');
       return [{
           label: url,
           image: imageBuffer.toString('base64')
       }];
   } catch (error) {
       console.log('Screenshot failed for URL:', url);
       console.log('Error details:', error);
       // Log the full error stack trace
       console.log('Error stack:', error.stack);
   }
   return [];
}

async function findRelevantSources(query) {
   try {
       const urls = new Set();
       
       // Simple search with retry
       for (let retryCount = 0; retryCount <= RETRY_DELAYS.length; retryCount++) {
           try {
               if (retryCount > 0) {
                   console.log(`Retry attempt ${retryCount}`);
                   await delay(RETRY_DELAYS[retryCount - 1]);
               }

               const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&count=50`, {
                   headers: {
                       'Ocp-Apim-Subscription-Key': SEARCH_API_KEY
                   }
               });

               if (response.status === 429) {
                   console.log('Rate limit hit, will retry...');
                   continue;
               }

               if (!response.ok) {
                   throw new Error(`Search failed: ${response.status}`);
               }

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

               if (urls.size > 0) {
                   return Array.from(urls);
               }
           } catch (error) {
               console.log(`Search attempt ${retryCount} failed:`, error);
               if (retryCount === RETRY_DELAYS.length) {
                   throw error;
               }
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

async function analyzeSite(url, task, takeScreenshot = false) {
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

        // Only take screenshot if explicitly requested
        const screenshots = takeScreenshot ? await getScreenshots(url) : [];

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

       const analysisPromises = relevantUrls.map((url, index) => {
        const takeScreenshot = index < 2;  // Only true for first 2 URLs
        return analyzeSite(url, task, takeScreenshot);
    });
       let sitesData = (await Promise.all(analysisPromises)).filter(Boolean);

       if (sitesData.length === 0) {
           console.log('Initial search returned no results, retrying after delay...');
           await delay(2000); // Wait 2 seconds before retry
           const relevantUrls = await findRelevantSources(task);
           const fallbackAnalysis = await Promise.all(relevantUrls.map((url, index) => {
            const takeScreenshot = index < 2;  // Maintain the 2-screenshot limit in retry
            return analyzeSite(url, task, takeScreenshot);
        }));
           sitesData = fallbackAnalysis.filter(Boolean);
           
           if (sitesData.length === 0) {
               throw new Error('No results found. Please try again in a moment.');
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
