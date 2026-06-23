import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta

MONGO_URI = "mongodb+srv://arunvanisha321_db_user:Vanisha123@cluster0.gk58pja.mongodb.net/?appName=Cluster0"

async def seed_exams():
    client = AsyncIOMotorClient(MONGO_URI, tls=True)
    db = client.get_database("test")
    
    # Drop existing schedule for clean slate
    await db.drop_collection("exams_schedule")
    collection = db["exams_schedule"]
    
    now = datetime.now()
    
    # Future exams
    exams = [
        {
            "examName": "English Literature - Midterm",
            "course": "English",
            "date": (now + timedelta(days=5)).strftime("%Y-%m-%d"),
            "startTime": "10:00",
            "endTime": "13:00",
            "room": "Hall A",
            "status": "Scheduled"
        },
        {
            "examName": "Advanced Mathematics - Final",
            "course": "Mathematics",
            "date": (now + timedelta(days=12)).strftime("%Y-%m-%d"),
            "startTime": "14:00",
            "endTime": "17:00",
            "room": "Hall B",
            "status": "Scheduled"
        },
        {
            "examName": "Organic Chemistry Basics",
            "course": "Chemistry",
            "date": (now + timedelta(days=20)).strftime("%Y-%m-%d"),
            "startTime": "09:00",
            "endTime": "12:00",
            "room": "Lab 3",
            "status": "Scheduled"
        }
    ]
    
    result = await collection.insert_many(exams)
    print(f"Inserted {len(result.inserted_ids)} mock exams into exams_schedule.")

if __name__ == "__main__":
    asyncio.run(seed_exams())
