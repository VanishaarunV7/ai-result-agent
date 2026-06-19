# AI Result Agent

This is a Node.js API built with Express and Mongoose to track student results, analyze their performance by topics and outcomes, and provide insights.

## Prerequisites
- Node.js installed
- MongoDB connection string (update in `.env`)

## Setup Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Update the `.env` file with your MongoDB connection string. Currently it connects to a local MongoDB instance by default. If you use MongoDB Atlas, paste your connection string here.
   ```env
   MONGO_URI=your_mongodb_connection_string_here
   PORT=5000
   ```

3. **Seed Dummy Data**
   Run the seed script to populate the database with test data:
   ```bash
   node seed/seedData.js
   ```

4. **Run the Application**
   ```bash
   node app.js
   ```
   The server will start on `http://localhost:5000`.

## API Endpoints

### 1. Exam Summary
Returns the topic-wise and outcome-wise performance for a specific student in a specific exam.
- **URL**: `GET /api/result-agent/exam-summary`
- **Query Params**: `studentId`, `examId`
- **Example Request**:
  ```
  GET http://localhost:5000/api/result-agent/exam-summary?studentId=stu_001&examId=exam_001
  ```

### 2. Overall Summary
Returns the overall topic-wise and outcome-wise performance for a student across all exams.
- **URL**: `GET /api/result-agent/overall-summary`
- **Query Params**: `studentId`
- **Example Request**:
  ```
  GET http://localhost:5000/api/result-agent/overall-summary?studentId=stu_001
  ```

### 3. Chat
Provides a natural language answer identifying the student's weakest topic based on all exams.
- **URL**: `POST /api/result-agent/chat`
- **Body (JSON)**:
  ```json
  {
    "studentId": "stu_001",
    "question": "Which topic should I improve?"
  }
  ```
