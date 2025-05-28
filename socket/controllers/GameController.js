const userService = require('../services/UserService');
const gameService = require('../services/GameService');
const questions = require('../data/questions.json');

class GameController {
    constructor(io) {
        this.io = io;
        this.gameStates = new Map(); // 存储游戏状态
        this.activeGames = new Map(); // 存储活跃游戏房间信息 { gameId: {player1Id, player2Id, currentQuestionIndex} }
        console.log('Questions loaded:', questions);
    }

    handleLogin(socket, data) {
        const { username } = data;
        
        if (userService.isUsernameTaken(username)) {
            socket.emit('login_error', { message: 'Username already taken' });
            return;
        }

        userService.addUser(socket.id, username);
        socket.emit('login_success', { username });
        this.broadcastUserList();
    }

    handleLogout(socket) {
        if (userService.onlineUsers.has(socket.id)) {
            const userState = userService.getUserState(socket.id);
            const username = userService.onlineUsers.get(socket.id);

            if (userState && userState.opponent) {
                const opponentId = userState.opponent;
                const opponentSocket = this.io.sockets.sockets.get(opponentId);
                if (opponentSocket) {
                    opponentSocket.emit('opponent_disconnected', { opponentUsername: username });
                }
                // 解绑对手的状态
                const opponentUserState = userService.getUserState(opponentId);
                if (opponentUserState) {
                    userService.updateUserState(opponentId, 'idle', null); // 将对手状态设为空闲，清除对手信息
                }
            }
            
            userService.removeUser(socket.id); // 移除当前用户
            userService.updateUserState(socket.id, 'idle', null); // 清理当前用户的状态（虽然即将移除，但保持一致性）
            socket.emit('logout_success');
            this.broadcastUserList();
        }
    }

    handleDisconnect(socket) {
        if (userService.onlineUsers.has(socket.id)) {
            const userState = userService.getUserState(socket.id);
            const username = userService.onlineUsers.get(socket.id);

            if (userState && userState.opponent) {
                const opponentId = userState.opponent;
                const opponentSocket = this.io.sockets.sockets.get(opponentId);
                if (opponentSocket) {
                    opponentSocket.emit('opponent_disconnected', { opponentUsername: username });
                }
                // 解绑对手的状态
                const opponentUserState = userService.getUserState(opponentId);
                if (opponentUserState) {
                    userService.updateUserState(opponentId, 'idle', null); // 将对手状态设为空闲，清除对手信息
                }
            }
            
            userService.removeUser(socket.id);
            // 注意：用户断开连接后，其 userState 也会被 removeUser 清除，所以不需要再单独 updateUserState
            this.broadcastUserList();
        }
    }

    handleChallenge(socket, data) {
        console.log('Handling challenge:', { socketId: socket.id, data });
        const { opponent } = data;
        const result = gameService.handleChallenge(socket.id, opponent);
    
        console.log('Challenge result:', result);
    
        if (!result.success) {
            console.log('Challenge failed:', result.message);
            socket.emit('challenge_error', { message: result.message });
            return;
        }
    
        console.log('Sending challenge request to opponent:', result.opponentId);
        this.io.to(result.opponentId).emit('challenge_request', {
            challenger: result.challengerUsername
        });
        socket.emit('challenge_sent');
        
        // 广播更新后的用户列表，移除已经不是idle状态的用户
        this.broadcastUserList();
    }

