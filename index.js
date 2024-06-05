const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const port = process.env.port || 5000;


//! Middleware:
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'https://second-chance-8f474.web.app', 'https://second-chance-8f474.firebaseapp.com'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


//! Verify Token Middleware:
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    console.log(token);
    if(!token) {
        return res.status(401).send({message: 'unauthorized access'})
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
            console.log(err);
            return res.status(401).send({message: 'unauthorized access'});
        }
        req.user = decoded;
        next();
    })
}


//! MongoDB:
const { MongoClient, ServerApiVersion } = require('mongodb');
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
        await client.connect();

        //! collections:



        ///! JWT related api:
        app.post('/jwt', async(req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'});
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({success: true})
        })
        app.get('/logout', async(req, res) => {
            try{
                res
                    .clearCookie('token', {
                        maxAge: 0,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                    })
                    .send({success: true});
                    console.log('logout successful');

            } catch(err) {
                res.status(500).send(err);
            }
        })




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