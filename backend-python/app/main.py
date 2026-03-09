from fastapi import FastAPI
from app.core.database import connect_to_mongo, close_mongo_connection
from app.views import document_api

app = FastAPI(title="WorkHub Python API")

# Lắng nghe sự kiện bật/tắt server để quản lý kết nối DB
@app.on_event("startup")
async def startup_db_client():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    await close_mongo_connection()

# Đăng ký các Routes (Views)
app.include_router(document_api.router, prefix="/api/python/documents", tags=["Documents"])

# Route kiểm tra sức khỏe hệ thống
@app.get("/api/python/health")
async def health_check():
    return {"status": "ok", "service": "Python Backend đang chạy mượt mà!"}