    handleChallengeResponse(socket, data) {
        console.log('Handling challenge response:', data);
        const { accepted, challenger } = data;
        const result = gameService.handleChallengeResponse(socket.id, challenger, accepted);
    
        if (!result.success) {
            socket.emit('challenge_error', { message: result.message });
            return;
        }
    
        if (result.gameStarted) {
            console.log('Game started, sending game_start event');
            const player1Id = result.challengerId;
            const player2Id = socket.id;

            // 初始化双方游戏状态
            const initialGameState = {
                score: 0,
                answeredThisRound: false,
                correctThisRound: false,
                answerTimeThisRound: null,
            };
            this.gameStates.set(player1Id, { ...initialGameState });
            this.gameStates.set(player2Id, { ...initialGameState });

            // 创建活跃游戏房间信息
            const gameId = `${player1Id}-${player2Id}`;
            this.activeGames.set(gameId, {
                player1Id,
                player2Id,
                currentQuestionIndex: 0,
                // Store a reference to player states for easier access if needed
                // player1StateRef: this.gameStates.get(player1Id),
                // player2StateRef: this.gameStates.get(player2Id)
            });
            // Associate gameId with players for easier lookup
            const player1UserState = userService.getUserState(player1Id);
            if(player1UserState) player1UserState.gameId = gameId;
            const player2UserState = userService.getUserState(player2Id);
            if(player2UserState) player2UserState.gameId = gameId;


            this.io.to(player1Id).emit('game_start', {
                opponent: userService.onlineUsers.get(player2Id)
            });
            socket.emit('game_start', {
                opponent: userService.onlineUsers.get(player1Id)
            });

            const gameRoom = this.activeGames.get(gameId);
            const firstQuestion = questions.questions[gameRoom.currentQuestionIndex];
            console.log('First question data:', firstQuestion);

            if (!firstQuestion || !firstQuestion.text || !firstQuestion.type) {
                console.error('Invalid question data:', firstQuestion);
                return;
            }

            console.log('Sending question to player1:', player1Id);
            this.io.to(player1Id).emit('question', firstQuestion);
            
            console.log('Sending question to player2:', player2Id);
            socket.emit('question', firstQuestion);
        } else {
            this.io.to(result.challengerId).emit('challenge_rejected');
        }
    }

    broadcastUserList() {
        const users = userService.getAvailableUsers(); // 或者直接修改getAllUsers方法
        this.io.emit('user_list', users);
    }

    // 添加处理答案的方法
    handleAnswer(socket, data) {
        const socketId = socket.id;
        const userState = userService.getUserState(socketId);
    
        if (!userState || !userState.opponent || !userState.gameId) {
            console.log('User, opponent, or gameId not found for answer handling', socketId);
            return;
        }
    
        const gameId = userState.gameId;
        const gameRoom = this.activeGames.get(gameId);
        if (!gameRoom || gameRoom.resultProcessedForThisQuestion) {
            console.log('Game room not found or result already processed for gameId:', gameId);
            return;
        }
    
        const playerState = this.gameStates.get(socketId);
        const opponentId = userState.opponent;
        const opponentState = this.gameStates.get(opponentId);
    
        if (!playerState || !opponentState) {
            console.log('Player state or opponent state not found for answer handling');
            return;
        }
    
        if (playerState.answeredThisRound) {
            console.log('Player already answered this round:', socketId);
            return;
        }
    
        playerState.answeredThisRound = true;
        playerState.answerTimeThisRound = Date.now();
    
        if (gameRoom.currentQuestionIndex === undefined || gameRoom.currentQuestionIndex < 0 || gameRoom.currentQuestionIndex >= questions.questions.length) {
            console.error('Invalid currentQuestionIndex:', gameRoom.currentQuestionIndex, 'for gameId:', gameId);
            return;
        }
        const currentQuestion = questions.questions[gameRoom.currentQuestionIndex];
        if (!currentQuestion) {
            console.error('Current question not found for index:', gameRoom.currentQuestionIndex, 'for gameId:', gameId);
            return;
        }
    
        playerState.correctThisRound = (data.answer === currentQuestion.correct);
    
        // 检查是否双方都已作答
        if (playerState.answeredThisRound && opponentState.answeredThisRound && !gameRoom.processingResult) {
            // 双方都已作答，处理结果
            if (!gameRoom.resultProcessedForThisQuestion) {
                gameRoom.processingResult = true;
                this.processQuestionResult(gameRoom.player1Id, gameRoom.player2Id, gameId);
            }
        } else if (playerState.answeredThisRound && !opponentState.answeredThisRound) {
            // 当前玩家先提交，对方还未作答
            socket.emit('answer_received', {
                message: 'Answer received, waiting for opponent',
                waitingForOpponent: true
            });
        }
    }

