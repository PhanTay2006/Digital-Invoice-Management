import os
import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy import create_engine, text

engine = create_engine(os.environ.get("DATABASE_URL", "postgresql+psycopg://app:app@localhost/doisoat"))
SECRET = os.environ.get("JWT_SECRET", "dev")


def nguoi_dung(authorization: str = Header(...)):
    try:
        return jwt.decode(authorization.removeprefix("Bearer "), SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Token không hợp lệ")


def can_vai_tro(*vt):  # NF-10: kiểm quyền ở lớp API
    def dep(u=Depends(nguoi_dung)):
        if u["vai_tro"] not in vt:
            raise HTTPException(403, "Không đủ quyền")
        return u
    return dep


def phien(conn, uid):  # để trigger audit biết người thao tác
    conn.execute(text("SELECT set_config('app.user_id', :u, true)"), {"u": str(uid)})




def loi_db(e):
    """Đổi lỗi CSDL (CHECK/UNIQUE/trigger) thành lỗi HTTP dễ hiểu."""
    msg = str(getattr(e, "orig", e)).split("\n")[0]
    code = 409 if "duplicate key" in msg or "unique" in msg.lower() else 422
    return HTTPException(code, msg)
