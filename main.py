import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

import logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Database instance
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db
    client = AsyncIOMotorClient(MONGO_URI, tls=True, serverSelectionTimeoutMS=5000)
    db = client.get_database("test") # Using test as default db if not specified in URI
    logging.info("MongoDB connected via Motor")
    yield
    client.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.chat import router as chat_router
from routers.features import router as features_router

app.include_router(chat_router)
app.include_router(features_router)

# Helper function equivalent to calculatePerformance
def calculate_performance(answers):
    topic_map = {}
    outcome_map = {}
    
    for ans in answers:
        topic = ans.get("topic", {}).get("name")
        if not topic:
            continue
            
        if topic not in topic_map:
            topic_map[topic] = {"scored": 0, "max": 0}
        topic_map[topic]["scored"] += ans.get("marksScored", 0)
        topic_map[topic]["max"] += ans.get("maxMarks", 0)
        
        outcomes = ans.get("outcomes", [])
        for oc in outcomes:
            key = f"{oc.get('code')} - {oc.get('name')}"
            if key not in outcome_map:
                outcome_map[key] = {"scored": 0, "max": 0}
            outcome_map[key]["scored"] += ans.get("marksScored", 0)
            outcome_map[key]["max"] += ans.get("maxMarks", 0)

    def get_level(pct):
        if pct <= 40: return 'Critical'
        if pct <= 60: return 'Weak'
        if pct <= 75: return 'Average'
        return 'Good'

    topic_results = []
    for name, val in topic_map.items():
        if val["max"] > 0:
            pct = round((val["scored"] / val["max"]) * 100, 2)
            topic_results.append({"topic": name, "scored": val["scored"], "max": val["max"], "percentage": pct, "level": get_level(pct)})
            
    topic_results.sort(key=lambda x: x["percentage"])

    outcome_results = []
    for name, val in outcome_map.items():
        if val["max"] > 0:
            pct = round((val["scored"] / val["max"]) * 100, 2)
            outcome_results.append({"outcome": name, "scored": val["scored"], "max": val["max"], "percentage": pct, "level": get_level(pct)})
            
    outcome_results.sort(key=lambda x: x["percentage"])

    return {"topicResults": topic_results, "outcomeResults": outcome_results}

async def get_raw_attempts(student_id: str):
    cursor = db["studentexamattempts"].find({"studentId": student_id, "status": "SUBMITTED"})
    docs = await cursor.to_list(length=100)
    return docs

@app.get("/api/result-agent/exam-summary")
async def exam_summary(studentId: str, examId: str):
    if not studentId or not examId:
        raise HTTPException(status_code=400, detail="studentId and examId required")
        
    cursor = db["studentanswers"].find({"studentId": studentId, "examId": examId})
    answers = await cursor.to_list(length=1000)
    
    if not answers:
        raise HTTPException(status_code=404, detail="No answers found")
        
    perf = calculate_performance(answers)
    attempts = await get_raw_attempts(studentId)
    
    attempt = next((a for a in attempts if a.get("examId") == examId), {})
    
    return {
        "studentId": studentId,
        "examId": examId,
        "examName": attempt.get("examName", answers[0].get("examName")),
        "totalMarks": attempt.get("totalMarks", 100),
        "marksScored": attempt.get("marksScored", 0),
        "percentage": attempt.get("percentage", 0),
        "topicResults": perf["topicResults"],
        "outcomeResults": perf["outcomeResults"]
    }

@app.get("/api/result-agent/overall-summary")
async def overall_summary(studentId: str):
    if not studentId:
        raise HTTPException(status_code=400, detail="studentId required")
        
    cursor = db["studentanswers"].find({"studentId": studentId})
    answers = await cursor.to_list(length=5000)
    
    if not answers:
        raise HTTPException(status_code=404, detail="No data found")
        
    attempts = await get_raw_attempts(studentId)
    perf = calculate_performance(answers)
    
    exam_summaries = []
    for a in attempts:
        exam_summaries.append({
            "examId": a.get("examId"),
            "examName": a.get("examName"),
            "marksScored": a.get("marksScored"),
            "totalMarks": a.get("totalMarks"),
            "percentage": a.get("percentage"),
            "submittedAt": a.get("submittedAt")
        })
        
    return {
        "studentId": studentId,
        "totalExamsAttended": len(attempts),
        "examSummaries": exam_summaries,
        "topicResults": perf["topicResults"],
        "outcomeResults": perf["outcomeResults"]
    }

# Implement mock or basic stubs for Phase 2 new features to unblock UI dev
@app.get("/api/features/predictions")
async def get_predictions(studentId: str):
    import random
    cursor = db["studentanswers"].find({"studentId": studentId})
    answers = await cursor.to_list(length=100)
    perf = calculate_performance(answers)
    topics = perf["topicResults"]
    
    avg_score = 0
    if topics:
        avg_score = sum(t["percentage"] for t in topics) / len(topics)
    else:
        avg_score = 70.0
        
    next_exam_score = round(min(100.0, avg_score + random.uniform(-5, 8)), 1)
    pass_prob = round(min(100.0, avg_score + 15), 1)
    
    return {
        "nextExamScore": next_exam_score,
        "passProbability": pass_prob,
        "expectedCgpa": round((avg_score / 10) + random.uniform(0.1, 0.5), 1),
        "trend": [avg_score - 10, avg_score - 5, avg_score, next_exam_score],
        "confidence": 85
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)
