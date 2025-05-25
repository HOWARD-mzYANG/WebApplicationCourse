const userService = require('../services/UserService');
const gameService = require('../services/GameService');

class GameController {
    constructor(io) {
        this.io = io;
    }

    handleLogin(socket, data) {
        const { username } = data;
        
        if (userService.isUsernameTaken(username)) {
            socket.emit('login_error', { message: 'Username already taken' });
            return;
        }

        userService.addUser(socket.id, username);
        socket.emit('login_success', { username });
        this.broadcastUserList();
    }

    handleLogout(socket) {
        if (userService.onlineUsers.has(socket.id)) {
            const userState = userService.getUserState(socket.id);
            if (userState && userState.opponent) {
                const opponentSocket = this.io.sockets.sockets.get(userState.opponent);
                if (opponentSocket) {
                    opponentSocket.emit('opponent_disconnected');
                }
            }
            
            userService.removeUser(socket.id);
            socket.emit('logout_success');
            this.broadcastUserList();
        }
    }

    handleChallenge(socket, data) {
        console.log('Handling challenge:', { socketId: socket.id, data });
        const { opponent } = data;
        const result = gameService.handleChallenge(socket.id, opponent);

        console.log('Challenge result:', result);

        if (!result.success) {
            console.log('Challenge failed:', result.message);
            socket.emit('challenge_error', { message: result.message });
            return;
        }

        console.log('Sending challenge request to opponent:', result.opponentId);
        this.io.to(result.opponentId).emit('challenge_request', {
            challenger: result.challengerUsername
        });
        socket.emit('challenge_sent');
    }

    handleChallengeResponse(socket, data) {
        const { accepted, challenger } = data;
        const result = gameService.handleChallengeResponse(socket.id, challenger, accepted);

        if (!result.success) {
            socket.emit('challenge_error', { message: result.message });
            return;
        }

        if (result.gameStarted) {
            this.io.to(result.challengerId).emit('game_start', {
                opponent: userService.onlineUsers.get(socket.id)
            });
            socket.emit('game_start', {
                opponent: userService.onlineUsers.get(result.challengerId)
            });
        } else {
            this.io.to(result.challengerId).emit('challenge_rejected');
        }
    }

    handleDisconnect(socket) {
        if (userService.onlineUsers.has(socket.id)) {
            const userState = userService.getUserState(socket.id);
            if (userState && userState.opponent) {
                const opponentSocket = this.io.sockets.sockets.get(userState.opponent);
                if (opponentSocket) {
                    opponentSocket.emit('opponent_disconnected');
                }
            }
            
            userService.removeUser(socket.id);
            this.broadcastUserList();
        }
    }

    broadcastUserList() {
        const users = userService.getAllUsers();
        this.io.emit('user_list', users);
    }
}

module.exports = GameController; 