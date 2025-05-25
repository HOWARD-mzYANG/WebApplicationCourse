class UserState {
    constructor(state = 'idle', opponent = null) {
        this.state = state;
        this.opponent = opponent;
    }
}

module.exports = UserState; 