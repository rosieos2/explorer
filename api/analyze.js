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
        // Fetch webpage with browser-like headers
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Extract content more reliably
        function extractContent() {
            const content = {
                title: document.title,
                headings: [],
                paragraphs: [],
                links: []
            };

            // Extract headings
            document.querySelectorAll('h1, h2, h3, h4').forEach(heading => {
                const text = heading.textContent.trim();
                if (text) {
                    content.headings.push(text);
                }
            });

            // Extract paragraphs and article content
            document.querySelectorAll('p, article, .article, .content').forEach(element => {
                const text = element.textContent.trim();
                if (text && text.length > 20) { // Avoid tiny snippets
                    content.paragraphs.push(text);
                }
            });

            // Extract links with context
            document.querySelectorAll('a').forEach(link => {
                const text = link.textContent.trim();
                const href = link.href;
                const parentText = link.parentElement?.textContent.trim();
                if (text && href && parentText && parentText.length > text.length) {
                    content.links.push({
                        text: text,
                        context: parentText
                    });
                }
            });

            return content;
        }

        const content = extractContent();

        // Format content for GPT, ensuring we don't exceed token limits
        const formattedContent = `
Page Title: ${content.title}

Key Headlines:
${content.headings.slice(0, 10).join('\n')}

Main Content:
${content.paragraphs.slice(0, 15).map(p => `• ${p}`).join('\n\n')}

Relevant Links and Context:
${content.links.slice(0, 10).map(link => `• ${link.text}: ${link.context}`).join('\n')}`;

        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: "You are a web content analyzer. Extract and analyze ALL relevant information from the provided content. Focus specifically on the user's task. Be thorough but concise."
                },
                { 
                    role: "user", 
                    content: `Task: ${task}\n\nWebpage Content:\n${formattedContent}`
                }
            ],
            max_tokens: 1000
        });

        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                metadata: {
                    headingsCount: content.headings.length,
                    paragraphsCount: content.paragraphs.length,
                    linksCount: content.links.length
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
