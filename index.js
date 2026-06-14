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

const logger = (req, res, next) => {
    console.log("logger", req.params);
    next();

}


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
        const usersCollection = database.collection("user");
        const applicationsCollection = database.collection('application')
        const planCollection = database.collection('plans')
        const subscriptionCollection = database.collection('subscriptions');
        const sessionCollection = database.collection('session');

        // verification token
        const verifyToken = async (req, res, next) => {
            console.log('headers', req.headers);
            const authHeader = req.headers?.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'unauthorize access' })
            }

            const token = authHeader.split(' ')[1]
            if (!token) {
                return res.status(401).send({ message: 'unauthorize access' })
            }
            const query = { token: token }
            const session = await sessionCollection.findOne(query)
            const userId = session.userId;

            const userQuery = {
                _id: userId
            }
            const user = await usersCollection.findOne(userQuery)
            // console.log(user);
            req.user = user;
            next()

        }


        // seeker verification
        const verifySeeker = async (req, res, next) => {
            if (req.user?.role !== 'seeker') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }
        // recruiter verification
        const verifyRecruiter = async (req, res, next) => {
            if (req.user.role !== 'recruiter') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        // must verify admin
        const verifyAdmin = async (req, res, next) => {
            if (req.user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

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

        app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
            const query = {};
            if (req, query.applicantId) {
                query.application = req.query.applicantId;

                console.log(req.user, req.query.applicantId);
                if (req.user._id.toString() !== req.query.applicantId) {
                    return res.status(403).send({ message: 'forbidden access' })
                }

            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }
            const cursor = await applicationsCollection.find(query)
            const result = await cursor.toArray();
            res.send(result)
        })

        app.post("/api/applications", async (req, res) => {
            const application = req.body;
            const newApplication = {
                ...application,
                createdAt: new Date()
            }
            const result = await applicationsCollection.insertOne(newApplication)
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



        // app.get("/api/companies", async (req, res) => {
        //     const cursor = companyCollection.find();
        //     const result = await cursor.toArray();
        //     res.send(result);
        // })

        // inefficient to join collection
        app.get("/api/companies", verifyToken, async (req, res) => {
            const cursor = companyCollection.find();
            const companies = await cursor.toArray();

            for (const company of companies) {
                const filter = {
                    companyId: company._id.toString()
                }
                const jobCount = await jobsCollection.countDocuments(filter)
                company.jobCount = jobCount
            }

            res.send(companies);
        })


        app.get("/api/companies", async (req, res) => {
            const pipeline = [
                { $skip: 5 }
            ];
            const cursor = await companyCollection.aggregate(pipeline);
            const result = await cursor.toArray()
            return result;
        })


        app.get('/api/stats', async (req, res) => {
            const pipeline = [
                {
                    $group: {
                        _id: "$jobType",
                        count: {
                            $sum: 1
                        }
                        // rating: { $first: "$rated" },
                        // totalRuntime: { $sum: "$runtime" }
                    }
                },
                {
                    $project: {
                        jobType: '$_id',
                        _id: 0,
                        count: 1
                    }
                },
                {
                    $sort: { count: 1 }
                }
            ];

            const cursor = jobsCollection.aggregate(pipeline);
            const result = await cursor.toArray();
            res.send(result)
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
            res.send(cursor || {});

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



        app.patch('/api/companies/:id', logger, verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedCompany = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: updatedCompany.status
                }
            }
            const result = await companyCollection.updateOne(filter, updateDoc)
            res.send(result)
        })


        app.get('/api/plans', async (req, res) => {
            const query = {}
            if (req.query.plan_id) {
                query.id = req.query.plan_id
            }
            const plan = await planCollection.findOne(query);
            res.send(plan)
        })


        // subscription 
        app.post('/api/subscriptions', async (req, res) => {
            const data = req.body;
            const subsInfo = {
                ...data,
                createdAt: new Date()
            }

            const result = await subscriptionCollection.insertOne(subsInfo);

            // update the user plan information
            const filter = { email: data.email };
            // update the value of the 'quantity' field to 5
            const updateDocument = {
                $set: {
                    plan: data.planId,
                },
            };

            const updateResult = await usersCollection.updateOne(filter, updateDocument);
            res.send(updateResult)
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