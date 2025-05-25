const express = require('express');
const path = require('path');
const app = express();
const http = require('http');
const server = http.createServer(app);
const initializeGameSocket = require('./socket/game');

// Initialize Socket.IO
const io = initializeGameSocket(server);

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.render('introduction');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/test', (req, res) => {
    res.render('test');
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});