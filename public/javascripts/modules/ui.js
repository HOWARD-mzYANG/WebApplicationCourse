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
    const submitBtn = document.getElementById('submit-answer-btn');
    let selectedOption = null;

    questionElement.textContent = question.text;
    optionsElement.innerHTML = '';
    submitBtn.style.display = 'inline-block';
    submitBtn.disabled = true;

    // 强制隐藏并清理之前的答题结果提示框
    const statusMessage = document.getElementById('answer-status');
    if (statusMessage) {
        statusMessage.style.display = 'none';
        statusMessage.className = '';
        statusMessage.textContent = ''; // 清空内容
    }

    // 清除问题容器的样式类
    const questionContainer = document.getElementById('question-container');
    if (questionContainer) {
        questionContainer.classList.remove('correct-answer', 'wrong-answer');
    }

    // 清除可能存在的旧计时器，并确保在显示问题后启动新的计时器
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null; // 重置计时器状态
    }
    startTimer(); // 启动计时器

    // 根据问题类型创建选项
    if (question.type === 'single') {
        question.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option';
            button.textContent = option;
            button.disabled = false;
            // 修改选项点击处理逻辑
            button.onclick = () => {
                // 清除所有选项的选中状态
                Array.from(optionsElement.children).forEach(btn => {
                    btn.classList.remove('selected');
                    btn.style.backgroundColor = ''; // 新增样式清除
                });
                
                // 设置当前选中选项
                button.classList.add('selected');
                button.style.backgroundColor = '#e0e0e0'; // 新增视觉反馈
                selectedOption = option;
                submitBtn.disabled = false;
            };
            optionsElement.appendChild(button);
        });
    }

    // 提交按钮点击事件
    submitBtn.onclick = () => {
        if (selectedOption) {
            selectAnswer(selectedOption);
            submitBtn.textContent = 'Answer submitted';
            submitBtn.disabled = true;
            
            // 禁用所有选项按钮
            Array.from(optionsElement.children).forEach(btn => btn.disabled = true);
        }
    };
}

// 在showResult函数开头添加:
function showResult(data) {
    resultContainer.style.display = 'block';
    questionContainer.style.display = 'none';
    
    // 显示正确答案
    document.getElementById('correct-answer').textContent = data.correctAnswer;
    
    // 更新总分数
    document.getElementById('your-score').textContent = data.yourTotalScore;
    document.getElementById('opponent-score').textContent = data.opponentTotalScore;
    
    // 显示答题状态
    const yourAnswerStatus = document.getElementById('your-answer-status');
    const opponentAnswerStatus = document.getElementById('opponent-answer-status');
    const speedStatus = document.getElementById('speed-status');
    
    // 你的答题状态
    if (data.yourAnswerCorrect) {
        yourAnswerStatus.innerHTML = '<span style="color: #4CAF50;">✓ 你答对了</span>';
    } else {
        yourAnswerStatus.innerHTML = '<span style="color: #f44336;">✗ 你答错了</span>';
    }
    
    // 对方的答题状态
    if (data.opponentAnswerCorrect) {
        opponentAnswerStatus.innerHTML = '<span style="color: #4CAF50;">✓ 对方答对了</span>';
    } else {
        opponentAnswerStatus.innerHTML = '<span style="color: #f44336;">✗ 对方答错了</span>';
    }
    
    // 速度比较状态
    if (data.yourAnswerCorrect && data.opponentAnswerCorrect) {
        // 双方都答对时比较速度
        if (data.isFaster === true) {
            speedStatus.innerHTML = '<span style="color: #2196F3;">🚀 你答题更快！</span>';
        } else if (data.isFaster === false) {
            speedStatus.innerHTML = '<span style="color: #FF9800;">⏱️ 对方答题更快</span>';
        } else {
            speedStatus.innerHTML = '<span style="color: #9E9E9E;">⚡ 答题速度相同</span>';
        }
    } else if (data.yourAnswerCorrect && !data.opponentAnswerCorrect) {
        speedStatus.innerHTML = '<span style="color: #4CAF50;">🎯 只有你答对了！</span>';
    } else if (!data.yourAnswerCorrect && data.opponentAnswerCorrect) {
        speedStatus.innerHTML = '<span style="color: #FF5722;">😅 只有对方答对了</span>';
    } else {
        speedStatus.innerHTML = '<span style="color: #9E9E9E;">💭 双方都答错了</span>';
    }
    
    // 隐藏原来的fastest-answer元素，因为我们用新的speed-status替代了
    const fastestAnswerElement = document.getElementById('fastest-answer');
    if (fastestAnswerElement) {
        fastestAnswerElement.style.display = 'none';
    }
    
    // 10秒后隐藏结果容器（根据之前的修改）
    setTimeout(() => {
        resultContainer.style.display = 'none';
        // 重置问题容器的样式类
        document.getElementById('question-container').classList.remove('correct-answer', 'wrong-answer');
        
        if (!data.gameOver) {
            questionContainer.style.display = 'block';
        } else {
            // 游戏结束，提交按钮不再需要
            const submitBtn = document.getElementById('submit-answer-btn');
            if (submitBtn) {
                submitBtn.style.display = 'none';
            }
        }
    }, 10000); // 改为10秒
}

