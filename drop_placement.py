import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb+srv://arunvanisha321_db_user:Vanisha123@cluster0.gk58pja.mongodb.net/?appName=Cluster0"

async def drop():
    client = AsyncIOMotorClient(MONGO_URI, tls=True)
    db = client.get_database("test")
    await db.drop_collection("placement_scores")
    print("Dropped placement_scores")

if __name__ == "__main__":
    asyncio.run(drop())
