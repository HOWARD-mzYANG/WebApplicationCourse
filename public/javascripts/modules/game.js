import { socket } from './socket.js';
import { currentUser } from './auth.js';

// Game state - 统一的游戏状态对象
let gameState = {
    score: 0,
    opponentScore: 0,
    currentQuestion: null,
    timer: null,
    resultTimer: null, // 结果计时器
    isInGame: false,
    challengingUser: null,
    challengedBy: null
};

function selectAnswer(answer) {
 socket.emit('answer', { answer });
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

// 添加新的事件处理
socket.on('answer_result', (data) => {
    // 处理答案结果
    const { isCorrect, opponentAnswered } = data;
    
    // 显示当前答案是否正确
    const questionContainer = document.getElementById('question-container');
    if (isCorrect) {
        questionContainer.classList.add('correct-answer');
    } else {
        questionContainer.classList.add('wrong-answer');
    }
    
    // 如果对手已经回答或者自己答对了，不需要继续等待
    if (opponentAnswered || isCorrect) {
        clearInterval(gameState.timer);
    }
    
    window.dispatchEvent(new CustomEvent('answerResult', { detail: data }));
});

// 在现有的 socket 事件监听器后添加
// 修改 answer_received 事件处理
socket.on('answer_received', (data) => {
    if (data.waitingForOpponent) {
        // 不要在这里停止计时器，让它继续运行
        // 只触发UI更新显示等待状态
        window.dispatchEvent(new CustomEvent('answerReceived', { 
            detail: { 
                waitingForOpponent: true,
                message: data.message
            } 
        }));
    }
});

// 修改 startTimer 函数
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
            
            // 统一的超时处理：只发送timeout事件
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
    
    // 设置结果计时器的初始状态
    timerLabelElement.textContent = 'Next Question';
    timerValueElement.textContent = timeLeft;
    timerProgressElement.style.width = '100%';
    timerProgressElement.classList.remove('warning');
    timerProgressElement.classList.add('warning'); // 结果计时器始终为红色
    
    let startTime = Date.now();
    
    gameState.resultTimer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTimeLeft = Math.max(0, totalTime - elapsed);
        
        // 只在整秒时更新显示的数字
        const displayTime = Math.ceil(currentTimeLeft);
        if (displayTime !== parseInt(timerValueElement.textContent)) {
            timerValueElement.textContent = displayTime;
        }
        
        // 平滑更新进度条
        const progressPercent = (currentTimeLeft / totalTime) * 100;
        timerProgressElement.style.width = progressPercent + '%';
        
        if (currentTimeLeft <= 0) {
            clearInterval(gameState.resultTimer);
            gameState.resultTimer = null;
            // 恢复计时器标签
            timerLabelElement.textContent = 'Time Remaining';
            window.dispatchEvent(new CustomEvent('resultTimerEnd'));
        }
    }, 100); // 每100毫秒更新一次
}

// 在 round_result 事件处理中
socket.on('round_result', (data) => {
    // 确保答题计时器停止
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    
    // 处理回合结果
    const { yourAnswerCorrect, opponentAnswerCorrect } = data;
    
    // 显示答案结果
    const questionContainer = document.getElementById('question-container');
    if (yourAnswerCorrect) {
        questionContainer.classList.add('correct-answer');
    } else {
        questionContainer.classList.add('wrong-answer');
    }
    
    // 触发UI更新事件
    window.dispatchEvent(new CustomEvent('roundResult', { 
        detail: data
    }));
    
    // 保持结果计时器，用于倒计时显示
    startResultTimer();
});

// 添加其他socket事件监听器后添加
socket.on('final_result', (data) => {
    gameState.isInGame = false;
    window.dispatchEvent(new CustomEvent('finalResult', { detail: data }));
});

// 更新导出
export { gameState, startTimer, startResultTimer, selectAnswer, challengeUser };
