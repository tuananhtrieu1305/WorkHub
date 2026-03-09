import os
from dotenv import load_dotenv

# Load file .env từ thư mục gốc của project
load_dotenv()

class Settings:
    PROJECT_NAME: str = "WorkHub Python Service"
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/workhub_db")
    
    _extracted_db = MONGODB_URI.split("/")[-1].split("?")[0]
    DATABASE_NAME: str = _extracted_db if _extracted_db else "workhub_db"

settings = Settings()