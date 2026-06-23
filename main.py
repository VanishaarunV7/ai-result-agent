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
    
    # Program-based filtering
    program = await get_student_program(studentId)
    if program:
        program_course_names = [c.lower() for c in program.get("courses", [])]
        
        # Get all exams to map examId to courseName
        exams_cursor = db["exams"].find({})
        exams_list = await exams_cursor.to_list(length=100)
        exam_id_to_course = {e["_id"]: e.get("courseName", "").lower() for e in exams_list}
        exam_id_to_course.update({e.get("examId", ""): e.get("courseName", "").lower() for e in exams_list if e.get("examId")})
        
        def is_allowed(exam_id, exam_name):
            course_name = exam_id_to_course.get(exam_id, "")
            exam_name_lower = exam_name.lower()
            return any(c in course_name or c in exam_name_lower for c in program_course_names)
            
        attempts = [a for a in attempts if is_allowed(a.get("examId"), a.get("examName", ""))]
        answers = [ans for ans in answers if is_allowed(ans.get("examId"), ans.get("examName", ""))]

    if not answers:
        raise HTTPException(status_code=404, detail="No data found")

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

# ────────────────────────────────────────────────────────────────────────────
# EXAM SCHEDULE — real per-student data from exam_schedule collection
# ────────────────────────────────────────────────────────────────────────────
from datetime import date as _date

