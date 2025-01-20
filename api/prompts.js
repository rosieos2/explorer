// api/prompts.js
import { MongoClient } from 'mongodb';

let cachedDb = null;

async function connectToDatabase() {
    if (cachedDb) {
        return cachedDb;
    }
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db("webagent");
    cachedDb = db;
    return db;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const db = await connectToDatabase();
    const collection = db.collection("prompts");

    if (req.method === 'POST') {
        try {
            const { prompt } = req.body;
            await collection.insertOne({
                prompt,
                timestamp: new Date(),
                ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
            });
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Error saving prompt' });
        }
    } 
    else if (req.method === 'GET') {
        try {
            const prompts = await collection.find({})
                .sort({ timestamp: -1 })
                .limit(20)
                .toArray();
            res.status(200).json(prompts);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching prompts' });
        }
    }
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}