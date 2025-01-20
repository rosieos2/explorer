import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    
    try {
        const client = await MongoClient.connect(process.env.MONGODB_URI, {
            ssl: true,
            tls: true,
            retryWrites: true
        });
        
        const db = client.db("webagent");
        cachedDb = db;
        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

export default async function handler(req, res) {
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
            res.status(200).json(prompts);
        }
        else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Request handling error:', error);
        res.status(500).json({ error: 'Database error', message: error.message });
    }
}