function showFinalResult(data) {
    finalResult.style.display = 'block';
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    document.getElementById('timer').style.display = 'none';

    const submitBtn = document.getElementById('submit-answer-btn');
    if(submitBtn) submitBtn.style.display = 'none';
    
    // 正确解析分数数据
    const finalYourScore = document.getElementById('final-your-score');
    const finalOpponentScore = document.getElementById('final-opponent-score');
    
    // 根据当前用户名找到对应的分数
    let yourScore = 0;
    let opponentScore = 0;
    
    if (data.player1 && data.player2) {
        if (data.player1.username === currentUser) {
            yourScore = data.player1.score;
            opponentScore = data.player2.score;
        } else if (data.player2.username === currentUser) {
            yourScore = data.player2.score;
            opponentScore = data.player1.score;
        }
    }
    
    if (finalYourScore) finalYourScore.textContent = yourScore;
    if (finalOpponentScore) finalOpponentScore.textContent = opponentScore;
    
    // 获取元素
    const winnerMessage = document.getElementById('winner-message');
    const iconCircle = document.querySelector('.icon-circle');
    const resultEmoji = document.querySelector('.result-emoji');
    const resultTitle = document.querySelector('.result-title');
    
    // 清除之前的样式类
    iconCircle?.classList.remove('winner', 'loser', 'tie');
    winnerMessage?.classList.remove('winner', 'loser', 'tie');
    
    if (winnerMessage && iconCircle && resultEmoji && resultTitle) {
        if (data.winner === currentUser) {
            // 胜利
            resultTitle.textContent = '🎉 Victory! 🎉';
            resultEmoji.textContent = '👑';
            winnerMessage.textContent = '🎊 Congratulations! You are the champion! 🎊';
            iconCircle.classList.add('winner');
            winnerMessage.classList.add('winner');
        } else if (data.winner === null || data.winner === 'tie') {
            // 平局
            resultTitle.textContent = '⚖️ Draw Game ⚖️';
            resultEmoji.textContent = '🤝';
            winnerMessage.textContent = '🤝 Great match! It\'s a tie! 🤝';
            iconCircle.classList.add('tie');
            winnerMessage.classList.add('tie');
        } else {
            // 失败
            resultTitle.textContent = '💪 Game Over 💪';
            resultEmoji.textContent = '🎯';
            winnerMessage.textContent = '🔥 Good effort! Keep practicing and you\'ll win next time! 🔥';
            iconCircle.classList.add('loser');
            winnerMessage.classList.add('loser');
        }
    }
    
    // 添加庆祝效果
    if (data.winner === currentUser) {
        createConfetti();
    }
}

