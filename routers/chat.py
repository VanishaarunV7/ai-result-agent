import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import AsyncGroq
import datetime
import main  # to access db

router = APIRouter()

groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

class ChatRequest(BaseModel):
    studentId: str
    question: str
    conversationId: str | None = None

@router.post("/api/result-agent/chat")
async def chat(req: ChatRequest):
    if not req.studentId or not req.question:
        raise HTTPException(status_code=400, detail="studentId and question required")

    cursor = main.db["studentanswers"].find({"studentId": req.studentId})
    answers = await cursor.to_list(length=1000)
    
    attempts = await main.get_raw_attempts(req.studentId)

    if not answers or not attempts:
        return {"answer": "No exam data found for this student."}

    perf = main.calculate_performance(answers)
    topic_results = perf["topicResults"]

    # Conversation tracking
    conversation = None
    if req.conversationId:
        conversation = await main.db["conversations"].find_one({"conversationId": req.conversationId})
    
    if not conversation:
        conversation = {
            "conversationId": f"conv_{int(datetime.datetime.now().timestamp())}",
            "studentId": req.studentId,
            "messages": []
        }

    conversation["messages"].append({
        "role": "user",
        "content": req.question,
        "timestamp": datetime.datetime.now().isoformat()
    })

    sorted_attempts = sorted(attempts, key=lambda x: x.get("submittedAt", ""), reverse=True)
    latest = sorted_attempts[0] if sorted_attempts else None
    previous = sorted_attempts[1] if len(sorted_attempts) > 1 else None

    exam_list = "\n".join([f"- {a.get('examName')}: {a.get('marksScored')}/{a.get('totalMarks')} = {a.get('percentage')}%" for a in attempts])
    topic_list = "\n".join([f"- {t['topic']}: {t['percentage']}% ({t['level']})" for t in topic_results])
    
    if previous:
        improvement = f"Latest: {latest.get('examName')} = {latest.get('percentage')}%. Previous: {previous.get('examName')} = {previous.get('percentage')}%."
    else:
        improvement = f"Only one exam: {latest.get('examName')} = {latest.get('percentage')}%." if latest else "No exams."

    from routers import features
    try:
        pred_data = await features.get_predictions(req.studentId)
        
        ai_insights = f"""
AI Predictions:
- Predicted Next Score: {pred_data.get('nextExamScore')}%
- Pass Probability: {pred_data.get('passProbability')}%
- Improvement Forecast: {pred_data.get('improvementForecast')}
"""
    except Exception as e:
        ai_insights = "AI Insights not available."

    # Program-based academic context
    program = await main.get_student_program(req.studentId)
    program_course_names = []
    if program:
        program_course_names = program.get("courses", [])
        program_str = f"Program: {program['program_name']} ({program['program_id']})\nCourses: {', '.join(program_course_names)}"
    else:
        program_str = "No academic program assigned."

    # Fetch real timetable from exam_schedule collection, filtered by program courses
    from datetime import date as _date
    today_str = _date.today().isoformat()
    timetable_query = {"student_id": req.studentId, "exam_date": {"$gte": today_str}}
    if program_course_names:
        timetable_query["course"] = {"$in": program_course_names}
    cursor = main.db["exam_schedule"].find(timetable_query).sort("exam_date", 1)
    upcoming_exams = await cursor.to_list(length=10)
    timetable_str = "No upcoming exams are currently scheduled."
    if upcoming_exams:
        timetable_lines = [
            f"- {ex['exam_date']} {ex['start_time']}-{ex['end_time']} | {ex['exam_name']} | {ex['room']} ({ex['course']})"
            for ex in upcoming_exams
        ]
        timetable_str = "\n".join(timetable_lines)

    # Fetch assigned courses for this student
    assign_doc = await main.db["student_course_assignments"].find_one({"student_id": req.studentId})
    assigned_courses_list = []
    if program_course_names:
        assigned_courses_list = [f"- {c}" for c in program_course_names]
    elif assign_doc and assign_doc.get("assigned_courses"):
        cursor_courses = main.db["courses"].find({"course_id": {"$in": assign_doc["assigned_courses"]}})
        courses_data = await cursor_courses.to_list(length=100)
        assigned_courses_list = [f"- {c['course_name']} ({c['department']})" for c in courses_data]
    assigned_courses_str = "\n".join(assigned_courses_list) if assigned_courses_list else "No courses assigned."

    # Fetch specific course exams (only program courses when program is assigned)
    async def get_course_exams_str(course_name: str) -> str:
        past_cursor = main.db["exams"].find({"courseName": course_name})
        past_exams = await past_cursor.to_list(length=100)
        upcoming_cursor = main.db["exam_schedule"].find({"course": course_name})
        up_exams = await upcoming_cursor.to_list(length=100)
        
        lines = []
        if past_exams:
            lines.append("Past Exams:")
            for pe in past_exams:
                lines.append(f"  * {pe['examName']} (Date: {pe['examDate']})")
        if up_exams:
            lines.append("Upcoming Exams:")
            for ue in up_exams:
                lines.append(f"  * {ue['exam_name']} (Date: {ue['exam_date']} at {ue['start_time']} in {ue['room']})")
        if not lines:
            return "No exams have been scheduled for this course."
        return "\n".join(lines)

    # Fetch courses for course exams context (program-scoped)
    if program_course_names:
        all_courses = [{"course_name": c} for c in program_course_names]
    else:
        cursor_all_courses = main.db["courses"].find()
        all_courses = await cursor_all_courses.to_list(length=100)
    course_exams_list = []
    for c in all_courses:
        cname = c["course_name"]
        exams_str = await get_course_exams_str(cname)
        course_exams_list.append(f"- {cname}:\n{exams_str}")
    course_exams_str = "\n".join(course_exams_list)

    chat_context = "\n".join([f"{'Student' if m['role']=='user' else 'Agent'}: {m['content']}" for m in conversation["messages"]])

    prompt = f"""Student result data:
Exams attended:
{exam_list}

Topics Performance:
{topic_list}

Improvement: {improvement}

{ai_insights}

Academic Program:
{program_str}

Upcoming Exam Timetable:
{timetable_str}

Assigned Courses (program):
{assigned_courses_str}

Course Exams:
{course_exams_str}

Previous conversation:
{chat_context}

Based on the conversation history and the student's result data, answer the student's latest question. Reply in 1-2 sentences only. Use ONLY the provided data. NEVER guess, predict, or invent exam dates, times, or names.
Smart Detection Rules:
- "What is my program?" -> Reply exactly: "You are enrolled in [Program Name]." If no program assigned, say "No academic program has been assigned yet."
- "What courses are assigned to me?" or "Show my courses" -> List only courses from the student's program under Assigned Courses. Format: "[Program Name] Courses:" then each course on its own line. If no program, say "No academic program has been assigned yet."
- "Show my program details" -> Include Program Name, Assigned Courses list, and Course Count. If no program, say "No academic program has been assigned yet."
- "When is my next exam?" or "How many days left?" -> State the closest exam from the Upcoming Exam Timetable section and exactly when it is. If the timetable says "No upcoming exams are currently scheduled.", say that.
- "Show my exam timetable" -> List ALL exams from the Upcoming Exam Timetable section (program courses only). If empty, say "No upcoming exams are currently scheduled."
- "What exams are scheduled this month?" -> Filter the timetable to the current month and list them. If none, say "No exams this month."
- "Show Mathematics exams" or other course exams -> Answer using the information listed under the corresponding course in the 'Course Exams' section above. If the section says "No exams have been scheduled for this course.", you MUST reply exactly: "No exams have been scheduled for this course."
"""

    # Smart backend responses for program-related questions
    q_lower = req.question.lower().strip()
    if any(kw in q_lower for kw in ["program", "enrolled", "degree", "major"]):
        if "course" not in q_lower and "detail" not in q_lower:
            if program:
                answer = f"You are enrolled in {program['program_name']}."
            else:
                answer = "No academic program has been assigned yet."
            conversation["messages"].append({
                "role": "assistant",
                "content": answer,
                "timestamp": datetime.datetime.now().isoformat()
            })
            await main.db["conversations"].update_one(
                {"conversationId": conversation["conversationId"]},
                {"$set": conversation},
                upsert=True
            )
            weak_topics = [t["topic"] for t in topic_results if t["percentage"] < 76]
            return {
                "answer": answer,
                "conversationId": conversation["conversationId"],
                "history": conversation["messages"],
                "weakTopics": weak_topics,
                "topicResults": topic_results
            }

    if "program detail" in q_lower or "show my program" in q_lower:
        if program:
            course_lines = "\n".join(f"{i+1}. {c}" for i, c in enumerate(program_course_names))
            answer = f"Program Name: {program['program_name']}\nAssigned Courses:\n{course_lines}\nCourse Count: {len(program_course_names)}"
        else:
            answer = "No academic program has been assigned yet."
        conversation["messages"].append({
            "role": "assistant",
            "content": answer,
            "timestamp": datetime.datetime.now().isoformat()
        })
        await main.db["conversations"].update_one(
            {"conversationId": conversation["conversationId"]},
            {"$set": conversation},
            upsert=True
        )
        weak_topics = [t["topic"] for t in topic_results if t["percentage"] < 76]
        return {
            "answer": answer,
            "conversationId": conversation["conversationId"],
            "history": conversation["messages"],
            "weakTopics": weak_topics,
            "topicResults": topic_results
        }

    if any(kw in q_lower for kw in ["courses assigned", "assigned to me", "show my courses", "what courses"]):
        if program:
            course_lines = "\n".join(f"{i+1}. {c}" for i, c in enumerate(program_course_names))
            answer = f"{program['program_name']} Courses:\n\n{course_lines}"
        else:
            answer = "No academic program has been assigned yet."
        conversation["messages"].append({
            "role": "assistant",
            "content": answer,
            "timestamp": datetime.datetime.now().isoformat()
        })
        await main.db["conversations"].update_one(
            {"conversationId": conversation["conversationId"]},
            {"$set": conversation},
            upsert=True
        )
        weak_topics = [t["topic"] for t in topic_results if t["percentage"] < 76]
        return {
            "answer": answer,
            "conversationId": conversation["conversationId"],
            "history": conversation["messages"],
            "weakTopics": weak_topics,
            "topicResults": topic_results
        }

    # Smart backend check to enforce exact fallback message for courses with no exams
    q_lower = req.question.lower()
    if any(kw in q_lower for kw in ["exam", "test", "schedule", "timetable", "show"]):
        for c in all_courses:
            cname = c["course_name"]
            if cname.lower() in q_lower:
                exams_status = await get_course_exams_str(cname)
                if exams_status == "No exams have been scheduled for this course.":
                    answer = "No exams have been scheduled for this course."
                    conversation["messages"].append({
                        "role": "assistant",
                        "content": answer,
                        "timestamp": datetime.datetime.now().isoformat()
                    })
                    await main.db["conversations"].update_one(
                        {"conversationId": conversation["conversationId"]},
                        {"$set": conversation},
                        upsert=True
                    )
                    weak_topics = [t["topic"] for t in topic_results if t["percentage"] < 76]
                    return {
                        "answer": answer,
                        "conversationId": conversation["conversationId"],
                        "history": conversation["messages"],
                        "weakTopics": weak_topics,
                        "topicResults": topic_results
                    }

    try:
        completion = await groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You are an AI Student Success Copilot. Answer concisely based on the data."},
                {"role": "user", "content": prompt}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=200
        )
        answer = completion.choices[0].message.content
    except Exception as e:
        answer = f"Could not generate response. Error: {str(e)}"

    conversation["messages"].append({
        "role": "assistant",
        "content": answer,
        "timestamp": datetime.datetime.now().isoformat()
    })

    await main.db["conversations"].update_one(
        {"conversationId": conversation["conversationId"]},
        {"$set": conversation},
        upsert=True
    )

    weak_topics = [t["topic"] for t in topic_results if t["percentage"] < 76]

    return {
        "answer": answer,
        "conversationId": conversation["conversationId"],
        "history": conversation["messages"],
        "weakTopics": weak_topics,
        "topicResults": topic_results
    }