    // 处理超时
    handleTimeout(socket) {
        const socketId = socket.id;
        const userState = userService.getUserState(socketId);
    
        if (!userState || !userState.opponent || !userState.gameId) {
            console.log('User or opponent or gameId not found for timeout handling', socketId);
            return;
        }
    
        const gameId = userState.gameId;
        const gameRoom = this.activeGames.get(gameId);
        if (!gameRoom || gameRoom.resultProcessedForThisQuestion) {
            console.log('Game room not found or result already processed on timeout for gameId:', gameId);
            return;
        }
    
        const playerState = this.gameStates.get(socketId);
        const opponentId = userState.opponent;
        const opponentState = this.gameStates.get(opponentId);
    
        if (!playerState || !opponentState) {
            console.log('Player state or opponent state not found for timeout handling');
            return;
        }
    
        if (playerState.answeredThisRound) {
            console.log('Player already processed this round (timeout check):', socketId);
            return;
        }
    
        // 修复：使用统一的超时时间戳
        if (!gameRoom.timeoutTimestamp) {
            gameRoom.timeoutTimestamp = Date.now();
        }
    
        playerState.answeredThisRound = true;
        playerState.answerTimeThisRound = gameRoom.timeoutTimestamp; // 使用统一时间戳
        playerState.correctThisRound = false;
        
        if (opponentState.answeredThisRound && !gameRoom.processingResult) {
            if (!gameRoom.resultProcessedForThisQuestion) {
                gameRoom.processingResult = true;
                this.processQuestionResult(gameRoom.player1Id, gameRoom.player2Id, gameId);
            }
        }
    }
    
    processQuestionResult(player1Id, player2Id, gameId) {
        const player1State = this.gameStates.get(player1Id);
        const player2State = this.gameStates.get(player2Id);
        const gameRoom = this.activeGames.get(gameId);

        if (!player1State || !player2State || !gameRoom) {
            console.error('Cannot process question result: Invalid states or game room.');
            if(gameRoom) gameRoom.processingResult = false; 
            return;
        }

        // 防止因意外情况重复处理同一问题结果
        if (gameRoom.resultProcessedForThisQuestion) {
            console.warn('Attempted to process result for a question that was already processed. GameId:', gameId, 'QuestionIndex:', gameRoom.currentQuestionIndex);
            gameRoom.processingResult = false; // 确保重置
            return;
        }

        let p1RoundScore = 0;
        let p2RoundScore = 0;

        const p1Correct = player1State.correctThisRound;
        const p2Correct = player2State.correctThisRound;
        const p1Time = player1State.answerTimeThisRound;
        const p2Time = player2State.answerTimeThisRound;

        // 确保双方都已经有回答状态（即使是超时导致的answeredThisRound = true)
        if (!player1State.answeredThisRound || !player2State.answeredThisRound) {
            console.log('processQuestionResult called before both players answered. P1 answered:', player1State.answeredThisRound, 'P2 answered:', player2State.answeredThisRound);
            gameRoom.processingResult = false; // 重置，等待双方都完成
            return;
        }

        // 在 processQuestionResult 方法中，替换现有的计分逻辑
        p1RoundScore = 0;
        p2RoundScore = 0;

        // 确定谁先交答案
        const p1First = p1Time < p2Time;
        const p2First = p2Time < p1Time;
        
        if (p1First) {
        // P1先交答案
        if (p1Correct) {
        // P1先交且答对：P1得2分，P2得0分
        p1RoundScore = 2;
        p2RoundScore = 0;
        } else {
        // P1先交但答错：P2得1分（不管P2对错）
        p1RoundScore = 0;
        p2RoundScore = 1;
        }
        } else if (p2First) {
        // P2先交答案
        if (p2Correct) {
        // P2先交且答对：P2得2分，P1得0分
        p1RoundScore = 0;
        p2RoundScore = 2;
        } else {
        // P2先交但答错：P1得1分（不管P1对错）
        p1RoundScore = 1;
        p2RoundScore = 0;
        }
        } else {
        // 同时提交（极少情况）
        if (p1Correct && p2Correct) {
        // 都答对，都得1分
        p1RoundScore = 1;
        p2RoundScore = 1;
        } else if (p1Correct && !p2Correct) {
        // P1对P2错
        p1RoundScore = 2;
        p2RoundScore = 0;
        } else if (!p1Correct && p2Correct) {
        // P1错P2对
        p1RoundScore = 0;
        p2RoundScore = 2;
        } else {
        // 都答错，都得0分
        p1RoundScore = 0;
        p2RoundScore = 0;
        }
        }

        player1State.score += p1RoundScore;
        player2State.score += p2RoundScore;
        
        gameRoom.resultProcessedForThisQuestion = true; // 标记本题结果已成功处理

        const currentQuestion = questions.questions[gameRoom.currentQuestionIndex];

        const finalRoundResultForP1 = {
            yourAnswerCorrect: player1State.correctThisRound,
            opponentAnswerCorrect: player2State.correctThisRound,
            correctAnswer: currentQuestion.correct, // 修改这里：从correctAnswer改为correct
            yourRoundScore: p1RoundScore,
            opponentRoundScore: p2RoundScore,
            yourTotalScore: player1State.score,
            opponentTotalScore: player2State.score,
            isFaster: p1First ? true : (p2First ? false : null)
        };

        const finalRoundResultForP2 = {
            yourAnswerCorrect: player2State.correctThisRound,
            opponentAnswerCorrect: player1State.correctThisRound,
            correctAnswer: currentQuestion.correct, // 修改这里：从correctAnswer改为correct
            yourRoundScore: p2RoundScore,
            opponentRoundScore: p1RoundScore,
            yourTotalScore: player2State.score,
            opponentTotalScore: player1State.score,
            isFaster: p2First ? true : (p1First ? false : null)
        };

        // 延迟发送结果，给玩家时间查看自己的即时反馈和正确答案 (现在没有即时反馈了，但延迟仍然可以用于展示回合结果)
        // 在processQuestionResult函数中，减少第一个延迟
        setTimeout(() => {
            this.io.to(player1Id).emit('round_result', finalRoundResultForP1);
            this.io.to(player2Id).emit('round_result', finalRoundResultForP2);
    
            player1State.answeredThisRound = false;
            player1State.answerTimeThisRound = null;
            player1State.correctThisRound = null; // 重置正确性

            player2State.answeredThisRound = false;
            player2State.answerTimeThisRound = null;
            player2State.correctThisRound = null; // 重置正确性
            
            gameRoom.processingResult = false; // 重置处理标记
            gameRoom.resultProcessedForThisQuestion = false; // 重置本题结果处理标记，为下一题做准备
            gameRoom.currentQuestionIndex++;
            gameRoom.questionStartTime = null; 
    
            if (gameRoom.currentQuestionIndex >= questions.questions.length || gameRoom.currentQuestionIndex >= 10) { // 改为10题
                this.handleGameOver(player1Id, player2Id, gameId);
            } else {
                // 改为10秒延迟，与前端计时器同步
                setTimeout(() => {
                    const nextQuestion = questions.questions[gameRoom.currentQuestionIndex];
                    gameRoom.questionStartTime = Date.now();
                    this.io.to(player1Id).emit('question', { ...nextQuestion, questionNumber: gameRoom.currentQuestionIndex + 1, totalQuestions: 10, questionStartTime: gameRoom.questionStartTime }); // 固定为10
                    this.io.to(player2Id).emit('question', { ...nextQuestion, questionNumber: gameRoom.currentQuestionIndex + 1, totalQuestions: 10, questionStartTime: gameRoom.questionStartTime }); // 固定为10
                }, 10000);
            }
        }, 1000);
    }

