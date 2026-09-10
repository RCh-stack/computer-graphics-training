const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

app.use(express.json());

// Запуск сервера
app.listen(PORT, () => {
    console.log(`server start http://127.0.0.1:${PORT}`);
});