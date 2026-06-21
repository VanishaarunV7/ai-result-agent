# ai-result-agent
An intelligent student result analysis agent built for EduTech platforms. It analyzes exam performance topic-wise and outcome-wise, and answers student questions in natural language using Groq AI.

---

## 📌 Project Overview

Traditional result systems only show total marks. This agent goes deeper:

- Finds **weak topics** and **weak outcomes** from question-level marks
- Answers natural language questions like *"Which topic should I improve?"*
- Detects if a student asks about an exam that was never conducted
- Compares performance across multiple exams to track improvement

---

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | REST API framework |
| MongoDB Atlas | Cloud NoSQL database |
| Mongoose | MongoDB ODM |
| Groq AI (LLaMA 3.3-70b) | Natural language response generation |
| Postman | API testing |

---

## 📁 Project Structure

```
ai-result-agent/
├── controllers/
│   └── resultAgentController.js   # API logic + Groq AI integration
├── models/
│   ├── student.js
│   ├── exam.js
│   ├── topic.js
│   ├── outcome.js
│   ├── examQuestion.js
│   ├── studentExamAttempt.js
│   └── studentAnswer.js
├── routes/
│   └── resultAgent.js             # API route definitions
├── seed/
│   └── seedData.js                # Dummy data insertion script
├── index.html                     # Chat UI for students
├── app.js                         # Express server entry point
├── .env                           # Environment variables (not committed)
├── package.json
└── README.md
```

---

## 🗄️ Database Collections

| Collection | Records | Description |
|---|---|---|
| students | 10 | Student basic info |
| exams | 3 | Exam master data |
| topics | 4 | Topic master (Journal Entries, Ledger Posting, etc.) |
| outcomes | 4 | Outcome tags (CO1, CO2, CO3, CO4) |
| exam_questions | 30 | 10 questions per exam |
| student_exam_attempts | 30 | One attempt per student per exam |
| student_answers | 300 | Question-wise marks (10 students × 10 questions × 3 exams) |

---

## ⚙️ Setup Instructions

### 1. Clone / Download the project
```bash
cd ai-result-agent
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root folder:
```env
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/ai_result_db?retryWrites=true&w=majority
PORT=5000
GROQ_API_KEY=gsk_your_groq_api_key_here
```

### 4. Insert dummy data
```bash
npm run seed
```
Expected output:
```
✅ Inserted 10 students
✅ Inserted 3 exams
✅ Inserted 300 student answers
🎉 Seed complete!
```

### 5. Start the server
```bash
node app.js
```
Expected output:
```
Server running on port 5000
MongoDB connected
```

---

## 🌐 API Endpoints

### API 1 — Exam Summary
Returns topic-wise and outcome-wise performance for a specific exam.

```
GET /api/result-agent/exam-summary?studentId=stu_001&examId=exam_001
```

**Sample Response:**
```json
{
  "studentId": "stu_001",
  "examId": "exam_001",
  "examName": "English Internal Test 1",
  "marksScored": 54,
  "totalMarks": 100,
  "percentage": 54,
  "topicResults": [
    { "topic": "Ledger Posting", "scored": 7, "max": 20, "percentage": 35, "level": "Critical" }
  ],
  "outcomeResults": [
    { "outcome": "CO2 - Apply Rules", "scored": 9, "max": 20, "percentage": 45, "level": "Weak" }
  ]
}
```

---

### API 2 — Overall Summary
Returns performance across all completed exams.

```
GET /api/result-agent/overall-summary?studentId=stu_001
```

**Sample Response:**
```json
{
  "studentId": "stu_001",
  "totalExamsAttended": 3,
  "examSummaries": [...],
  "topicResults": [...],
  "outcomeResults": [...]
}
```

---

### API 3 — Chat Agent (AI-powered)
Accepts natural language questions and returns intelligent answers.

```
POST /api/result-agent/chat
Content-Type: application/json

{
  "studentId": "stu_001",
  "question": "Which topic should I improve?"
}
```

**Sample Response:**
```json
{
  "answer": "Your weakest topic is Ledger Posting where you scored 48.33%. Focus on revising debit and credit rules to improve.",
  "weakTopics": ["Ledger Posting", "Final Accounts"],
  "weakOutcomes": ["CO2 - Apply Rules", "CO4 - Prepare Statements"]
}
```

---

## 🤖 Agent Question Handling

| Student Question | Agent Behavior |
|---|---|
| "Physics exam nadakala?" | Detects unknown exam → "That exam has not been conducted." |
| "Which topic should I improve?" | Finds weakest topic with marks and percentage |
| "Am I improving?" | Compares latest vs previous exam score |
| "How was my last exam?" | Returns latest exam summary |
| "Which outcome is weak?" | Returns outcome-wise performance |
| "Give me a study plan" | Creates plan based on weak topics and outcomes |

---

## 📊 Performance Level Rules

| Percentage | Level | Meaning |
|---|---|---|
| 0 - 40% | Critical 🔴 | Needs strong revision |
| 41 - 60% | Weak 🟡 | Needs improvement |
| 61 - 75% | Average 🔵 | Okay but can improve |
| 76 - 100% | Good 🟢 | Performing well |

---

## 🧮 Calculation Formula

**Topic Percentage:**
```
topicPercentage = (sum of marksScored for topic / sum of maxMarks for topic) × 100
```

**Outcome Percentage:**
```
outcomePercentage = (sum of marksScored for outcome / sum of maxMarks for outcome) × 100
```

---

## ✅ Acceptance Criteria

- [x] Student can ask: "Which topic should I improve?"
- [x] Agent checks all submitted exams of that student
- [x] Agent identifies lowest topic and lowest outcome
- [x] Agent gives marks, percentage, level, and short answer
- [x] If examId given → exam-specific response
- [x] If examId not given → overall response across all exams
- [x] Unknown exam → "That exam has not been conducted"
- [x] Groq AI generates natural language answers
