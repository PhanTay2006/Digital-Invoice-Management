"""Đăng nhập, cấp JWT (NF-08, NF-10)."""
import datetime as dt
import bcrypt, jwt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from ..core.common import engine, SECRET

router = APIRouter()

class Login(BaseModel):
    ten_dang_nhap: str
    mat_khau: str
    
@router.post("/dang-nhap")
def dang_nhap(b: Login):
    with engine.connect() as c:
        u = c.execute(text("SELECT id,mat_khau_bam,vai_tro,hoat_dong FROM nguoi_dung WHERE ten_dang_nhap=:t"), {"t": b.ten_dang_nhap}).first()
    if not u or not u.hoat_dong or not bcrypt.checkpw(b.mat_khau.encode(), u.mat_khau_bam.encode()):
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=8)
    return {"token": jwt.encode({"sub": str(u.id), "id": u.id, "vai_tro": u.vai_tro, "exp": exp}, SECRET, "HS256")}
