const UserState = require('../models/UserState');

class UserService {
    constructor() {
        this.onlineUsers = new Map(); // socket.id -> username
        this.userStates = new Map(); // socket.id -> UserState
    }

    addUser(socketId, username) {
        this.onlineUsers.set(socketId, username);
        this.userStates.set(socketId, new UserState());
    }

    removeUser(socketId) {
        this.onlineUsers.delete(socketId);
        this.userStates.delete(socketId);
    }

    getUserByUsername(username) {
        return Array.from(this.onlineUsers.entries())
            .find(([_, name]) => name === username)?.[0];
    }

    getUserState(socketId) {
        return this.userStates.get(socketId);
    }

    updateUserState(socketId, state, opponent = null) {
        const userState = this.userStates.get(socketId);
        if (userState) {
            userState.state = state;
            userState.opponent = opponent;
        }
    }

    getAllUsers() {
        return Array.from(this.onlineUsers.values());
    }

    // Get users with idle status only
    getAvailableUsers() {
        return Array.from(this.onlineUsers.entries())
            .filter(([socketId, username]) => {
                const userState = this.userStates.get(socketId);
                return userState && userState.state === 'idle';
            })
            .map(([socketId, username]) => username);
    }

    isUsernameTaken(username) {
        return Array.from(this.onlineUsers.values()).includes(username);
    }
}

module.exports = new UserService();