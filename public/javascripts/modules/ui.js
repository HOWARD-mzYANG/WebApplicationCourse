import { socket } from './socket.js';
import { currentUser } from './auth.js';
import { gameState } from './game.js';

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

// 创建挑战提示容器
const challengeContainer = document.createElement('div');
challengeContainer.id = 'challenge-container';
challengeContainer.className = 'challenge-container';
document.querySelector('.content').insertBefore(challengeContainer, gameContainer);

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
    challengeContainer.innerHTML = '';
    
    if (!currentUser) {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt';
        loginPrompt.textContent = 'Please login to view online users';
        usersList.appendChild(loginPrompt);
        return;
    }

    if (gameState.challengedBy) {
        document.getElementById('online-users').style.display = 'none';
        const challengeDiv = document.createElement('div');
        challengeDiv.className = 'challenge-status';
        challengeDiv.innerHTML = `你收到了来自 ${gameState.challengedBy} 的挑战请求，请问是否接受？<br>
            <button id="accept-challenge-btn">接受</button>
            <button id="reject-challenge-btn">拒绝</button>`;
        challengeContainer.appendChild(challengeDiv);
        
        document.getElementById('accept-challenge-btn').onclick = function() {
            socket.emit('challenge_response', { accepted: true, challenger: gameState.challengedBy });
            gameState.challengedBy = null;
            gameState.challengingUser = null;
            challengeContainer.innerHTML = '';
            document.getElementById('online-users').style.display = 'block';
        };
        
        document.getElementById('reject-challenge-btn').onclick = function() {
            socket.emit('challenge_response', { accepted: false, challenger: gameState.challengedBy });
            gameState.challengedBy = null;
            gameState.challengingUser = null;
            challengeContainer.innerHTML = '';
            document.getElementById('online-users').style.display = 'block';
        };
        return;
    }

    if (gameState.challengingUser) {
        document.getElementById('online-users').style.display = 'none';
        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'challenge-status';
        waitingDiv.textContent = `Waiting for ${gameState.challengingUser} to accept your challenge...`;
        challengeContainer.appendChild(waitingDiv);
        return;
    }

    document.getElementById('online-users').style.display = 'block';
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
                <button class="challenge-btn" onclick="challengeUser('${user}')" ${gameState.isInGame ? 'disabled' : ''}>Challenge</button>
            `;
            usersList.appendChild(userCard);
        });
    }
}

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
    gameState = {
        score: 0,
        opponentScore: 0,
        currentQuestion: null,
        timer: null,
        isInGame: false,
        challengingUser: null,
        challengedBy: null
    };
    gameContainer.style.display = 'none';
    document.getElementById('online-users').style.display = 'block';
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    finalResult.style.display = 'none';
    waitingMessage.style.display = 'none';
    challengeContainer.innerHTML = '';
}

export {
    showUserInfo,
    showLoginForm,
    updateUsersList,
    showQuestion,
    showResult,
    showFinalResult,
    resetGameState
}; 