const { OpenAI } = require('openai');

module.exports = async (req, res) => {
    console.log('Starting request handler');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;
    console.log('Received request:', { url, task });

    try {
        console.log('Initializing OpenAI');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        console.log('Making OpenAI request');
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: "You are a web analysis expert. The user will provide a URL and task. Explain that you cannot directly access the URL but you can help with the task based on general knowledge."
                },
                { 
                    role: "user", 
                    content: `The user wants to analyze this URL: ${url}\nTask: ${task}`
                }
            ]
        });

        console.log('Sending response');
        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content,
                screenshot: null
            }
        });

    } catch (error) {
        console.error('Full error:', error);
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
};
