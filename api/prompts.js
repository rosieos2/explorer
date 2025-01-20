import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    
    const client = await MongoClient.connect(process.env.MONGODB_URI, {
        serverApi: {
            version: '1',
            strict: true,
            deprecationErrors: true
        }
    });
        
    const db = client.db("webagent");
    cachedDb = db;
    return db;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection("prompts");

        if (req.method === 'POST') {
            const { prompt } = req.body;
            await collection.insertOne({
                prompt,
                timestamp: new Date(),
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
            });
            res.status(200).json({ success: true });
        } 
        else if (req.method === 'GET') {
            const prompts = await collection.find({})
                .sort({ timestamp: -1 })
                .limit(20)
                .toArray();
            res.status(200).json({ prompts }); // Wrap in an object
        }
        else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Request handling error:', error);
        res.status(500).json({ error: 'Database error', message: error.message, prompts: [] }); // Include empty prompts array
    }
}
