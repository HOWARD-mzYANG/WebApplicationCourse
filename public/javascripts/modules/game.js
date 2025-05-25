import { socket } from './socket.js';
import { currentUser } from './auth.js';
import { showQuestion, showResult, showFinalResult, resetGameState } from './ui.js';

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
});

socket.on('challenge_accepted', () => {
    gameState.challengingUser = null;
    gameState.challengedBy = null;
});

socket.on('challenge_rejected', () => {
    gameState.challengingUser = null;
    gameState.challengedBy = null;
    alert('Your challenge was rejected');
    resetGameState();
});

socket.on('game_start', (data) => {
    gameState.isInGame = true;
    alert(`Game starting with ${data.opponent}!`);
});

socket.on('question', (question) => {
    showQuestion(question);
});

socket.on('game_result', (data) => {
    showResult(data);
});

socket.on('game_over', (data) => {
    showFinalResult(data);
});

socket.on('opponent_disconnected', () => {
    alert('Your opponent has disconnected');
    resetGameState();
});

export { gameState, startTimer, selectAnswer, challengeUser }; 