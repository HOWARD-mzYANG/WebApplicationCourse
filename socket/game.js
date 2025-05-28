const { Server } = require('socket.io');
const GameController = require('./controllers/GameController');

function initializeGameSocket(server) {
    const io = new Server(server);
    const gameController = new GameController(io);

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        socket.on('login', (data) => {
            gameController.handleLogin(socket, data);
        });

        socket.on('logout', () => {
            gameController.handleLogout(socket);
        });

        socket.on('challenge', (data) => {
            gameController.handleChallenge(socket, data);
        });

        socket.on('challenge_response', (data) => {
            gameController.handleChallengeResponse(socket, data);
        });
        
        // 添加新的事件处理
        socket.on('answer', (data) => {
            gameController.handleAnswer(socket, data);
        });
        
        socket.on('timeout', () => {
            gameController.handleTimeout(socket);
        });

        socket.on('disconnect', () => {
            gameController.handleDisconnect(socket);
            console.log('User disconnected:', socket.id);
        });
    });

    return io;
}

module.exports = initializeGameSocket;