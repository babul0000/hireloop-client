const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT;

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db('HireLoop');
        const jobsCollection = database.collection('jobs')
        const companyCollection = database.collection('companies')

        app.get("/jobs", async (req, res) => {
            const query = {};
            if (req.query.companyId) {
                query.companyId = await req.query.companyId;
            }
            if (req.query.status) {
                query.status = await req.query.status;
            }
            console.log(query, "query");

            const cursor = await jobsCollection.find(query)
            const result = await cursor.toArray();
            console.log(result);

            res.send(result)
        })

        app.post("/jobs", async (req, res) => {
            const job = req.body;
            const newJobs = {
                ...job,
                createdAt: new Date()
            }
            const result = await jobsCollection.insertOne(newJobs)
            res.send(result)
        })

        app.get('/api/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = {

                _id: new ObjectId(id)
            }
            const result = await jobsCollection.findOne(query);
            res.send(result)
        })



        app.get("/api/companies", async (req, res) => {
            const cursor = companyCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get("/api/my/companies", async (req, res) => {
            const query = {};
            console.log(req.query.recruiterId);

            if (req.query.recruiterId) {
                query.recruiterId = await req.query.recruiterId;
            }
            const cursor = await companyCollection.findOne(query);
            console.log(cursor);

            // const result = await cursor.toArray();
            res.send(cursor);

        })


        app.post("/api/companies", async (req, res) => {
            const company = req.body;
            const newCompany = {
                ...company,
                createdAt: new Date()
            }
            const result = await companyCollection.insertOne(newCompany)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})