const userService = require('./UserService');

class GameService {
    handleChallenge(challengerId, opponentUsername) {
        console.log('Challenge attempt:', { challengerId, opponentUsername });
        console.log('Online users:', Array.from(userService.onlineUsers.entries()));
        
        const challengerState = userService.getUserState(challengerId);
        const opponentId = userService.getUserByUsername(opponentUsername);

        console.log('Found opponent ID:', opponentId);
        console.log('Challenger state:', challengerState);

        if (!opponentId) {
            console.log('Opponent not found');
            return { success: false, message: 'Opponent not found' };
        }

        const opponentState = userService.getUserState(opponentId);
        console.log('Opponent state:', opponentState);

        if (challengerState.state !== 'idle') {
            console.log('Challenger not idle');
            return { success: false, message: 'You are already in a game or have a pending challenge' };
        }

        if (opponentState.state !== 'idle') {
            console.log('Opponent not idle');
            return { success: false, message: 'Opponent is already in a game or has a pending challenge' };
        }

        userService.updateUserState(challengerId, 'challenging', opponentId);
        userService.updateUserState(opponentId, 'challenged', challengerId);

        console.log('Challenge successful');
        return { 
            success: true, 
            challengerUsername: userService.onlineUsers.get(challengerId),
            opponentId 
        };
    }

    handleChallengeResponse(responderId, challengerUsername, accepted) {
        const responderState = userService.getUserState(responderId);
        const challengerId = userService.getUserByUsername(challengerUsername);

        if (!challengerId) {
            return { success: false, message: 'Challenger not found' };
        }

        const challengerState = userService.getUserState(challengerId);
        if (!challengerState) {
            return { success: false, message: 'Challenger state not found' };
        }

        if (accepted) {
            userService.updateUserState(challengerId, 'in_game', responderId);
            userService.updateUserState(responderId, 'in_game', challengerId);
            return { 
                success: true, 
                gameStarted: true,
                challengerId,
                responderId
            };
        } else {
            userService.updateUserState(challengerId, 'idle', null);
            userService.updateUserState(responderId, 'idle', null);
            return { 
                success: true, 
                gameStarted: false,
                challengerId
            };
        }
    }
}

module.exports = new GameService(); 