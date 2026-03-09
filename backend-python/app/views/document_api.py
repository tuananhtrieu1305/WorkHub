from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/test")
async def test_document_api():
    return {"message": "Document API đang hoạt động!"}