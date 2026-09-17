require('dotenv').config();

const express = require('express');
const cors = require('cors');
const labRoutes = require('./src/routers/labs');

const app = express();
const PORT = process.env.PORT;

app.use(cors());

app.use(express.json());

app.listen(PORT, () => {
    console.log(`server start http://127.0.0.1:${PORT}`);
});

app.use('/api/v1/labs', labRoutes);