const userService = require('../services/UserService');
const gameService = require('../services/GameService');
const questions = require('../data/questions.json');

class GameController {
    constructor(io) {
        this.io = io;
        this.gameStates = new Map(); // Store game states
        this.activeGames = new Map(); // Store active game room info { gameId: {player1Id, player2Id, currentQuestionIndex} }
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
                // Unbind opponent's state
                const opponentUserState = userService.getUserState(opponentId);
                if (opponentUserState) {
                    userService.updateUserState(opponentId, 'idle', null); // Set opponent to idle, clear opponent info
                }
            }
            
            userService.removeUser(socket.id); // Remove current user
            userService.updateUserState(socket.id, 'idle', null); // Clean current user state (for consistency)
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
                // Unbind opponent's state
                const opponentUserState = userService.getUserState(opponentId);
                if (opponentUserState) {
                    userService.updateUserState(opponentId, 'idle', null); // Set opponent to idle, clear opponent info
                }
            }
            
            userService.removeUser(socket.id);
            // Note: After user disconnects, userState is also cleared by removeUser, no need for separate updateUserState
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
        
        // Broadcast updated user list, remove users not in idle state
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

            // Initialize game states for both players
            const initialGameState = {
                score: 0,
                answeredThisRound: false,
                correctThisRound: false,
                answerTimeThisRound: null,
            };
            this.gameStates.set(player1Id, { ...initialGameState });
            this.gameStates.set(player2Id, { ...initialGameState });

            // Create active game room info
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
        const users = userService.getAvailableUsers(); // Or modify getAllUsers method directly
        this.io.emit('user_list', users);
    }

    // Add answer handling method
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
    
        // Check if both players have answered
        // 在 handleAnswer 方法中，第220行附近
        if (opponentState && opponentState.answeredThisRound) {
        // Both have answered, process result
        this.processQuestionResult(gameRoom.player1Id, gameRoom.player2Id, gameId);
        } else {
        // Current player submitted first, opponent hasn't answered yet
        }
    }

    // Handle timeout
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
    
        // Fix: Use unified timeout timestamp
        if (!gameRoom.timeoutTimestamp) {
            gameRoom.timeoutTimestamp = Date.now();
        }
    
        playerState.answeredThisRound = true;
        playerState.answerTimeThisRound = gameRoom.timeoutTimestamp;
        playerState.correctThisRound = false;
        
        // 检查是否需要处理结果
        if (opponentState.answeredThisRound) {
        // 对手已经回答（或超时），立即处理结果
        if (!gameRoom.resultProcessedForThisQuestion && !gameRoom.processingResult) {
            gameRoom.processingResult = true;
            this.processQuestionResult(gameRoom.player1Id, gameRoom.player2Id, gameId);
        }
        } else {
        // 对手还没有回答，设置延迟处理
        if (!gameRoom.timeoutProcessing) {
            gameRoom.timeoutProcessing = true;
            setTimeout(() => {
                // 再次检查对手是否已经回答
                if (!opponentState.answeredThisRound && !gameRoom.resultProcessedForThisQuestion) {
                    // 对手仍然没有回答，强制设置为超时
                    opponentState.answeredThisRound = true;
                    // 修改前：
                    opponentState.answerTimeThisRound = gameRoom.timeoutTimestamp + 1;
                    
                    // 修改后：
                    opponentState.answerTimeThisRound = gameRoom.timeoutTimestamp;
                    opponentState.correctThisRound = false;
                    console.log(`[SERVER] Force timeout for opponent ${opponentId}`);
                }
                
                // 现在处理结果
                if (!gameRoom.resultProcessedForThisQuestion && !gameRoom.processingResult) {
                    gameRoom.processingResult = true;
                    this.processQuestionResult(gameRoom.player1Id, gameRoom.player2Id, gameId);
                }
                
                gameRoom.timeoutProcessing = false; // 重置标志
            }, 1000);
        }
        }
    }
    
    processQuestionResult(player1Id, player2Id, gameId) {
        console.log(`[SERVER] processQuestionResult called for game ${gameId}, p1: ${player1Id}, p2: ${player2Id}`); // 添加日志
        const player1State = this.gameStates.get(player1Id);
        const player2State = this.gameStates.get(player2Id);
        const gameRoom = this.activeGames.get(gameId);

        if (!player1State || !player2State || !gameRoom) {
            console.error('Cannot process question result: Invalid states or game room.');
            if(gameRoom) gameRoom.processingResult = false; 
            return;
        }

        // Prevent duplicate processing of same question result due to unexpected situations
        if (gameRoom.resultProcessedForThisQuestion) {
            console.log('Result already processed for this question, skipping');
            gameRoom.processingResult = false; // Ensure reset
            return;
        }

        let p1RoundScore = 0;
        let p2RoundScore = 0;

        const p1Correct = player1State.correctThisRound;
        const p2Correct = player2State.correctThisRound;
        const p1Time = player1State.answerTimeThisRound;
        const p2Time = player2State.answerTimeThisRound;

        // Ensure both players have answer status (even if caused by timeout answeredThisRound = true)
        if (!player1State.answeredThisRound || !player2State.answeredThisRound) {
            console.log('Not all players have answered yet, waiting...');
            gameRoom.processingResult = false; // Reset, wait for both to complete
            return;
        }
        
        // Replace existing scoring logic in processQuestionResult method
        p1RoundScore = 0;
        p2RoundScore = 0;

        // Determine who submitted first
        const p1First = p1Time < p2Time;
        const p2First = p2Time < p1Time;
        
        if (p1First) {
        // P1 submitted first
        if (p1Correct) {
        // P1 first and correct: P1 gets 2 points, P2 gets 0
        p1RoundScore = 2;
        p2RoundScore = 0;
        } else {
        // P1 first but wrong: P2 gets 1 point (regardless of P2's answer)
        p1RoundScore = 0;
        p2RoundScore = 1;
        }
        } else if (p2First) {
        // P2 submitted first
        if (p2Correct) {
        // P2 first and correct: P2 gets 2 points, P1 gets 0
        p1RoundScore = 0;
        p2RoundScore = 2;
        } else {
        // P2 first but wrong: P1 gets 1 point (regardless of P1's answer)
        p1RoundScore = 1;
        p2RoundScore = 0;
        }
        } else {
        // Simultaneous submission (rare case)
        if (p1Correct && p2Correct) {
        // Both correct, both get 1 point
        p1RoundScore = 1;
        p2RoundScore = 1;
        } else if (p1Correct && !p2Correct) {
        // P1 correct, P2 wrong
        p1RoundScore = 2;
        p2RoundScore = 0;
        } else if (!p1Correct && p2Correct) {
        // P1 wrong, P2 correct
        p1RoundScore = 0;
        p2RoundScore = 2;
        } else {
        // Both wrong, both get 0 points
        p1RoundScore = 0;
        p2RoundScore = 0;
        }
        }

        player1State.score += p1RoundScore;
        player2State.score += p2RoundScore;
        
        gameRoom.resultProcessedForThisQuestion = true; // Mark result as successfully processed

        const currentQuestion = questions.questions[gameRoom.currentQuestionIndex];

        const finalRoundResultForP1 = {
            yourAnswerCorrect: player1State.correctThisRound,
            opponentAnswerCorrect: player2State.correctThisRound,
            correctAnswer: currentQuestion.correct, // Fix: change from correctAnswer to correct
            yourRoundScore: p1RoundScore,
            opponentRoundScore: p2RoundScore,
            yourTotalScore: player1State.score,
            opponentTotalScore: player2State.score,
            isFaster: p1First ? true : (p2First ? false : null)
        };

        const finalRoundResultForP2 = {
            yourAnswerCorrect: player2State.correctThisRound,
            opponentAnswerCorrect: player1State.correctThisRound,
            correctAnswer: currentQuestion.correct, // Fix: change from correctAnswer to correct
            yourRoundScore: p2RoundScore,
            opponentRoundScore: p1RoundScore,
            yourTotalScore: player2State.score,
            opponentTotalScore: player1State.score,
            isFaster: p2First ? true : (p1First ? false : null)
        };

        // Delay sending results to give players time to see immediate feedback and correct answer (no immediate feedback now, but delay still useful for showing round results)
        // Reduce first delay in processQuestionResult function
        setTimeout(() => {
            console.log(`[SERVER] Emitting round_result for game ${gameId}`); // 添加日志
            this.io.to(player1Id).emit('round_result', finalRoundResultForP1);
            this.io.to(player2Id).emit('round_result', finalRoundResultForP2);
    
            player1State.answeredThisRound = false;
            player1State.answerTimeThisRound = null;
            player1State.correctThisRound = null; // Reset correctness

            player2State.answeredThisRound = false;
            player2State.answerTimeThisRound = null;
            player2State.correctThisRound = null; // Reset correctness
            
            gameRoom.processingResult = false; // Reset processing flag
            gameRoom.resultProcessedForThisQuestion = false; // Reset result processing flag for next question
            gameRoom.currentQuestionIndex++;
            gameRoom.questionStartTime = null; 
    
            if (gameRoom.currentQuestionIndex >= questions.questions.length || gameRoom.currentQuestionIndex >= 10) { // Change to 10 questions
                this.handleGameOver(player1Id, player2Id, gameId);
            } else {
                // Change to 10 second delay, sync with frontend timer
                setTimeout(() => {
                    const nextQuestion = questions.questions[gameRoom.currentQuestionIndex];
                    gameRoom.questionStartTime = Date.now();
                    this.io.to(player1Id).emit('question', { ...nextQuestion, questionNumber: gameRoom.currentQuestionIndex + 1, totalQuestions: 10, questionStartTime: gameRoom.questionStartTime }); // Fixed to 10
                    this.io.to(player2Id).emit('question', { ...nextQuestion, questionNumber: gameRoom.currentQuestionIndex + 1, totalQuestions: 10, questionStartTime: gameRoom.questionStartTime }); // Fixed to 10
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

        // Clean up game state
        this.gameStates.delete(player1Id);
        this.gameStates.delete(player2Id);
        this.activeGames.delete(gameId);

        // Update user status to idle
        userService.updateUserState(player1Id, 'idle', null);
        userService.updateUserState(player2Id, 'idle', null);
        const p1UserState = userService.getUserState(player1Id);
        if(p1UserState) delete p1UserState.gameId;
        const p2UserState = userService.getUserState(player2Id);
        if(p2UserState) delete p2UserState.gameId;

        this.broadcastUserList(); // Update user list, challenge buttons should be re-enabled
    }
}

module.exports = GameController;