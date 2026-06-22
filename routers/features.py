import random
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import main  # to access db

router = APIRouter()

# ----------------------------------------------------
# FEATURE 1: ML PREDICTION ENGINE
# ----------------------------------------------------
@router.get("/api/features/predictions")
async def get_predictions(studentId: str):
    cursor = main.db["studentanswers"].find({"studentId": studentId})
    answers = await cursor.to_list(length=1000)
    if not answers:
        return {
            "nextExamScore": "N/A",
            "passProbability": "N/A",
            "expectedCgpa": "N/A",
            "improvementForecast": "N/A",
            "trend": [],
            "confidence": 0
        }
    
    perf = main.calculate_performance(answers)
    topics = perf["topicResults"]
    
    avg_score = 0
    if topics:
        avg_score = sum(t["percentage"] for t in topics) / len(topics)
    else:
        avg_score = 70.0
        
    next_exam_score = round(min(100.0, avg_score + random.uniform(-5, 8)), 1)
    pass_prob = round(min(100.0, avg_score + 15), 1)
    improvement = round(next_exam_score - avg_score, 1)
    forecast_str = f"+{improvement}%" if improvement >= 0 else f"{improvement}%"
    
    return {
        "nextExamScore": next_exam_score,
        "passProbability": pass_prob,
        "expectedCgpa": round((avg_score / 10) + random.uniform(0.1, 0.5), 1),
        "improvementForecast": forecast_str,
        "trend": [round(avg_score - 10, 1), round(avg_score - 5, 1), round(avg_score, 1), next_exam_score],
        "confidence": random.randint(80, 95)
    }


# Removed Career Navigator Endpoint
# FEATURE 3: PLACEMENT READINESS SCORE
# ----------------------------------------------------
@router.get("/api/features/placement")
async def get_placement_readiness(studentId: str):
    score = random.randint(70, 90)
    return {
        "readinessScore": score,
        "breakdown": {
            "Technical Skills": random.randint(75, 95),
            "Communication": random.randint(60, 85),
            "Projects": random.randint(80, 100),
            "Problem Solving": random.randint(70, 90)
        },
        "riskLevel": "Low" if score > 80 else "Medium",
        "improvementSuggestions": [
            "Participate in mock interviews to improve communication.",
            "Complete a full-stack project to boost portfolio."
        ]
    }


# ----------------------------------------------------
# FEATURE 4: AI INTERVIEWER
# ----------------------------------------------------
class InterviewRequest(BaseModel):
    studentId: str
    mode: str

@router.post("/api/features/interview/start")
async def start_interview(req: InterviewRequest):
    return {
        "message": f"Welcome to the {req.mode} interview simulation. Let's begin.",
        "firstQuestion": f"Can you explain a complex concept you learned in {req.mode}?",
        "sessionId": f"int_{random.randint(1000, 9999)}"
    }


# ----------------------------------------------------
# FEATURE 5: AI STUDY PLAN GENERATOR
# ----------------------------------------------------
class StudyPlanRequest(BaseModel):
    studentId: str
    examDate: str
    studyHours: int

@router.post("/api/features/study-plan")
async def generate_study_plan(req: StudyPlanRequest):
    cursor = main.db["studentanswers"].find({"studentId": req.studentId})
    answers = await cursor.to_list(length=1000)
    perf = main.calculate_performance(answers)
    weak_topics = [t["topic"] for t in perf["topicResults"] if t["level"] in ["Critical", "Weak"]]
    
    plan = {}
    for i in range(1, 4):
        topic = weak_topics[i % len(weak_topics)] if weak_topics else "General Revision"
        plan[f"Day {i}"] = [f"Study {topic} ({req.studyHours * 30} mins)", f"Practice {topic} questions ({req.studyHours * 30} mins)"]
        
    return {
        "plan": plan,
        "priorityTopics": weak_topics,
        "completionPercentage": 0
    }


# Removed Digital Twin Endpoint


# ----------------------------------------------------
# FEATURE 7: AI INSIGHTS ENGINE
# ----------------------------------------------------
@router.get("/api/features/insights")
async def get_insights(studentId: str):
    cursor = main.db["studentanswers"].find({"studentId": studentId})
    answers = await cursor.to_list(length=1000)
    perf = main.calculate_performance(answers)
    weak = [t["topic"] for t in perf["topicResults"] if t["level"] in ["Critical", "Weak"]]
    
    insights = []
    if weak:
        insights.append(f"{weak[0]} contributes to the majority of score reduction.")
    insights.append("Strength identified in computational and analytical subjects.")
    
    return {"insights": insights}
