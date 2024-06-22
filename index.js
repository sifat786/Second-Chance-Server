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

//! collections:
let userCollection;
let petCollection;
let adoptReqCollection;
let donationCollection;
let donationCampaignsCollection;

async function run() {
    try {
        // await client.connect();

        userCollection = client.db("secondChance").collection("users");
        petCollection = client.db("secondChance").collection("pets");
        adoptReqCollection = client.db("secondChance").collection("adoptRequest");
        donationCollection = client.db("secondChance").collection("donations");
        donationCampaignsCollection = client.db("secondChance").collection("donationCampaigns");


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
        app.get('/pets', async (req, res) => {
            const page = parseInt(req.query.page, 9) || 0;
            const limit = 9;
            const skip = page * limit;
          
            const pets = await petCollection.find({ adopted: false }).skip(skip).limit(limit).toArray();
            const totalPets = await petCollection.countDocuments({ adopted: false });
            const nextCursor = totalPets > skip + limit ? page + 1 : null;
          
            res.json({
              pets,
              nextCursor,
            });
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


        ///! Donation related api: 
        //! get all donations data:
        app.get("/donations", async (req, res) => {
            const result = await donationCampaignsCollection.find().toArray();
            res.send(result);
        });

        //! get single donation for donation-details:
        app.get("/donations/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignsCollection.findOne(query);
            res.send(result);
        });

        //! get all donation by admin:
        app.get(
            "/get-all-donation-by-admin",
            verifyToken,
            verifyAdmin,
            async (req, res) => {
            const result = await donationCampaignsCollection.find().toArray();
            res.send(result);
            }
        );

        //! get single donation by admin:
        app.get("/get-single-donation-by-admin/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignsCollection.findOne(query);
            res.send(result);
        });

        //! update donation data by admin:
        app.put("/update-donation/:id", async (req, res) => {
            const id = req.params.id;
            const {
            getDonationAmount,
            lastDate,
            longDescription,
            maxDonationAmount,
            name,
            image,
            shortDescription,
            } = req.body;
    
            const filter = { _id: new ObjectId(id) };
    
            const updatedDocs = {
            $set: {
                getDonationAmount,
                lastDate,
                longDescription,
                maxDonationAmount,
                name,
                image,
                shortDescription,
            },
            };
    
            const result = await donationCampaignsCollection.updateOne(
            filter,
            updatedDocs
            );
            res.send(result);
        });
    
        //! delete donation by admin:
        app.delete("/delete-donation/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignsCollection.deleteOne(query);
            res.send(result);
        });
    
        //! pause - donation campaign:
        app.put("/donation-status/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
    
            const campaignItem = await donationCampaignsCollection.findOne(query);
            const isPause = campaignItem?.pause;
            console.log({ isPause });
            if (isPause) {
            const update = {
                $set: {
                pause: false,
                },
            };
            const result = await donationCampaignsCollection.updateOne(
                query,
                update
            );
            res.send(result);
            } else {
            const update = {
                $set: {
                pause: true,
                },
            };
            const result = await donationCampaignsCollection.updateOne(
                query,
                update
            );
            res.send(result);
            }
        });

        //! mark adopted by admin: 
        app.patch("/mark-adopt/:id", async (req, res) => {
            const id = req.params.id;
            console.log({ id });
            const filter = { _id: new ObjectId(id) };
            const markAdopt = {
              $set: {
                adopted: true,
              },
            };
            const result = await petCollection.updateOne(filter, markAdopt);
            res.send(result);
        });
        
        //! mark not-adopted by admin:
        app.patch(
        "/mark-not-adopt/:id",
        verifyToken,
        verifyAdmin,
        async (req, res) => {
            const id = req.params.id;
            console.log({ id });
            const filter = { _id: new ObjectId(id) };
            const markAdopt = {
            $set: {
                adopted: false,
            },
            };
            const result = await petCollection.updateOne(filter, markAdopt);
            res.send(result);
        }
        );

        //! get my donation campaign: 
        app.get("/my-donation-campaign/:email", async (req, res) => {
            const userEmail = req.params.email;
            const query = { email: userEmail };
            const result = await donationCampaignsCollection.find(query).toArray();
            res.send(result);
        });
    
        //! get single donation data for my donation campaign update:
        app.get("/my-donation-single-item/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await donationCampaignsCollection.findOne(query);
            res.send(result);
        });
    
        //! update my donation campaign info:
        app.put("/update-donation-campaign-info/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const {
            name,
            image,
            getDonationAmount,
            maxDonationAmount,
            shortDescription,
            longDescription,
            } = req.body;
    
            const updatedDocs = {
            $set: {
                name,
                image,
                getDonationAmount,
                maxDonationAmount,
                shortDescription,
                longDescription,
            },
            };
    
            const result = await donationCampaignsCollection.updateOne(
            query,
            updatedDocs
            );
            res.send(result);
        });
    
        app.put("/my-donation-campaign-pause/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedDocs = {
            $set: {
                pause: true,
            },
            };
            const result = await donationCampaignsCollection.updateOne(
            query,
            updatedDocs
            );
            res.send(result);
        });
    
        //! ask for refund:
        app.put("/ask-for-refund/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
    
            const updateDocs = {
            $set: {
                refund: true,
            },
            };
    
            const result = await donationCollection.updateOne(query, updateDocs);
            res.send(result);
        });
    
        //! create donation campaign:
        app.post("/create-donation-campaign", verifyToken, async (req, res) => {
            const {
            name,
            email,
            image,
            lastDate,
            maxDonationAmount,
            shortDescription,
            longDescription,
            } = req.body;
    
            const newCampaign = {
            name,
            email,
            image,
            maxDonationAmount,
            getDonationAmount: 0,
            lastDate,
            shortDescription,
            longDescription,
            createdAt: new Date(),
            pause: false,
            isClose: false,
            };
    
            const result = await donationCampaignsCollection.insertOne(newCampaign);
            res.send(result);
        });

        ///! Payment related: 
        //! payment intent:
        app.post("/create-payment-intent", async (req, res) => {
            const { amount } = req.body;
    
            const getAmount = parseInt(amount * 100);
    
            const paymentIntent = await stripe.paymentIntents.create({
            amount: getAmount,
            currency: "usd",
            payment_method_types: ["card"],
            });
    
            res.send({ clientSecret: paymentIntent.client_secret });
        });
    
        app.get("/payments/:email", async (req, res) => {
            const query = { email: req.params.email };
            const result = await donationCollection.find(query).toArray();
            res.send(result);
        });
    
        app.post("/payments", async (req, res) => {
            const payment = req.body;
    
            const userDonate = parseFloat(payment?.donation);
    
            const id = payment?.petId;
            const query = { _id: new ObjectId(id) };
    
            const findPetToAddMoney = await donationCampaignsCollection.findOne(query);
            const prevDonation = parseFloat(findPetToAddMoney?.getDonationAmount);
    
            const totalDonationAmount = userDonate + prevDonation;
    
            const updateDonation = {
            $set: {
                getDonationAmount: totalDonationAmount,
            },
            };
            await donationCampaignsCollection.updateOne(query, updateDonation);
    
            const paymentResult = await donationCollection.insertOne(payment);
            res.send(paymentResult);
        });



    // await client.db("admin").command({ ping: 1 });
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