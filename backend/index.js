const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// Import and use route modules
require('./routes/login')(app);
require('./routes/microsoftAuth')(app);
require('./routes/documents')(app, io);
require('./routes/incoming')(app, io);
require('./routes/documentTypes')(app, io);
require('./routes/admins')(app, io);
require('./routes/holidays')(app, io);
require('./routes/settings')(app, io);
require('./routes/payees')(app, io);
require('./routes/routes')(app, io);
require('./routes/audit')(app);

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});