def _serialize_exam(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


async def _find_student(student_id: str) -> dict | None:
    student = await db["students"].find_one({"_id": student_id})
    if not student:
        student = await db["students"].find_one({"student_id": student_id})
    return student


async def get_student_program(student_id: str) -> dict | None:
    """Return program document for a student, or None if not assigned."""
    student = await _find_student(student_id)
    if not student or not student.get("program_id"):
        return None
    return await db["programs"].find_one({"program_id": student["program_id"]})


async def get_program_course_names(student_id: str) -> list[str]:
    program = await get_student_program(student_id)
    if not program:
        return []
    return program.get("courses", [])


@app.get("/students/{student_id}/program")
async def get_student_program_endpoint(student_id: str):
    """Return the academic program assigned to a student."""
    program = await get_student_program(student_id)
    if not program:
        raise HTTPException(status_code=404, detail="No academic program assigned")
    return {
        "program_id": program["program_id"],
        "program_name": program["program_name"],
    }


@app.get("/students/{student_id}/courses")
async def get_student_program_courses(student_id: str):
    """Return program name and course list for a student."""
    program = await get_student_program(student_id)
    if not program:
        raise HTTPException(status_code=404, detail="No academic program assigned")
    return {
        "program_name": program["program_name"],
        "courses": program.get("courses", []),
    }


@app.get("/students/{student_id}/dashboard")
async def get_student_dashboard(student_id: str):
    """Aggregated dashboard: student info, program, courses, exams, analytics."""
    student = await _find_student(student_id)
    program = await get_student_program(student_id)

    student_info = {
        "student_id": student_id,
        "name": student.get("name", student_id) if student else student_id,
        "academic_no": student.get("academicNo", "") if student else "",
    }

    program_info = None
    courses: list[str] = []
    if program:
        program_info = {
            "program_id": program["program_id"],
            "program_name": program["program_name"],
        }
        courses = program.get("courses", [])

    cursor = db["studentanswers"].find({"studentId": student_id})
    answers = await cursor.to_list(length=5000)
    attempts = await get_raw_attempts(student_id)

    # Filter attempts and answers by program courses
    if program and courses:
        program_course_names_lower = [c.lower() for c in courses]
        
        # Get all exams to map examId to courseName
        exams_cursor = db["exams"].find({})
        exams_list = await exams_cursor.to_list(length=100)
        exam_id_to_course = {e["_id"]: e.get("courseName", "").lower() for e in exams_list}
        exam_id_to_course.update({e.get("examId", ""): e.get("courseName", "").lower() for e in exams_list if e.get("examId")})
        
        def is_allowed(exam_id, exam_name):
            course_name = exam_id_to_course.get(exam_id, "")
            exam_name_lower = exam_name.lower()
            return any(c in course_name or c in exam_name_lower for c in program_course_names_lower)
            
        attempts = [a for a in attempts if is_allowed(a.get("examId"), a.get("examName", ""))]
        answers = [ans for ans in answers if is_allowed(ans.get("examId"), ans.get("examName", ""))]

    perf = calculate_performance(answers) if answers else {"topicResults": [], "outcomeResults": []}

    exam_summaries = []
    for a in attempts:
        exam_summaries.append({
            "examId": a.get("examId"),
            "examName": a.get("examName"),
            "marksScored": a.get("marksScored"),
            "totalMarks": a.get("totalMarks"),
            "percentage": a.get("percentage"),
            "submittedAt": a.get("submittedAt"),
        })

    today_str = _date.today().isoformat()
    upcoming_exams = []
    if courses:
        query = {
            "student_id": student_id,
            "exam_date": {"$gte": today_str},
            "course": {"$in": courses},
        }
        cursor = db["exam_schedule"].find(query).sort("exam_date", 1)
        upcoming_exams = [_serialize_exam(e) for e in await cursor.to_list(length=100)]

    # Sort exam summaries chronologically for overall percentage
    sorted_summaries = sorted(exam_summaries, key=lambda x: x.get("submittedAt", ""))
    overall_percentage = sorted_summaries[-1]["percentage"] if sorted_summaries else None

    analytics = {
        "totalExamsAttended": len(exam_summaries),
        "topicResults": perf["topicResults"],
        "outcomeResults": perf["outcomeResults"],
        "overallPercentage": overall_percentage,
    }

    return {
        "student": student_info,
        "program": program_info,
        "courses": courses,
        "exam_summaries": exam_summaries,
        "upcoming_exams": upcoming_exams,
        "analytics": analytics,
    }


@app.get("/students/{student_id}/assigned-courses")
async def get_student_assigned_courses(student_id: str):
    """Return program courses with details for a student."""
    program = await get_student_program(student_id)
    if not program:
        return []
    course_names = program.get("courses", [])
    cursor = db["courses"].find({"program_id": program["program_id"]})
    courses = await cursor.to_list(length=100)
    course_map = {c["course_name"]: c for c in courses}
    ordered_courses = []
    for name in course_names:
        if name in course_map:
            c = course_map[name]
            ordered_courses.append({
                "course_id": c["course_id"],
                "course_name": c["course_name"],
                "department": c.get("department", ""),
            })
        else:
            ordered_courses.append({
                "course_id": name,
                "course_name": name,
                "department": program["program_name"],
            })
    return ordered_courses


@app.get("/students/{student_id}/exam-schedule")
async def get_student_exam_schedule(student_id: str):
    """Return all upcoming exams for a student, sorted by date ascending, filtered by assigned courses."""
    today_str = _date.today().isoformat()          # e.g. "2026-06-22"
    
    assigned_names = await get_program_course_names(student_id)
    if not assigned_names:
        logging.info(f"No program courses found for student: {student_id}")
        return []
    
    query = {
        "student_id": student_id,
        "exam_date": {"$gte": today_str},
        "course": {"$in": assigned_names}
    }
    logging.info(f"API Request Student ID: {student_id}")
    logging.info(f"Mongo Query: {query}")
    
    cursor = db["exam_schedule"].find(query).sort("exam_date", 1)
    exams = await cursor.to_list(length=100)
    
    result_count = len(exams)
    logging.info(f"Result Count: {result_count}")
    return [_serialize_exam(e) for e in exams]


@app.get("/students/{student_id}/next-exam")
async def get_student_next_exam(student_id: str):
    """Return the single next upcoming exam for a student, filtered by assigned courses."""
    today_str = _date.today().isoformat()
    
    assigned_names = await get_program_course_names(student_id)
    if not assigned_names:
        logging.info(f"No program courses found for student (next-exam): {student_id}")
        return {}
    
    query = {
        "student_id": student_id,
        "exam_date": {"$gte": today_str},
        "course": {"$in": assigned_names}
    }
    logging.info(f"API Request Student ID (next-exam): {student_id}")
    logging.info(f"Mongo Query: {query}")
    
    cursor = db["exam_schedule"].find(query).sort("exam_date", 1).limit(1)
    exams = await cursor.to_list(length=1)
    
    result_count = len(exams)
    logging.info(f"Result Count: {result_count}")
    if not exams:
        return {}                                   # empty dict → frontend shows "no exam"
    return _serialize_exam(exams[0])


# ── keep old helpers for backward-compat (chatbot still uses them) ────────────
async def get_student_courses(student_id: str):
    cursor = db["studentexamattempts"].find({"studentId": student_id})
    attempts = await cursor.to_list(length=100)
    exam_ids = list(set([a.get("examId") for a in attempts if a.get("examId")]))
    courses_cursor = db["exams"].find({"_id": {"$in": exam_ids}})
    exams_data = await courses_cursor.to_list(length=100)
    return list(set([ex.get("courseName") for ex in exams_data if ex.get("courseName")]))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)

