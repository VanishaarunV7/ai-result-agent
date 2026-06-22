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
        placement_data = await features.get_placement_readiness(req.studentId)
        
        ai_insights = f"""
AI Predictions:
- Predicted Next Score: {pred_data.get('nextExamScore')}%
- Pass Probability: {pred_data.get('passProbability')}%
- Improvement Forecast: {pred_data.get('improvementForecast')}

Placement Readiness:
- Readiness Score: {placement_data.get('readinessScore')}/100
- Risk Level: {placement_data.get('riskLevel')}
"""
    except Exception as e:
        ai_insights = "AI Insights not available."

    chat_context = "\n".join([f"{'Student' if m['role']=='user' else 'Agent'}: {m['content']}" for m in conversation["messages"]])

    prompt = f"""Student result data:
Exams attended:
{exam_list}

Topics Performance:
{topic_list}

Improvement: {improvement}

{ai_insights}

Previous conversation:
{chat_context}

Based on the conversation history and the student's result data, answer the student's latest question. Reply in 1-2 sentences only. Use only the provided data. Do not add any extra information not asked.
"""

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
