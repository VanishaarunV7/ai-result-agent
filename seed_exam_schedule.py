"""
Seed script for the `exam_schedule` collection.
Each document is tied to a specific student_id and contains
actual exam date/time/room data so the dashboard countdown
and timetable table show real values.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

# ── All 10 students ──────────────────────────────────────────────────────────
STUDENTS = [
    "stu_001", "stu_002", "stu_003", "stu_004", "stu_005",
    "stu_006", "stu_007", "stu_008", "stu_009", "stu_010",
]

# Each student gets exactly these upcoming exams (dates are future-dated)
TEMPLATE_EXAMS = [
    {
        "exam_name": "English Internal Test 2",
        "course":    "English",
        "exam_date": "2026-07-15",
        "start_time": "10:00 AM",
        "end_time":   "11:00 AM",
        "room":       "Lab 2",
    },
    {
        "exam_name": "Mathematics Internal Test 2",
        "course":    "Mathematics",
        "exam_date": "2026-07-18",
        "start_time": "02:00 PM",
        "end_time":   "03:30 PM",
        "room":       "Hall A",
    },
    {
        "exam_name": "Chemistry Internal Test 2",
        "course":    "Chemistry",
        "exam_date": "2026-07-22",
        "start_time": "09:00 AM",
        "end_time":   "10:30 AM",
        "room":       "Lab 3",
    },
    {
        "exam_name": "Physics Internal Test 2",
        "course":    "Physics",
        "exam_date": "2026-07-25",
        "start_time": "11:00 AM",
        "end_time":   "12:30 PM",
        "room":       "Hall B",
    },
    {
        "exam_name": "Tamil Internal Test 2",
        "course":    "Tamil",
        "exam_date": "2026-07-28",
        "start_time": "09:00 AM",
        "end_time":   "10:00 AM",
        "room":       "Room 101",
    },
]

async def seed():
    client = AsyncIOMotorClient(MONGO_URI, tls=True, serverSelectionTimeoutMS=10000)
    db = client.get_database("test")

    # Drop old collection for a clean slate
    await db.drop_collection("exam_schedule")
    print("Dropped old exam_schedule collection.")

    docs = []
    for student_id in STUDENTS:
        for exam in TEMPLATE_EXAMS:
            docs.append({
                "student_id": student_id,
                "exam_name":  exam["exam_name"],
                "course":     exam["course"],
                "exam_date":  exam["exam_date"],
                "start_time": exam["start_time"],
                "end_time":   exam["end_time"],
                "room":       exam["room"],
            })

    result = await db["exam_schedule"].insert_many(docs)
    print(f"Inserted {len(result.inserted_ids)} documents into exam_schedule.")

    # Create an index on student_id + exam_date for fast lookups
    await db["exam_schedule"].create_index([("student_id", 1), ("exam_date", 1)])
    print("Index created on (student_id, exam_date).")

    client.close()

if __name__ == "__main__":
    asyncio.run(seed())
