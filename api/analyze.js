const fetch = require('node-fetch');
const { OpenAI } = require('openai');

module.exports = async (req, res) => {
    console.log('Starting request handler');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, task } = req.body;
    console.log('Received request:', { url, task });

    try {
        // Fetch the webpage content
        console.log('Fetching webpage content');
        const response = await fetch(url);
        const html = await response.text();

        // Initialize OpenAI
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
                    content: "You are a web analysis expert specializing in extracting and summarizing sports news. Focus on providing clear, concise summaries of the most relevant information."
                },
                { 
                    role: "user", 
                    content: `Analyze this webpage content and provide relevant information for the task: ${task}\n\nContent: ${html}`
                }
            ]
        });

        console.log('Sending response');
        return res.status(200).json({
            success: true,
            data: {
                analysis: completion.choices[0].message.content
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