    handleGameOver(player1Id, player2Id, gameId) {
        const player1State = this.gameStates.get(player1Id);
        const player2State = this.gameStates.get(player2Id);
        const player1Username = userService.onlineUsers.get(player1Id);
        const player2Username = userService.onlineUsers.get(player2Id);

        let winner = null;
        if (player1State.score > player2State.score) {
            winner = player1Username;
        } else if (player2State.score > player1State.score) {
            winner = player2Username;
        } // else it's a tie

        const finalResultData = {
            player1: { username: player1Username, score: player1State.score },
            player2: { username: player2Username, score: player2State.score },
            winner: winner
        };

        this.io.to(player1Id).emit('final_result', finalResultData);
        this.io.to(player2Id).emit('final_result', finalResultData);

        // 清理游戏状态
        this.gameStates.delete(player1Id);
        this.gameStates.delete(player2Id);
        this.activeGames.delete(gameId);

        // 更新用户状态为空闲
        userService.updateUserState(player1Id, 'idle', null);
        userService.updateUserState(player2Id, 'idle', null);
        const p1UserState = userService.getUserState(player1Id);
        if(p1UserState) delete p1UserState.gameId;
        const p2UserState = userService.getUserState(player2Id);
        if(p2UserState) delete p2UserState.gameId;

        this.broadcastUserList(); // 更新用户列表，挑战按钮应重新启用
    }
}

module.exports = GameController;