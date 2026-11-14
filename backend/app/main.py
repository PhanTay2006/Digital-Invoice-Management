from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, chung_tu, doi_soat, tranh_chap, bao_cao, quan_tri, upload

app = FastAPI(title="Hệ thống đối soát hóa đơn B2B")

# Cho frontend Vite (localhost:5173) gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tất cả endpoint nằm dưới /api để khớp VITE_API_BASE_URL
for m in (auth, chung_tu, doi_soat, tranh_chap, bao_cao, quan_tri, upload):
    app.include_router(m.router, prefix="/api")