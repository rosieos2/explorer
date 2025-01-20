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

        // Extract useful content
        const pageContent = {
            title: document.title,
            headings: Array.from(document.querySelectorAll('h1, h2, h3'))
                .map(h => h.textContent.trim())
                .filter(Boolean),
            mainContent: Array.from(document.querySelectorAll('article, main, .content, p'))
                .map(el => el.textContent.trim())
                .filter(Boolean)
                .join('\n')
                .slice(0, 3000), // Limit content length
            links: Array.from(document.querySelectorAll('a'))
                .map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                }))
                .filter(link => link.text && link.href)
                .slice(0, 20) // Limit number of links
        };

        // Initialize OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Create a prompt based on the task
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: "You are a web analysis expert. Analyze the provided webpage content and complete the user's specific task. Be detailed but concise."
                },
                { 
                    role: "user", 
                    content: `
                    Page Title: ${pageContent.title}
                    
                    Task: ${task}

                    Main Content:
                    ${pageContent.mainContent}

                    Key Headings:
                    ${pageContent.headings.join('\n')}

                    Important Links:
                    ${pageContent.links.map(l => `${l.text}: ${l.href}`).join('\n')}
                    
                    Please analyze this content and complete the requested task.`
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
                    url: url
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
