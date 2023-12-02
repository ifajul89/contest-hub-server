// Imports
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
require("dotenv").config();

// Middlewares
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6cq5lj6.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        // Collections
        const usersCollection = client.db("contestHubDB").collection("users");
        const contestsCollection = client
            .db("contestHubDB")
            .collection("contests");

        // Contests Related Api
        app.get("/top-contests", async (req, res) => {
            const topContest = contestsCollection
                .find()
                .sort({ participantsCount: -1 });
            const result = (await topContest.toArray()).slice(0, 5);
            res.send(result);
        });

        app.get("/top-winner", async (req, res) => {
            const topContest = contestsCollection
                .find()
                .sort({ participantsCount: -1 });
            const result = (await topContest.toArray()).slice(0, 3);
            res.send(result);
        });

        // Users Related API
        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({
                    message: "User Already Exist",
                    insertedId: null,
                });
            }
            const result = await usersCollection.insertOne(newUser);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Server is Running");
});

app.listen(port, () => {
    console.log(`Server Is Running On Port ${port}`);
});
