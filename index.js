const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.port || 5000;


//! Middleware:
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://second-chance-8f474.web.app', 'https://second-chance-8f474.firebaseapp.com'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());


//! Middlewares:
const verifyToken = (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).send({ message: "access forbidden!" });
    }
    const token = req.headers.authorization.split(" ")[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).send({ message: "forbidden access" });
      }

      req.decoded = decoded;
      next();
    });
};

const verifyAdmin = async (req, res, next) => {
const email = req.decoded?.email;
const query = { email: email };
const user = await userCollection.findOne(query);
const isAdmin = user?.role === "admin";

if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
}
next();
};


//! MongoDB:
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zzvfjhd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


async function run() {
    try {
        // await client.connect();

        //! collections:
        const userCollection = client.db("secondChance").collection("users");
        const petCollection = client.db("secondChance").collection("pets");
        const adoptReqCollection = client.db("secondChance").collection("adoptRequest");
        const donationCollection = client.db("secondChance").collection("donations");
        const donationCampaignsCollection = client.db("secondChance").collection("donationCampaigns");


        ///! JWT related api: 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7h' });
            res.send({ token });
        })

      
        ///! isAdmin check: 
        app.get("/user/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "unauthorized access" });
            }
        
            const query = { email: email };
            const user = await userCollection.findOne(query);
        
            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }
            
            res.send({ admin });
        });
        ///! Make admin api: 
        app.patch("/make-admin/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const makeAdmin = {
                $set: {
                    role: "admin",
                },
            };
            const result = await userCollection.updateOne(filter, makeAdmin);
            res.send(result);
        });



        ///! User related api: 
        app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };

            //! check the user exist or not!
            const existingUser = await userCollection.findOne(query);
            if(existingUser) {
                return res.send({ message: 'user already exists!' });
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });


        ///! Pets related api: 
        //! get all pets data:
        app.get("/pets", async (req, res) => {
            const query = { adopted: false };
            const result = await petCollection.find(query).toArray();
            res.send(result);
        });

        //! get single pet data:
        app.get("/pets/:id", async (req, res) => {
            const id = req.params.id;
            const result = await petCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        //! get all pets by admin:
        app.get("/petsByAdmin", verifyToken, verifyAdmin, async (req, res) => {
            const result = await petCollection.find().toArray();
            res.send(result);
        });

        //! add user pets:
        app.post("/pets", async (req, res) => {
            const {
            name,
            age,
            userEmail,
            category,
            location,
            shortDescription,
            longDescription,
            image,
            } = req.body;
    
            const newPet = {
            name,
            age,
            userEmail,
            category,
            location,
            shortDescription,
            longDescription,
            adopted: false,
            image,
            createdAt: new Date(),
            };
    
            const result = await petCollection.insertOne(newPet);
            res.send(result);
        });

        //! update user pet:
        app.put("/pets/:id", async (req, res) => {
            const id = req.params.id;
            const {
              name,
              age,
              image,
              category,
              location,
              shortDescription,
              longDescription,
            } = req.body;
      
            const filter = { _id: new ObjectId(id) };
            const updatedDocs = {
              $set: {
                name,
                age,
                image,
                category,
                location,
                shortDescription,
                longDescription,
              },
            };
      
            const result = await petCollection.updateOne(filter, updatedDocs);
            res.send(result);
        });

        //! delete user added pet:
        app.delete("/pets/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await petCollection.deleteOne(query);
            res.send(result);
        });

        //! get pets data by user email (my added pets):
        app.get("/my-added-pets/:email", async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email };
            const result = await petCollection.find(query).toArray();
            res.send(result);
        });


        ///! Adopt related api: 
        //! get all adopt request:
        app.get("/adopt-request", verifyToken, async (req, res) => {
            const result = await adoptReqCollection.find().toArray();
            res.send(result);
        });

        //! post adopt request:
        app.post("/adopt-request", async (req, res) => {
            const petAdopt = req.body;
    
    
            //? checking is exist!
            const query = { adoptId: petAdopt.adoptId };
            const isExist = await adoptReqCollection.findOne(query);
    
            if (isExist) {
            return res.send({ isExist: true });
            }
    
            const result = await adoptReqCollection.insertOne(petAdopt);
            res.send(result);
        });

        //! accept adopt request:
        app.put(`/accept-adopt-req/:id`, verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
      
            const updatedDocs = {
              $set: {
                accept: true,
              },
            };
            const result = await adoptReqCollection.updateOne(filter, updatedDocs);
            res.send(result);
        });
      
        //! delete adopt request:
        app.delete("/adopt-request/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await adoptReqCollection.deleteOne(filter);
            res.send(result);
        });


        




    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('server i running')
});

app.listen(port, () => {
    console.log(`server is running on port : ${port}`);
})