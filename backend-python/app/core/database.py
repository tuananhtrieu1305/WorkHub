from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    print("⏳ Đang kết nối tới MongoDB Atlas (Python)...")
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    print("✅ Python kết nối MongoDB thành công!")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("❌ Đã ngắt kết nối MongoDB (Python).")