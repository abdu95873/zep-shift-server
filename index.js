import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import Stripe from "stripe";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.PAYMENT_GATEWAY_KEY);


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
let paymentsCollection;
let serviceCenterCollection;

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB!");

        const db = client.db("parcelDB");
        parcelCollection = db.collection("parcels");
        paymentsCollection = db.collection("payments");
        serviceCenterCollection = db.collection("service-centers");

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


//service center api

app.get('/service-centers', async (req, res) => {
    try {
        const serviceCenters = await serviceCenterCollection.find({}).toArray();
        res.status(200).json(serviceCenters);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch service centers' });
    }
});



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

// Get a parcel by id

app.get("/parcels/:id", async (req, res) => {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid parcel ID",
        });
    }

    try {
        const parcel = await parcelCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!parcel) {
            return res.status(404).json({
                success: false,
                message: "Parcel not found",
            });
        }

        res.send(parcel);

        // res.status(200).json({
        //     success: true,
        //     data: parcel,
        // });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Server error",
        });
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



// Payment Intent API


app.post("/payments", async (req, res) => {
    try {

        // if (!paymentCollection) {
        //     return res.status(500).json({ message: "Payment collection not initialized" });
        // }

        const { parcelId, email, amount, paymentMethod, transactionId } = req.body;

        // if (!parcelId || !transactionId) {
        //     return res.status(400).json({ message: "parcelId and transactionId are required" });
        // }

        // Update parcel payment status
        const updateResult = await parcelCollection.updateOne(
            { _id: new ObjectId(parcelId) },
            {
                $set: {
                    payment_status: "paid",
                }
            }
        );

        if (updateResult.matchedCount === 0) {
            return res.status(404).json({ message: "Parcel not found" });
        }

        app.get("/tracking", async (req, res) => {
            const { tracking_id, parcel_id, status, message, updated_by = '' } = req.body;
            const log = {
                tracking_id,
                parcel_id,
                status,
                message,
                updated_by,
                timestamp: new Date()
            };

        })





        // Insert payment record
        const paymentDoc = {
            parcelId,
            email,
            amount,
            paymentMethod,
            transactionId,
            paid_at_string: new Date().toISOString(),
            paid_at: new Date()
        };

        const paymentResult = await paymentsCollection.insertOne(paymentDoc);

        // Send response
        res.status(201).json({
            success: true,
            message: "Payment recorded and parcel updated",
            paymentId: paymentResult.insertedId,
            parcelModifiedCount: updateResult.modifiedCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


app.get("/payments", async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ message: "Email query parameter is required" });
        }

        // Find payments by email and sort latest first
        const payments = await paymentsCollection
            .find({ email })
            .sort({ paid_at: -1 }) // latest payment first
            .toArray();

        res.send(payments)

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});






app.post("/create-payment-intent", async (req, res) => {
    try {
        const { amount } = req.body; // amount in USD

        // Stripe expects amount in cents
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // e.g. $120 => 12000
            currency: "usd",
            payment_method_types: ["card"],
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Payment intent creation failed" });
    }
});



// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