// 添加庆祝彩带效果
function createConfetti() {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}vw;
                top: -10px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 10000;
                animation: confettiFall 3s linear forwards;
            `;
            
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
            }, 3000);
        }, i * 50);
    }
}

// 添加彩带下落动画的CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 在resetGameState函数中（约第250行）
function resetGameState() {
    gameState.score = 0;
    gameState.opponentScore = 0;
    gameState.currentQuestion = null;
    gameState.timer = null;
    // 移除游戏模式类，恢复正常布局
    document.querySelector('.main-layout').classList.remove('game-mode');
    
    gameState.isInGame = false;
    gameState.challengingUser = null;
    gameState.challengedBy = null;
    
    document.querySelector('.right-panel').style.display = 'none';
    gameContainer.style.display = 'none';
    document.getElementById('online-users').style.display = 'block';
    questionContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    finalResult.style.display = 'none';
    waitingMessage.style.display = 'none';
    challengeContainer.style.display = 'none';
    challengeStatus.style.display = 'none';
    waitingChallenge.style.display = 'none';
    // 确保提交按钮在重置时显示，以便下一局游戏使用
    const submitBtn = document.getElementById('submit-answer-btn');
    if(submitBtn) submitBtn.style.display = 'inline-block';
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

// 在gameStarted事件监听器中（约第307行）
window.addEventListener('gameStarted', (event) => {
    console.log('Game started event received:', event.detail);
    
    // 添加游戏模式类
    document.querySelector('.main-layout').classList.add('game-mode');
    
    document.getElementById('online-users').style.display = 'none';
    document.querySelector('.right-panel').style.display = 'block';
    gameContainer.style.display = 'block';
    waitingMessage.style.display = 'block';
    challengeContainer.style.display = 'none';
    challengeStatus.style.display = 'none';
    waitingChallenge.style.display = 'none';
    
    // 游戏开始前的倒计时
    let timeLeft = 5; // 假设游戏开始前有5秒倒计时
    const countdownInterval = setInterval(() => {
        timeLeft--;
        waitingMessage.textContent = `Game starting in ${timeLeft} seconds...`; // 更新倒计时消息
        if (timeLeft < 0) {
            clearInterval(countdownInterval);
            waitingMessage.style.display = 'none';
            // questionContainer.style.display = 'block'; // 问题显示应该由 questionReceived 事件触发
        }
    }, 1000);
});

window.addEventListener('questionReceived', (event) => {
    console.log('Question received:', event.detail);
    if (!event.detail) {
        console.error('Invalid question data');
        return;
    }
    // 调用 showQuestion 函数来统一处理问题显示和选项绑定逻辑
    showQuestion(event.detail);
    questionContainer.style.display = 'block'; // 确保问题容器显示
});

window.addEventListener('gameResult', (event) => {
    showResult(event.detail);
});

// 在其他事件监听器附近添加（约第385行后）
window.addEventListener('finalResult', (event) => {
    showFinalResult(event.detail);
});

window.addEventListener('opponentDisconnected', () => {
    alert('Your opponent has disconnected');
    resetGameState();
});

// 修改 answerReceived 事件处理
window.addEventListener('answerReceived', (event) => {
    const data = event.detail;
    
    if (data.message) {
        const submitBtn = document.getElementById('submit-answer-btn');
        if (submitBtn) {
            submitBtn.textContent = 'Waiting for opponent...';
            submitBtn.disabled = true;
        }
        
        // 显示等待对手的消息
        const statusMessage = document.getElementById('answer-status') || createStatusMessage();
        statusMessage.textContent = 'Opponent has not answered yet';
        statusMessage.className = 'status-waiting';
        statusMessage.style.display = 'block';
        
        // 选项按钮保持禁用状态
        const optionsElement = document.getElementById('options');
        if (optionsElement) {
            Array.from(optionsElement.children).forEach(btn => btn.disabled = true);
        }
    }
});

// 修改 roundResult 事件处理中的显示逻辑
window.addEventListener('roundResult', (event) => {
    const data = event.detail;
    
    // 显示结果容器
    resultContainer.style.display = 'block';
    questionContainer.style.display = 'none';
    
    // 显示正确答案 - 添加调试和确保显示
    const correctAnswerElement = document.getElementById('correct-answer');
    if (correctAnswerElement && data.correctAnswer) {
        correctAnswerElement.textContent = data.correctAnswer;
        correctAnswerElement.style.display = 'inline'; // 确保元素可见
        console.log('正确答案已设置:', data.correctAnswer); // 调试信息
    } else {
        console.error('无法设置正确答案:', { element: correctAnswerElement, answer: data.correctAnswer });
    }
    
    // 更新总分数
    document.getElementById('your-score').textContent = data.yourTotalScore;
    document.getElementById('opponent-score').textContent = data.opponentTotalScore;
    
    // 显示答题结果 - 修改为新的提示词格式
    const fastestAnswerElement = document.getElementById('fastest-answer');
    if (fastestAnswerElement) {
        // 根据新的计分规则生成提示词
        let message = '';
        
        if (data.isFaster === true) {
            // 当前用户先交
            if (data.yourAnswerCorrect) {
                message = `You submitted first and answered correctly, so you get ${data.yourRoundScore} points.`;
            } else {
                message = `You submitted first but answered incorrectly, so you get ${data.yourRoundScore} points.`;
            }
        } else if (data.isFaster === false) {
            // 对手先交
            if (data.opponentAnswerCorrect) {
                message = `Opponent submitted first and answered correctly, so you get ${data.yourRoundScore} points.`;
            } else {
                message = `Opponent submitted first and answered incorrectly, so you get ${data.yourRoundScore} points.`;
            }
        } else {
            // 同时提交或其他情况
            message = `Both submitted simultaneously, so you get ${data.yourRoundScore} points.`;
        }
        
        fastestAnswerElement.textContent = message;
        fastestAnswerElement.style.display = 'block';
    }
    
    // 处理回合结果显示 - 也可以修改为英语
    const statusMessage = document.getElementById('answer-status') || createStatusMessage();
    
    if (data.yourAnswerCorrect) {
        statusMessage.textContent = '🎉 Correct Answer!';
        statusMessage.className = 'status-correct';
    } else {
        statusMessage.textContent = '❌ Wrong Answer!';
        statusMessage.className = 'status-wrong';
    }
    statusMessage.style.display = 'block';
    
    // 恢复按钮状态
    const submitBtn = document.getElementById('submit-answer-btn');
    if (submitBtn) {
        submitBtn.textContent = 'Submit Answer'; // 改为英文
        submitBtn.disabled = true;
    }
});

// 添加 resultTimerEnd 事件监听器
window.addEventListener('resultTimerEnd', () => {
    // 隐藏结果容器，准备接收新题目
    resultContainer.style.display = 'none';
    const statusMessage = document.getElementById('answer-status');
    if (statusMessage) {
        statusMessage.style.display = 'none';
    }
    document.getElementById('question-container').classList.remove('correct-answer', 'wrong-answer');
    
    // 注意：不在这里显示问题容器，等待服务器发送新题目
});

// 确保 questionReceived 事件能正确显示新题目
window.addEventListener('questionReceived', (event) => {
    console.log('Question received:', event.detail);
    if (!event.detail) {
        console.error('Invalid question data');
        return;
    }
    
    // 确保结果容器隐藏
    resultContainer.style.display = 'none';
    
    // 调用 showQuestion 函数来统一处理问题显示和选项绑定逻辑
    showQuestion(event.detail);
    questionContainer.style.display = 'block';
});

// 辅助函数：创建状态消息元素（如果不存在）
function createStatusMessage() {
    let statusMessage = document.getElementById('answer-status');
    if (!statusMessage) {
        statusMessage = document.createElement('div');
        statusMessage.id = 'answer-status';
        statusMessage.style.padding = '12px';
        statusMessage.style.borderRadius = '8px';
        statusMessage.style.textAlign = 'center';
        statusMessage.style.fontWeight = 'bold';
        statusMessage.style.fontSize = '16px';
        statusMessage.style.border = '2px solid';
        statusMessage.style.display = 'none'; // 默认隐藏
        
        // 将状态栏添加到专门的wrapper中
        const statusWrapper = document.getElementById('answer-status-wrapper');
        if (statusWrapper) {
            statusWrapper.appendChild(statusMessage);
        }
    }
    return statusMessage;
}

// 移除重复的 gameOver 事件监听器
// window.addEventListener('gameOver', (event) => {
//     showFinalResult(event.detail);
// });

// 移除重复的 opponentDisconnected 事件监听器
// window.addEventListener('opponentDisconnected', () => {
//     alert('Your opponent has disconnected');
//     resetGameState();
// });

export {
    showUserInfo,
    showLoginForm,
    updateUsersList,
    showQuestion,
    showResult,
    showFinalResult,
    resetGameState
};

// 移除文件末尾的 setTimeout 错误处理，因为它逻辑不明确且可能与正常流程冲突
// setTimeout(() => {
//     if (!gameState.isInGame) {
//         const submitBtn = document.getElementById('submit-answer-btn');
//         if(submitBtn) {
//             submitBtn.textContent = '提交失败，请重试！';
//             setTimeout(() => submitBtn.textContent = 'Submit Answer', 2000);
//             setTimeout(() => submitBtn.textContent = 'Submit Answer', 2000);
//         }
//     }
// }, 5000);
// 在事件监听器部分添加
document.getElementById('play-again-btn').addEventListener('click', () => {
    // 重置游戏状态
    resetGameState();
    
    // 显示用户列表，隐藏最终结果
    finalResult.style.display = 'none';
    const userList = document.getElementById('user-list');
    if(userList) userList.style.display = 'block';
    
    const challengeSection = document.getElementById('challenge-section');
    if(challengeSection) challengeSection.style.display = 'block';
    
    // 重新获取用户列表
    socket.emit('get_users');
});
// 添加 timeUp 事件监听器，处理超时情况
// 添加 timeUp 事件监听器，处理超时情况
window.addEventListener('timeUp', () => {
    console.log('Time up detected, sending timeout to server');
    socket.emit('timeout');
});
