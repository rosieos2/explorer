const fetch = require('node-fetch');
const { OpenAI } = require('openai');
const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;
    console.log('Processing:', { url, task });

    try {
        // Fetch webpage with proper headers
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });

        const html = await response.text();
        
        // Try to fetch any API endpoints found in the HTML
        const apiEndpoints = html.match(/https?:\/\/[^"']+api[^"']*/g) || [];
        let additionalContent = '';
        
        // Try to fetch from API endpoints if found
        for (const endpoint of apiEndpoints.slice(0, 3)) { // Limit to first 3 endpoints
            try {
                const apiResponse = await fetch(endpoint, {
                    headers: { 'Accept': 'application/json' }
                });
                const json = await apiResponse.json();
                additionalContent += JSON.stringify(json);
            } catch (e) {
                console.log('API fetch failed:', e.message);
            }
        }

        const dom = new JSDOM(html);
        const document = dom.window.document;

        function extractContent() {
            const content = {
                mainContent: '',
                articles: [],
                links: new Set(),
                relevantText: []
            };

            // Extract visible text content
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            while (walker.nextNode()) {
                const node = walker.currentNode;
                const text = node.textContent.trim();
                if (text && node.parentElement.offsetParent !== null) {
                    content.relevantText.push(text);
                }
            }

            // Get all links with their text
            document.querySelectorAll('a').forEach(link => {
                const text = link.textContent.trim();
                const href = link.href;
                if (text && href) {
                    content.links.add(`${text} (${href})`);
                }
            });

            // Get main content areas
            ['article', 'main', '[role="main"]', '.content', '.main'].forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    content.mainContent += el.textContent.trim() + '\\n';
                });
            });

            // Get individual articles or content blocks
            document.querySelectorAll('article, .article, .post, .content-block').forEach(article => {
                const title = article.querySelector('h1, h2, h3')?.textContent.trim() || '';
                const text = article.textContent.trim();
                if (text) {
                    content.articles.push({ title, text });
                }
            });

            return content;
        }

        const content = extractContent();

        // Combine all content
        const combinedContent = `
            Main Content:
            ${content.mainContent}

            Articles:
            ${content.articles.map(a => `${a.title}\n${a.text}`).join('\n\n')}

            Additional Content:
            ${content.relevantText.join('\n')}

            Links:
            ${Array.from(content.links).join('\n')}

            API Content:
            ${additionalContent}
        `;

        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: "You are a web content analyzer. Extract and analyze ALL relevant information from the provided content. Be thorough and specific."
                },
                { 
                    role: "user", 
                    content: `Task: ${task}\n\nContent:\n${combinedContent.slice(0, 4000)}`
                }
            ],
            max_tokens: 1000
        });

        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                metadata: {
                    articlesFound: content.articles.length,
                    contentLength: combinedContent.length,
                    linksFound: content.links.size
                }
            }
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
