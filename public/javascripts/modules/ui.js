import { socket } from './socket.js';
import { currentUser } from './auth.js';
import { gameState, startTimer, selectAnswer, challengeUser } from './game.js';

// DOM Elements
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const userInfo = document.getElementById('user-info');
const usersList = document.getElementById('users-list');
const gameContainer = document.getElementById('game-container');
const waitingMessage = document.getElementById('waiting-message');
const questionContainer = document.getElementById('question-container');
const resultContainer = document.getElementById('result-container');
const finalResult = document.getElementById('final-result');
const challengeContainer = document.getElementById('challenge-container');
const challengeStatus = document.getElementById('challenge-status');
const waitingChallenge = document.getElementById('waiting-challenge');
const challengeMessage = document.getElementById('challenge-message');

// 将challengeUser函数暴露到全局作用域
window.challengeUser = challengeUser;

function showUserInfo() {
    loginForm.style.display = 'none';
    userInfo.style.display = 'flex';
    gameContainer.style.display = 'block';
    usersList.innerHTML = '';
}

function showLoginForm() {
    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    gameContainer.style.display = 'none';
    document.getElementById('username').value = '';

    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'login-prompt';
    loginPrompt.textContent = 'Please login to view online users';
    usersList.innerHTML = '';
    usersList.appendChild(loginPrompt);
}

function updateUsersList(users) {
    usersList.innerHTML = '';
    
    if (!currentUser) {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt';
        loginPrompt.textContent = 'Please login to view online users';
        usersList.appendChild(loginPrompt);
        return;
    }

    if (gameState.challengedBy) {
        document.getElementById('online-users').style.display = 'none';
        challengeContainer.style.display = 'block';
        challengeStatus.style.display = 'block';
        waitingChallenge.style.display = 'none';
        challengeMessage.textContent = `You have a challenge request from ${gameState.challengedBy}. Do you accept?`;
        return;
    }

    if (gameState.challengingUser) {
        document.getElementById('online-users').style.display = 'none';
        challengeContainer.style.display = 'block';
        challengeStatus.style.display = 'none';
        waitingChallenge.style.display = 'block';
        waitingMessage.textContent = `Waiting for ${gameState.challengingUser} to accept your challenge...`;
        return;
    }

    document.getElementById('online-users').style.display = 'block';
    challengeContainer.style.display = 'none';
    const otherUsers = users.filter(user => user !== currentUser);
    if (otherUsers.length === 0) {
        const noUsersPrompt = document.createElement('div');
        noUsersPrompt.className = 'no-users-prompt';
        noUsersPrompt.textContent = 'No other users online currently.';
        usersList.appendChild(noUsersPrompt);
    } else {
        otherUsers.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.innerHTML = `
                <span>${user}</span>
                <button class="challenge-btn" ${gameState.isInGame ? 'disabled' : ''}>Challenge</button>
            `;
            const challengeBtn = userCard.querySelector('.challenge-btn');
            challengeBtn.addEventListener('click', () => {
                if (!gameState.isInGame) {
                    challengeUser(user);
                }
            });
            usersList.appendChild(userCard);
        });
    }
}

// 初始化挑战按钮事件监听器
document.getElementById('accept-challenge-btn').addEventListener('click', () => {
    socket.emit('challenge_response', { accepted: true, challenger: gameState.challengedBy });
    gameState.challengedBy = null;
    gameState.challengingUser = null;
    challengeContainer.style.display = 'none';
    document.getElementById('online-users').style.display = 'block';
});

document.getElementById('reject-challenge-btn').addEventListener('click', () => {
    socket.emit('challenge_response', { accepted: false, challenger: gameState.challengedBy });
    gameState.challengedBy = null;
    gameState.challengingUser = null;
    challengeContainer.style.display = 'none';
    document.getElementById('online-users').style.display = 'block';
});

function showQuestion(question) {
    const questionElement = document.getElementById('question');
    const optionsElement = document.getElementById('options');
    
    questionElement.textContent = question.text;
    optionsElement.innerHTML = '';
    
    question.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'option';
        button.textContent = option;
        button.onclick = () => selectAnswer(option);
        optionsElement.appendChild(button);
    });
    
    startTimer();
}

function showResult(data) {
    resultContainer.style.display = 'block';
    questionContainer.style.display = 'none';
    
    document.getElementById('correct-answer').textContent = data.correctAnswer;
    document.getElementById('your-score').textContent = data.yourScore;
    document.getElementById('opponent-score').textContent = data.opponentScore;
    
    setTimeout(() => {
        resultContainer.style.display = 'none';
        if (!data.gameOver) {
            questionContainer.style.display = 'block';
        }
    }, 3000);
}

function showFinalResult(data) {
    finalResult.style.display = 'block';
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    
    const winnerMessage = document.getElementById('winner-message');
    if (data.winner === currentUser) {
        winnerMessage.textContent = 'Congratulations! You won!';
    } else if (data.winner === 'tie') {
        winnerMessage.textContent = 'It\'s a tie!';
    } else {
        winnerMessage.textContent = 'Game Over! Better luck next time!';
    }
}

function resetGameState() {
    gameState.score = 0;
    gameState.opponentScore = 0;
    gameState.currentQuestion = null;
    gameState.timer = null;
    gameState.isInGame = false;
    gameState.challengingUser = null;
    gameState.challengedBy = null;
    
    gameContainer.style.display = 'none';
    document.getElementById('online-users').style.display = 'block';
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    finalResult.style.display = 'none';
    waitingMessage.style.display = 'none';
    challengeContainer.style.display = 'none';
    challengeStatus.style.display = 'none';
    waitingChallenge.style.display = 'none';
}

// 事件监听器
window.addEventListener('challengeSent', (event) => {
    if (!event.detail || !event.detail.username) {
        console.error('Invalid challenge event data');
        return;
    }
    
    document.getElementById('online-users').style.display = 'none';
    challengeContainer.style.display = 'block';
    challengeStatus.style.display = 'none';
    waitingChallenge.style.display = 'block';
    waitingMessage.textContent = `Waiting for ${event.detail.username} to accept your challenge...`;
});

window.addEventListener('challengeReceived', (event) => {
    if (!event.detail || !event.detail.challenger) {
        console.error('Invalid challenge received event data');
        return;
    }
    
    gameState.challengedBy = event.detail.challenger;
    updateUsersList([]);
});

window.addEventListener('challengeAccepted', () => {
    updateUsersList([]);
});

window.addEventListener('challengeRejected', () => {
    alert('Your challenge was rejected');
    resetGameState();
    updateUsersList([]);
});

window.addEventListener('gameStarted', (event) => {
    alert(`Game starting with ${event.detail.opponent}!`);
    document.getElementById('online-users').style.display = 'none';
    gameContainer.style.display = 'block';
    waitingMessage.style.display = 'block';
    challengeContainer.style.display = 'none';
    challengeStatus.style.display = 'none';
    waitingChallenge.style.display = 'none';
});

window.addEventListener('questionReceived', (event) => {
    showQuestion(event.detail);
});

window.addEventListener('gameResult', (event) => {
    showResult(event.detail);
});

window.addEventListener('gameOver', (event) => {
    showFinalResult(event.detail);
});

window.addEventListener('opponentDisconnected', () => {
    alert('Your opponent has disconnected');
    resetGameState();
});

export {
    showUserInfo,
    showLoginForm,
    updateUsersList,
    showQuestion,
    showResult,
    showFinalResult,
    resetGameState
};