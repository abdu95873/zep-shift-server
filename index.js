import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mh16alw.mongodb.net/?retryWrites=true&w=majority`;

// MongoClient
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// Keep a reference to the collection
let parcelCollection;

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const db = client.db("parcelDB");
        parcelCollection = db.collection("parcels");

    } catch (err) {
        console.error(err);
    }
}

// Call run but do NOT close the connection
run().catch(console.dir);

// Routes
app.get("/", (req, res) => {
    res.send("Parcel server is running!");
});




// parcels API


// app.get("/parcels", async (req, res) => {
//     try {
//         const parcels = await parcelCollection.find({}).toArray();
//         res.json(parcels);
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });


// Create a parcel
app.post("/parcels", async (req, res) => {
    try {
        const newParcel = req.body;
        const result = await parcelCollection.insertOne(newParcel);
        res.status(201).json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a parcel
app.get("/parcels", async (req, res) => {
    try {
        const { email } = req.query;

        const query = email ? { creatorEmail: email } : {};

        const parcels = await parcelCollection
            .find(query)
            .sort({ createdAt: -1 }) // latest first
            .toArray();

        res.json(parcels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// DELETE /parcels/:id
app.delete('/parcels/:id', async (req, res) => {
    const { id } = req.params;
    console.log(id)

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid parcel ID' });
    }

    try {
        const result = await parcelCollection.deleteOne({ _id: new ObjectId(id) });
        console.log(result)

        if (result.deletedCount > 0) {
            return res.status(200).json({ deletedCount: result.deletedCount });
        } else {
            return res.status(404).json({ message: 'Parcel not found', deletedCount: 0 });
        }
    } catch (error) {
        console.error('Error deleting parcel:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});




// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
