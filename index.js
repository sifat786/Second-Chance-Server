const express = require('express');

const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const port = process.env.port || 5000;

//! Middleware: 
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "", ""],
    credentials: true,
    optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(cookieParser());





app.get('/', (req, res) => {
    res.send('server i running')
});

app.listen(port, () => {
    console.log(`server is running on port : ${port}`);
})