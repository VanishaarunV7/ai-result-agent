import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

COURSES = [
    { "course_id": "C_MAT", "course_name": "Mathematics", "department": "Science" },
    { "course_id": "C_PHY", "course_name": "Physics", "department": "Science" },
    { "course_id": "C_CHE", "course_name": "Chemistry", "department": "Science" },
    { "course_id": "C_ENG", "course_name": "English", "department": "Humanities" },
    { "course_id": "C_TAM", "course_name": "Tamil", "department": "Humanities" },
    { "course_id": "C_ACC", "course_name": "Accounts", "department": "Commerce" },
]

ASSIGNMENTS = [
    { "student_id": "stu_001", "assigned_courses": ["C_MAT", "C_ENG", "C_TAM"] },
    { "student_id": "stu_002", "assigned_courses": ["C_PHY", "C_ENG", "C_ACC"] },
    { "student_id": "stu_003", "assigned_courses": ["C_CHE", "C_TAM", "C_ACC"] },
    { "student_id": "stu_004", "assigned_courses": ["C_MAT", "C_PHY", "C_ENG"] },
    { "student_id": "stu_005", "assigned_courses": ["C_MAT", "C_CHE", "C_TAM"] },
    { "student_id": "stu_006", "assigned_courses": ["C_PHY", "C_CHE", "C_ACC"] },
    { "student_id": "stu_007", "assigned_courses": ["C_MAT", "C_PHY", "C_CHE", "C_ENG"] },
    { "student_id": "stu_008", "assigned_courses": ["C_TAM", "C_ACC", "C_ENG"] },
    { "student_id": "stu_009", "assigned_courses": ["C_MAT", "C_ACC", "C_PHY"] },
    { "student_id": "stu_010", "assigned_courses": ["C_MAT", "C_PHY", "C_CHE", "C_ENG", "C_TAM", "C_ACC"] },
]

async def seed():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URI, tls=True, serverSelectionTimeoutMS=10000)
    db = client.get_database("test")

    # Drop old collections for a clean seed
    await db.drop_collection("courses")
    print("Dropped old courses collection.")
    await db.drop_collection("student_course_assignments")
    print("Dropped old student_course_assignments collection.")

    # Insert courses
    result_courses = await db["courses"].insert_many(COURSES)
    print(f"Inserted {len(result_courses.inserted_ids)} courses.")

    # Insert assignments
    result_assign = await db["student_course_assignments"].insert_many(ASSIGNMENTS)
    print(f"Inserted {len(result_assign.inserted_ids)} student course assignments.")

    # Create indexes
    await db["courses"].create_index("course_id", unique=True)
    await db["student_course_assignments"].create_index("student_id", unique=True)
    print("Created indexes on course_id and student_id.")

    client.close()
    print("Seeding finished successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
