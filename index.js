const express = require("express");

const PORT = 3000;

const app = express();

app.use(express.json());
app.use(express.static('public'));

const userStore = {};

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    console.log(req.body);
    const id = `${Date.now()}`;
    const user = [
        id,
        username,
        password
    ];
    userStore[id] = user;
    console.log(`User ${username} registered successfully with id ${id}`);
    return res.json({ id})
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

