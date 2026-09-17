require('dotenv').config();

const express = require('express');
const cors = require('cors');

const labRoutes = require('./src/routers/labs');
const testRoutes = require('./src/routers/tests');

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

app.use('/api/v1/labs', labRoutes);
app.use('/api/v1/tests', testRoutes);

app.listen(PORT, () => {
    console.log(`server start http://127.0.0.1:${PORT}`);
});