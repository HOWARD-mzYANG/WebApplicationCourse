// Socket connection
const socket = io();

// Debug connection status
socket.on('connect', () => {
    console.log('Connected to server with ID:', socket.id);
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// DOM Elements
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const userInfo = document.getElementById('user-info');
const currentUserSpan = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
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

// Game state
let currentUser = null;
let gameState = {
    score: 0,
    opponentScore: 0,
    currentQuestion: null,
    timer: null,
    isInGame: false,
    challengingUser: null,
    challengedBy: null
};

// Initial UI setup
function initializeUI() {
    if (!currentUser) {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt';
        loginPrompt.textContent = 'Please login to view online users';
        usersList.innerHTML = ''; // Clear any existing content
        usersList.appendChild(loginPrompt);
    } else {
        // If a user is somehow already set (e.g., from a previous session),
        // clear the prompt and prepare for user list update.
        usersList.innerHTML = ''; 
    }
}

// Call initializeUI when the script loads
initializeUI();

// Login handling
loginBtn.addEventListener('click', () => {
    console.log('Attempting to click the botton');
    const username = usernameInput.value.trim();
    if (username) {
        console.log('Attempting to login with username:', username);
        socket.emit('login', { username });
    } else {
        alert('Please enter a username');
    }
});

// Logout handling
logoutBtn.addEventListener('click', () => {
    console.log('Logging out...');
    socket.emit('logout');
    // Immediately update UI to show login form and prompt
    showLoginForm(); 
    resetGameState(); // Keep this if it's relevant to UI state
});

// Socket event handlers
socket.on('login_success', (data) => {
    console.log('Login successful:', data);
    currentUser = data.username;
    currentUserSpan.textContent = currentUser;
    showUserInfo();
});

socket.on('login_error', (data) => {
    console.error('Login error:', data);
    alert(data.message);
});

socket.on('logout_success', () => {
    console.log('Logout successful');
    currentUser = null; // Ensure currentUser is reset
    showLoginForm();
    // Potentially call initializeUI() again if it handles all initial states
    // initializeUI(); 
});

socket.on('user_list', (users) => {
    console.log('Updated user list:', users);
    updateUsersList(users);
});

socket.on('challenge_request', (data) => {
    const { challenger } = data;
    if (gameState.isInGame) {
        socket.emit('challenge_response', { accepted: false, challenger });
        return;
    }
    gameState.challengedBy = challenger;
    gameState.challengingUser = null; // 清除可能的挑战状态
    updateUsersList([]); // 这里传入最新用户列表
});

socket.on('challenge_sent', () => {
    // 移除alert提示，因为已经在UI中显示了等待状态
});

socket.on('challenge_accepted', () => {
    gameState.challengingUser = null; // 清除挑战状态
    gameState.challengedBy = null; // 清除被挑战状态
    updateUsersList([]); // 更新UI
});

socket.on('challenge_rejected', () => {
    gameState.challengingUser = null;
    gameState.challengedBy = null; // 清除被挑战状态
    alert('Your challenge was rejected');
    updateUsersList([]); // 更新UI
    resetGameState();
});

socket.on('challenge_error', (data) => {
    gameState.challengingUser = null;
    gameState.challengedBy = null; // 同时清除被挑战状态
    alert(data.message);
    updateUsersList([]); // 更新UI
    resetGameState();
});

socket.on('game_start', (data) => {
    gameState.challengingUser = null;
    gameState.challengedBy = null; // 清除被挑战状态
    gameState.isInGame = true;
    alert(`Game starting with ${data.opponent}!`);
    document.getElementById('online-users').style.display = 'none';
    gameContainer.style.display = 'block';
    waitingMessage.style.display = 'block';
    challengeContainer.innerHTML = ''; // 清空挑战容器
});

socket.on('opponent_disconnected', () => {
    alert('Your opponent has disconnected');
    resetGameState();
});

socket.on('game_start', (data) => {
    const { opponent } = data;
    gameState.isInGame = true;
    alert(`Game starting with ${opponent}!`);
    // Hide the users list and show the game container
    document.getElementById('online-users').style.display = 'none';
    gameContainer.style.display = 'block';
    waitingMessage.style.display = 'block';
});

socket.on('game_result', (data) => {
    showResult(data);
});

socket.on('game_over', (data) => {
    showFinalResult(data);
});

// Helper functions
function showUserInfo() {
    loginForm.style.display = 'none';
    userInfo.style.display = 'flex';
    gameContainer.style.display = 'block';

    // Clear login prompt and prepare for user list
    usersList.innerHTML = ''; 
}

function showLoginForm() {
    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    gameContainer.style.display = 'none';
    usernameInput.value = '';

    // Display login prompt when logging out or if not logged in
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'login-prompt';
    loginPrompt.textContent = 'Please login to view online users';
    usersList.innerHTML = ''; // Clear previous user list or prompt
    usersList.appendChild(loginPrompt);
}

function updateUsersList(users) {
    usersList.innerHTML = '';
    challengeContainer.innerHTML = ''; // 清空挑战容器
    
    if (!currentUser) {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'login-prompt';
        loginPrompt.textContent = 'Please login to view online users';
        usersList.appendChild(loginPrompt);
        return;
    }

    // 如果收到挑战，在挑战容器中显示
    if (gameState.challengedBy) {
        document.getElementById('online-users').style.display = 'none'; // 隐藏在线用户列表
        const challengeDiv = document.createElement('div');
        challengeDiv.className = 'challenge-status';
        challengeDiv.innerHTML = `你收到了来自 ${gameState.challengedBy} 的挑战请求，请问是否接受？<br>
            <button id="accept-challenge-btn">接受</button>
            <button id="reject-challenge-btn">拒绝</button>`;
        challengeContainer.appendChild(challengeDiv);
        // 绑定按钮事件
        document.getElementById('accept-challenge-btn').onclick = function() {
            socket.emit('challenge_response', { accepted: true, challenger: gameState.challengedBy });
            gameState.challengedBy = null;
            gameState.challengingUser = null; // 确保清除挑战状态
            challengeContainer.innerHTML = '';
            document.getElementById('online-users').style.display = 'block'; // 显示在线用户列表
        };
        document.getElementById('reject-challenge-btn').onclick = function() {
            socket.emit('challenge_response', { accepted: false, challenger: gameState.challengedBy });
            gameState.challengedBy = null;
            gameState.challengingUser = null; // 确保清除挑战状态
            challengeContainer.innerHTML = '';
            document.getElementById('online-users').style.display = 'block'; // 显示在线用户列表
        };
        return;
    }

    // 如果正在挑战某人，在挑战容器中显示等待提示
    if (gameState.challengingUser) {
        document.getElementById('online-users').style.display = 'none'; // 隐藏在线用户列表
        const waitingDiv = document.createElement('div');
        waitingDiv.className = 'challenge-status';
        waitingDiv.textContent = `Waiting for ${gameState.challengingUser} to accept your challenge...`;
        challengeContainer.appendChild(waitingDiv);
        return;
    }

    // 显示在线用户列表
    document.getElementById('online-users').style.display = 'block'; // 显示在线用户列表
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

function challengeUser(username) {
    if (!gameState.isInGame) {
        gameState.challengingUser = username; // 记录正在挑战的对手
        updateUsersList([currentUser, username]); // 立即刷新UI，users参数可根据实际情况传递
        socket.emit('challenge', { opponent: username });
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

function selectAnswer(answer) {
    socket.emit('answer', { answer });
    clearInterval(gameState.timer);
}

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
    document.getElementById('online-users').style.display = 'block'; // 重置时显示在线用户列表
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    finalResult.style.display = 'none';
    waitingMessage.style.display = 'none';
    challengeContainer.innerHTML = ''; // 清空挑战容器
}

// Play again button handler
document.getElementById('play-again-btn').addEventListener('click', () => {
    finalResult.style.display = 'none';
    gameContainer.style.display = 'block';
});