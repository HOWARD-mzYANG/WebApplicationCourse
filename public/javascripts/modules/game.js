import { socket } from './socket.js';
import { currentUser } from './auth.js';

// Game state - unified game state object
const gameState = {
    score: 0,
    opponentScore: 0,
    currentQuestion: null,
    timer: null,
    resultTimer: null, // Result timer
    isInGame: false,
    challengingUser: null,
    challengedBy: null
};

function selectAnswer(answer) {
    // 检查是否已经提交过答案
    if (gameState.hasSubmittedAnswer) {
        return;
    }
    
    // 设置已提交标志
    gameState.hasSubmittedAnswer = true;
    
    // 不再清理计时器，让它继续运行
    // 注释掉原来的计时器清理代码
    // if (gameState.timer) {
    //     clearInterval(gameState.timer);
    //     gameState.timer = null;
    // }
    
    // 发送答案到服务器
    socket.emit('answer', { answer });
}

function challengeUser(username) {
    if (!gameState.isInGame) {
        gameState.challengingUser = username;
        socket.emit('challenge', { opponent: username });
        // Immediately trigger UI update with correct data
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
    // Trigger custom event with correct data
    window.dispatchEvent(new CustomEvent('challengeReceived', { 
        detail: { 
            challenger: challenger 
        }
    }));
});

socket.on('challenge_sent', () => {
    // Ensure UI shows waiting state with current challenged username
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
    // 重置提交状态
    gameState.hasSubmittedAnswer = false;
    
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

// Add new event handlers
socket.on('answer_result', (data) => {
    // Handle answer result
    const { isCorrect, opponentAnswered } = data;
    
    // Show if current answer is correct
    const questionContainer = document.getElementById('question-container');
    if (isCorrect) {
        questionContainer.classList.add('correct-answer');
    } else {
        questionContainer.classList.add('wrong-answer');
    }
    
    // If opponent has answered or you got it right, no need to wait
    if (opponentAnswered || isCorrect) {
        clearInterval(gameState.timer);
    }
    
    window.dispatchEvent(new CustomEvent('answerResult', { detail: data }));
});

// In existing socket event listeners
// Modify answer_received event handling
socket.on('answer_received', (data) => {
    if (data.waitingForOpponent) {
        // Don't stop timer here, let it continue running
        // Only trigger UI update to show waiting state
        window.dispatchEvent(new CustomEvent('answerReceived', { 
            detail: { 
                waitingForOpponent: true,
                message: data.message
            } 
        }));
    }
});

// Modify startTimer function
function startTimer() {
    let timeLeft = 30;
    let totalTime = 30;
    const timerValueElement = document.getElementById('timer-value');
    const timerProgressElement = document.getElementById('timer-progress');
    
    timerValueElement.textContent = timeLeft;
    timerProgressElement.style.width = '100%';
    timerProgressElement.classList.remove('warning');
    
    let startTime = Date.now();
    
    gameState.timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTimeLeft = Math.max(0, totalTime - elapsed);
        
        const displayTime = Math.ceil(currentTimeLeft);
        if (displayTime !== parseInt(timerValueElement.textContent)) {
            timerValueElement.textContent = displayTime;
        }
        
        const progressPercent = (currentTimeLeft / totalTime) * 100;
        timerProgressElement.style.width = progressPercent + '%';
        
        if (currentTimeLeft <= 10) {
            timerProgressElement.classList.add('warning');
        }
        
        if (currentTimeLeft <= 0) {
            clearInterval(gameState.timer);
            gameState.timer = null;
            
            // Unified timeout handling: only send timeout event
            if (gameState.isInGame && !gameState.hasSubmittedAnswer) {
                console.log('Timer expired, sending timeout to server');
                socket.emit('timeout');
                gameState.hasSubmittedAnswer = true;
            }
        }
    }, 100);
}

function startResultTimer() {
    let timeLeft = 10;
    let totalTime = 10;
    const timerValueElement = document.getElementById('timer-value');
    const timerProgressElement = document.getElementById('timer-progress');
    const timerLabelElement = document.getElementById('timer-label');
    
    // Set initial state for result timer
    timerLabelElement.textContent = 'Next Question';
    timerValueElement.textContent = timeLeft;
    timerProgressElement.style.width = '100%';
    timerProgressElement.classList.remove('warning');
    timerProgressElement.classList.add('warning'); // Result timer always red
    
    let startTime = Date.now();
    
    gameState.resultTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTimeLeft = Math.max(0, totalTime - elapsed);
        
        // Only update display on whole seconds
        const displayTime = Math.ceil(currentTimeLeft);
        if (displayTime !== parseInt(timerValueElement.textContent)) {
            timerValueElement.textContent = displayTime;
        }
        
        // Smooth progress bar update
        const progressPercent = (currentTimeLeft / totalTime) * 100;
        timerProgressElement.style.width = progressPercent + '%';
        
        if (currentTimeLeft <= 0) {
            clearInterval(gameState.resultTimer);
            gameState.resultTimer = null;
            // Restore timer label
            timerLabelElement.textContent = 'Time Remaining';
            window.dispatchEvent(new CustomEvent('resultTimerEnd'));
        }
    }, 100); // Update every 100ms
}

// In round_result event handling
socket.on('round_result', (data) => {
    console.log('[CLIENT] round_result event received:', data); // 添加日志
// Ensure answer timer stops
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    // Handle round result
    const { yourAnswerCorrect, opponentAnswerCorrect } = data;
// Show answer result
const questionContainer = document.getElementById('question-container');
    if (yourAnswerCorrect) {
        questionContainer.classList.add('correct-answer');
    } else {
        questionContainer.classList.add('wrong-answer');
    }
    // Trigger UI update event
    window.dispatchEvent(new CustomEvent('roundResult', { 
        detail: data
    }));
    
    // Keep result timer for countdown display
    startResultTimer();
});

// Add after other socket event listeners
socket.on('final_result', (data) => {
    gameState.isInGame = false;
    window.dispatchEvent(new CustomEvent('finalResult', { detail: data }));
});

// Update exports
export { gameState, startTimer, startResultTimer, selectAnswer, challengeUser };
