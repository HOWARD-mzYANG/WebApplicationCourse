const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 读取题目数据
const questionsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/questions.json'), 'utf8'));

// 获取答题页面
router.get('/', (req, res) => {
    res.render('quiz', {
        questions: questionsData.questions,
        currentQuestion: 0,
        showResult: false,
        score: 0
    });
});

// 处理答题提交
router.post('/', (req, res) => {
    const { questionIndex, answer } = req.body;
    const currentQuestion = parseInt(questionIndex);
    const score = parseInt(req.body.score || 0);

    // 检查答案
    const question = questionsData.questions[currentQuestion];
    const isCorrect = question.type === 'boolean' 
        ? answer === question.correct.toString()
        : answer === question.correct;

    // 更新分数
    const newScore = isCorrect ? score + 1 : score;

    // 如果是最后一题，显示结果
    if (currentQuestion === questionsData.questions.length - 1) {
        res.render('quiz', {
            questions: questionsData.questions,
            showResult: true,
            score: newScore
        });
    } else {
        // 否则显示下一题
        res.render('quiz', {
            questions: questionsData.questions,
            currentQuestion: currentQuestion + 1,
            showResult: false,
            score: newScore
        });
    }
});

module.exports = router; 