const mongoose = require('mongoose');

exports.predict = async (req, res) => {
    try {
        const { studentId } = req.query;
        if (!studentId) return res.status(400).json({ error: 'studentId required' });
        
        const attempts = await mongoose.connection.db.collection('studentexamattempts')
            .find({ studentId, status: 'SUBMITTED' })
            .sort({ submittedAt: 1 })
            .toArray();
            
        if (attempts.length === 0) {
            return res.status(404).json({ error: 'No exam data found' });
        }

        const n = attempts.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        const yValues = [];
        
        attempts.forEach((a, i) => {
            const x = i + 1;
            const y = a.percentage || 0;
            yValues.push(y);
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });

        let m = 0, b = 0;
        if (n > 1) {
            m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            b = (sumY - m * sumX) / n;
        } else {
            b = sumY;
        }

        const nextX = n + 1;
        let predictedScore = m * nextX + b;
        predictedScore = Math.max(0, Math.min(100, predictedScore));

        let passProbability = 0;
        if (predictedScore >= 40) {
            passProbability = Math.min(100, 50 + (predictedScore - 40) * 1.5);
        } else {
            passProbability = Math.max(0, predictedScore);
        }

        let level = 'Beginner';
        if (predictedScore >= 80) level = 'Expert';
        else if (predictedScore >= 60) level = 'Intermediate';
        else if (predictedScore >= 40) level = 'Novice';

        const answers = await mongoose.connection.db.collection('studentanswers').find({ studentId }).toArray();
        const topicMap = {};
        answers.forEach(ans => {
            if (!ans.topic || !ans.topic.name) return;
            const t = ans.topic.name;
            if (!topicMap[t]) topicMap[t] = { scored: 0, max: 0 };
            topicMap[t].scored += ans.marksScored;
            topicMap[t].max += ans.maxMarks;
        });

        const topicPredictions = [];
        Object.keys(topicMap).forEach(t => {
            let pct = (topicMap[t].scored / topicMap[t].max) * 100;
            pct += m; 
            pct = Math.max(0, Math.min(100, pct));
            topicPredictions.push({
                topic: t,
                predictedPercentage: pct.toFixed(2)
            });
        });

        res.json({
            predictedScore: predictedScore.toFixed(2),
            studentLevel: level,
            passProbability: passProbability.toFixed(2) + '%',
            topicPredictions
        });

    } catch(err) {
        res.status(500).json({ error: err.message });
    }
}
