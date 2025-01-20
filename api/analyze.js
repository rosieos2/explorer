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
        // Fetch webpage
        const response = await fetch(url);
        const html = await response.text();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Extract page content
        function extractContent() {
            // Get main content areas
            const mainContent = {
                title: document.title,
                meta: {
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    keywords: document.querySelector('meta[name="keywords"]')?.content || ''
                },
                headings: [],
                articles: [],
                paragraphs: [],
                lists: [],
            };

            // Get all headings
            ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
                const headings = document.querySelectorAll(tag);
                headings.forEach(h => {
                    mainContent.headings.push({
                        level: tag,
                        text: h.textContent.trim()
                    });
                });
            });

            // Get article content
            document.querySelectorAll('article, [role="article"], .article, .post, .content').forEach(article => {
                const content = article.textContent.trim();
                if (content) {
                    mainContent.articles.push(content);
                }
            });

            // Get paragraph content
            document.querySelectorAll('p').forEach(p => {
                const content = p.textContent.trim();
                if (content) {
                    mainContent.paragraphs.push(content);
                }
            });

            // Get list content
            document.querySelectorAll('ul, ol').forEach(list => {
                const items = Array.from(list.querySelectorAll('li'))
                    .map(li => li.textContent.trim())
                    .filter(Boolean);
                if (items.length) {
                    mainContent.lists.push(items);
                }
            });

            return mainContent;
        }

        const pageContent = extractContent();

        // Format content for GPT
        const formattedContent = `
Page Title: ${pageContent.title}

Meta Description: ${pageContent.meta.description}

Main Headings:
${pageContent.headings.map(h => `${h.level}: ${h.text}`).join('\n')}

Main Content:
${pageContent.articles.slice(0, 5).join('\n\n')}

Additional Content:
${pageContent.paragraphs.slice(0, 10).join('\n')}

Key Lists:
${pageContent.lists.map(list => list.join('\n- ')).join('\n\n')}`;

        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: "You are a web content analysis expert. Analyze the provided content and complete the user's specific task. Be thorough but concise."
                },
                { 
                    role: "user", 
                    content: `Task: ${task}\n\nWebpage Content:\n${formattedContent.slice(0, 3000)}`
                }
            ],
            max_tokens: 1000
        });

        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                metadata: {
                    title: pageContent.title,
                    url: url,
                    contentStats: {
                        headings: pageContent.headings.length,
                        articles: pageContent.articles.length,
                        paragraphs: pageContent.paragraphs.length
                    }
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
