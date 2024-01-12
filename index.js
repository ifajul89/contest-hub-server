// Imports
require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Middlewares
app.use(
    cors({
        origin: ["http://localhost:5173"],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).send({ message: "unauthorize access" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorize access" });
        }
        req.user = decoded;
        next();
    });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
        // await client.connect();

        // Collections
        const usersCollection = client.db("contestHubDB").collection("users");
        const contestsCollection = client
            .db("contestHubDB")
            .collection("contests");
        const registeredContestsCollection = client
            .db("contestHubDB")
            .collection("registeredContests");

        // JWT Related
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
                expiresIn: "6h",
            });
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
            }).send({ success: true });
        });

        app.post("/logout", async (req, res) => {
            const user = req.body;
            res.clearCookie("access token", { maxAge: 0 }).send({
                success: true,
            });
        });

        // Contests Related Api
        app.get("/contests", async (req, res) => {
            const search = req.query.search;
            if (search === "All") {
                const result = await contestsCollection.find().toArray();
                return res.send(result);
            }
            const query = {
                contestCategory: { $regex: new RegExp(search, "i") },
            };
            const result = await contestsCollection.find(query).toArray();
            return res.send(result);
        });

        app.post("/contests", async (req, res) => {
            const newContest = req.body;
            const result = await contestsCollection.insertOne(newContest);
            res.send(result);
        });

        app.delete("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestsCollection.deleteOne(query);
            res.send(result);
        });

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

        app.get("/my-created-contests", verifyToken, async (req, res) => {
            const creator = req.query.creator;
            if (creator !== req.user.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const query = { creatorEmail: creator };
            const result = await contestsCollection.find(query).toArray();
            res.send(result);
        });

        app.patch("/my-created-contests/:id", async (req, res) => {
            const newContest = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedNewContest = {
                $set: {
                    winnerName: newContest.winnerName,
                    winnerEmail: newContest.winnerEmail,
                    winnerImage: newContest.winnerImage,
                },
            };
            const result = await contestsCollection.updateOne(
                filter,
                updatedNewContest
            );
            res.send(result);
        });

        app.patch("/contests/:id", async (req, res) => {
            const newContest = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedNewContest = {
                $set: {
                    participantsCount: newContest.participantsCount,
                },
            };
            const result = await contestsCollection.updateOne(
                filter,
                updatedNewContest
            );
            res.send(result);
        });

        app.patch("/admin-contests/:id", async (req, res) => {
            const newContest = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedNewContest = {
                $set: {
                    contestStatus: newContest.contestStatus,
                },
            };
            const result = await contestsCollection.updateOne(
                filter,
                updatedNewContest
            );
            res.send(result);
        });

        app.get("/contests/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await contestsCollection.findOne(query);
            res.send(result);
        });

        app.get("/submission/:id", async (req, res) => {
            const id = req.params.id;
            const query = { contestId: id };
            const result = await registeredContestsCollection
                .find(query)
                .toArray();
            res.send(result);
        });

        // Leaderboard
        app.get("/leaderboard", async (req, res) => {
            res.send(await usersCollection.find().toArray());
        });

        // Users Related API
        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const query = { userEmail: newUser.userEmail };
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

        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const user = await usersCollection.findOne(query);
            if (user?.role === "admin") {
                return res.send({ role: "admin" });
            } else if (user?.role === "creator") {
                return res.send({ role: "creator" });
            } else {
                return res.send({ role: "user" });
            }
        });

        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        });

        app.patch("/users/:id", async (req, res) => {
            const updatedUser = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedNewUser = {
                $set: {
                    role: updatedUser.role,
                },
            };
            const result = await usersCollection.updateOne(
                filter,
                updatedNewUser
            );
            res.send(result);
        });

        app.get("/users", async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        // Payments Intent
        app.post("/create-payment-intent", async (req, res) => {
            const { fee } = req.body;
            const amount = parseInt(fee * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        // Getting Payment
        app.post("/registered-contests", async (req, res) => {
            const newRegistration = req.body;
            const result = await registeredContestsCollection.insertOne(
                newRegistration
            );
            res.send(result);
        });

        app.get("/registered-contests/:email", async (req, res) => {
            const email = req.params.email;
            const data = req.query.data;

            if (data === "sorted") {
                const sortedQuery = {
                    registerEmail: email,
                    contestDeadline: { $gte: currentDate.toISOString() },
                };
                const options = {
                    sort: { contestDeadline: 1 },
                };
                const registeredContests = await registeredContestsCollection
                    .find(sortedQuery, options)
                    .toArray();

                res.send(registeredContests);
            } else {
                const query = {
                    registerEmail: email,
                };
                const registeredContests = await registeredContestsCollection
                    .find(query)
                    .toArray();

                res.send(registeredContests);
            }
        });

        app.get("/my-winning-contests/:email", async (req, res) => {
            const email = req.params.email;
            const filter = { winnerEmail: email };
            const result = await contestsCollection.find(filter).toArray();
            res.send(result);
        });

        // await client.db("admin").command({ ping: 1 });
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
