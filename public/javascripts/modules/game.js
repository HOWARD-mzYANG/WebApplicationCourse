import { socket } from './socket.js';
import { currentUser } from './auth.js';

// Game state
let gameState = {
    score: 0,
    opponentScore: 0,
    currentQuestion: null,
    timer: null,
    isInGame: false,
    challengingUser: null,
    challengedBy: null
};

function startTimer() {
    let timeLeft = 5;
    const timerElement = document.getElementById('timer');
    timerElement.textContent = timeLeft;
    
    gameState.timer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(gameState.timer);
            socket.emit('timeout');
        }
    }, 1000);
}

function selectAnswer(answer) {
    socket.emit('answer', { answer });
    clearInterval(gameState.timer);
}

function challengeUser(username) {
    if (!gameState.isInGame) {
        gameState.challengingUser = username;
        socket.emit('challenge', { opponent: username });
        // 立即触发UI更新，传递正确的数据
        window.dispatchEvent(new CustomEvent('challengeSent', { 
            detail: { 
                username: username 
            }
        }));
    }
}

// Socket event handlers for game
socket.on('challenge_request', (data) => {
    const { challenger } = data;
    if (gameState.isInGame) {
        socket.emit('challenge_response', { accepted: false, challenger });
        return;
    }
    gameState.challengedBy = challenger;
    gameState.challengingUser = null;
    // 触发自定义事件，确保传递正确的数据
    window.dispatchEvent(new CustomEvent('challengeReceived', { 
        detail: { 
            challenger: challenger 
        }
    }));
});

socket.on('challenge_sent', () => {
    // 确保UI显示等待状态，传递当前挑战的用户名
    window.dispatchEvent(new CustomEvent('challengeSent', { 
        detail: { 
            username: gameState.challengingUser 
        }
    }));
});

socket.on('challenge_accepted', () => {
    gameState.challengingUser = null;
    gameState.challengedBy = null;
    window.dispatchEvent(new CustomEvent('challengeAccepted'));
});

socket.on('challenge_rejected', () => {
    gameState.challengingUser = null;
    gameState.challengedBy = null;
    window.dispatchEvent(new CustomEvent('challengeRejected'));
});

socket.on('game_start', (data) => {
    gameState.isInGame = true;
    window.dispatchEvent(new CustomEvent('gameStarted', { detail: data }));
});

socket.on('question', (question) => {
    window.dispatchEvent(new CustomEvent('questionReceived', { detail: question }));
});

socket.on('game_result', (data) => {
    window.dispatchEvent(new CustomEvent('gameResult', { detail: data }));
});

socket.on('game_over', (data) => {
    window.dispatchEvent(new CustomEvent('gameOver', { detail: data }));
});

socket.on('opponent_disconnected', () => {
    window.dispatchEvent(new CustomEvent('opponentDisconnected'));
});

export { gameState, startTimer, selectAnswer, challengeUser }; 