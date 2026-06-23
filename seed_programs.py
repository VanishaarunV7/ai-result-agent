"""
Seed programs collection, assign students to programs, update courses and exam_schedule.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

PROGRAMS = [
    {
        "program_id": "P_CS",
        "program_name": "Computer Science",
        "courses": [
            "Mathematics",
            "DBMS",
            "Python Programming",
            "Data Structures",
            "Computer Networks",
        ],
    },
    {
        "program_id": "P_CA",
        "program_name": "Chartered Accountancy",
        "courses": [
            "Accounts",
            "Auditing",
            "Taxation",
            "Cost Accounting",
        ],
    },
    {
        "program_id": "P_BIO",
        "program_name": "Biotechnology",
        "courses": [
            "Genetics",
            "Biochemistry",
            "Microbiology",
            "Cell Biology",
        ],
    },
]

STUDENT_PROGRAMS = {
    "stu_001": "P_CS",
    "stu_002": "P_CS",
    "stu_003": "P_CS",
    "stu_004": "P_CS",
    "stu_005": "P_CA",
    "stu_006": "P_CA",
    "stu_007": "P_CA",
    "stu_008": "P_BIO",
    "stu_009": "P_BIO",
    "stu_010": "P_BIO",
}

# Course documents keyed by program
PROGRAM_COURSES = {
    "P_CS": [
        {"course_id": "C_CS_MAT", "course_name": "Mathematics", "department": "Computer Science", "program_id": "P_CS"},
        {"course_id": "C_CS_DBMS", "course_name": "DBMS", "department": "Computer Science", "program_id": "P_CS"},
        {"course_id": "C_CS_PY", "course_name": "Python Programming", "department": "Computer Science", "program_id": "P_CS"},
        {"course_id": "C_CS_DS", "course_name": "Data Structures", "department": "Computer Science", "program_id": "P_CS"},
        {"course_id": "C_CS_NET", "course_name": "Computer Networks", "department": "Computer Science", "program_id": "P_CS"},
    ],
    "P_CA": [
        {"course_id": "C_CA_ACC", "course_name": "Accounts", "department": "Commerce", "program_id": "P_CA"},
        {"course_id": "C_CA_AUD", "course_name": "Auditing", "department": "Commerce", "program_id": "P_CA"},
        {"course_id": "C_CA_TAX", "course_name": "Taxation", "department": "Commerce", "program_id": "P_CA"},
        {"course_id": "C_CA_COST", "course_name": "Cost Accounting", "department": "Commerce", "program_id": "P_CA"},
    ],
    "P_BIO": [
        {"course_id": "C_BIO_GEN", "course_name": "Genetics", "department": "Biotechnology", "program_id": "P_BIO"},
        {"course_id": "C_BIO_BIO", "course_name": "Biochemistry", "department": "Biotechnology", "program_id": "P_BIO"},
        {"course_id": "C_BIO_MIC", "course_name": "Microbiology", "department": "Biotechnology", "program_id": "P_BIO"},
        {"course_id": "C_BIO_CELL", "course_name": "Cell Biology", "department": "Biotechnology", "program_id": "P_BIO"},
    ],
}

EXAM_TEMPLATES = {
    "P_CS": [
        {"exam_name": "Mathematics Internal Test", "course": "Mathematics", "exam_date": "2026-07-18", "start_time": "02:00 PM", "end_time": "03:30 PM", "room": "Hall A"},
        {"exam_name": "DBMS Internal Test", "course": "DBMS", "exam_date": "2026-07-22", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Lab 1"},
        {"exam_name": "Python Programming Internal Test", "course": "Python Programming", "exam_date": "2026-07-25", "start_time": "11:00 AM", "end_time": "12:30 PM", "room": "Lab 2"},
        {"exam_name": "Data Structures Internal Test", "course": "Data Structures", "exam_date": "2026-07-28", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Hall B"},
    ],
    "P_CA": [
        {"exam_name": "Accounts Internal Test", "course": "Accounts", "exam_date": "2026-07-18", "start_time": "02:00 PM", "end_time": "03:30 PM", "room": "Hall A"},
        {"exam_name": "Taxation Internal Test", "course": "Taxation", "exam_date": "2026-07-22", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Room 201"},
        {"exam_name": "Auditing Internal Test", "course": "Auditing", "exam_date": "2026-07-25", "start_time": "11:00 AM", "end_time": "12:30 PM", "room": "Hall B"},
        {"exam_name": "Cost Accounting Internal Test", "course": "Cost Accounting", "exam_date": "2026-07-28", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Room 102"},
    ],
    "P_BIO": [
        {"exam_name": "Genetics Internal Test", "course": "Genetics", "exam_date": "2026-07-18", "start_time": "02:00 PM", "end_time": "03:30 PM", "room": "Lab 3"},
        {"exam_name": "Biochemistry Internal Test", "course": "Biochemistry", "exam_date": "2026-07-22", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Lab 4"},
        {"exam_name": "Microbiology Internal Test", "course": "Microbiology", "exam_date": "2026-07-25", "start_time": "11:00 AM", "end_time": "12:30 PM", "room": "Lab 5"},
        {"exam_name": "Cell Biology Internal Test", "course": "Cell Biology", "exam_date": "2026-07-28", "start_time": "09:00 AM", "end_time": "10:30 AM", "room": "Lab 6"},
    ],
}


async def seed():
    client = AsyncIOMotorClient(MONGO_URI, tls=True, serverSelectionTimeoutMS=10000)
    db = client.get_database("test")

    await db.drop_collection("programs")
    await db["programs"].insert_many(PROGRAMS)
    print(f"Inserted {len(PROGRAMS)} programs.")

    await db["programs"].create_index("program_id", unique=True)

    # Update students with program_id
    for student_id, program_id in STUDENT_PROGRAMS.items():
        await db["students"].update_one(
            {"_id": student_id},
            {"$set": {"program_id": program_id}},
            upsert=True,
        )
    print(f"Updated {len(STUDENT_PROGRAMS)} students with program_id.")

    # Replace courses with program-scoped courses
    await db.drop_collection("courses")
    all_courses = []
    for courses in PROGRAM_COURSES.values():
        all_courses.extend(courses)
    await db["courses"].insert_many(all_courses)
    await db["courses"].create_index("course_id", unique=True)
    print(f"Inserted {len(all_courses)} program courses.")

    # Replace student_course_assignments from program courses
    await db.drop_collection("student_course_assignments")
    assignments = []
    for student_id, program_id in STUDENT_PROGRAMS.items():
        course_ids = [c["course_id"] for c in PROGRAM_COURSES[program_id]]
        assignments.append({"student_id": student_id, "assigned_courses": course_ids, "program_id": program_id})
    await db["student_course_assignments"].insert_many(assignments)
    await db["student_course_assignments"].create_index("student_id", unique=True)
    print(f"Inserted {len(assignments)} student course assignments.")

    # Seed exam_schedule per student based on program
    await db.drop_collection("exam_schedule")
    schedule_docs = []
    for student_id, program_id in STUDENT_PROGRAMS.items():
        for exam in EXAM_TEMPLATES[program_id]:
            schedule_docs.append({
                "student_id": student_id,
                "program_id": program_id,
                **exam,
            })
    await db["exam_schedule"].insert_many(schedule_docs)
    await db["exam_schedule"].create_index([("student_id", 1), ("exam_date", 1)])
    print(f"Inserted {len(schedule_docs)} exam_schedule documents.")

    client.close()
    print("Program seeding finished successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
