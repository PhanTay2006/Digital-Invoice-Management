"""Module quan_tri: tài khoản, cấu hình dung sai, audit log (F-12, F-13)."""
from decimal import Decimal as D
from typing import Optional
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, can_vai_tro, phien, loi_db

router = APIRouter()
QT = Depends(can_vai_tro("QUAN_TRI"))
VAI_TRO = "MUA_HANG|THU_KHO|KE_TOAN_AP|QUAN_LY|QUAN_TRI"


class NDIn(BaseModel):
    ten_dang_nhap: str
    mat_khau: str = Field(min_length=8)
    ho_ten: str
    vai_tro: str = Field(pattern=f"^({VAI_TRO})$")


@router.post("/nguoi-dung", status_code=201)
def tao_nguoi_dung(b: NDIn, u=QT):
    h = bcrypt.hashpw(b.mat_khau.encode(), bcrypt.gensalt()).decode()
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            return {"id": c.execute(text("INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro) VALUES(:t,:h,:n,:v) RETURNING id"),
                                    {"t": b.ten_dang_nhap, "h": h, "n": b.ho_ten, "v": b.vai_tro}).scalar()}
    except DBAPIError as e:
        raise loi_db(e)


class NDSua(BaseModel):
    vai_tro: Optional[str] = Field(None, pattern=f"^({VAI_TRO})$")
    hoat_dong: Optional[bool] = None


@router.put("/nguoi-dung/{nid}")  # khóa tài khoản thay vì xóa; đổi vai trò được audit (TR-11)
def sua_nguoi_dung(nid: int, b: NDSua, u=QT):
    sets = {k: v for k, v in b.model_dump().items() if v is not None}
    if not sets:
        raise HTTPException(422, "Không có gì để sửa")
    if nid == u["id"]:
        raise HTTPException(403, "Không tự đổi vai trò/khóa chính mình")
    with engine.begin() as c:
        phien(c, u["id"])
        n = c.execute(text(f"UPDATE nguoi_dung SET {','.join(f'{k}=:{k}' for k in sets)} WHERE id=:id"), {**sets, "id": nid}).rowcount
    if not n:
        raise HTTPException(404, "Không có người dùng")
    return sets


class CHIn(BaseModel):
    dung_sai_don_gia_pct: D = Field(ge=0, le=100)
    nguong_lech_lon_pct: D = Field(ge=0, le=100)
    nguong_lech_lon_tien: D = Field(ge=0)
    han_muc_duyet: D = Field(ge=0)


@router.post("/cau-hinh", status_code=201)  # thêm dòng mới, không sửa dòng cũ
def them_cau_hinh(b: CHIn, u=QT):
    with engine.begin() as c:
        phien(c, u["id"])
        return {"id": c.execute(text("""INSERT INTO cau_hinh_doi_soat(dung_sai_don_gia_pct,nguong_lech_lon_pct,nguong_lech_lon_tien,han_muc_duyet,nguoi_cau_hinh_id)
            VALUES(:dung_sai_don_gia_pct,:nguong_lech_lon_pct,:nguong_lech_lon_tien,:han_muc_duyet,:u) RETURNING id"""), {**b.model_dump(), "u": u["id"]}).scalar()}


@router.get("/cau-hinh/hien-hanh")
def cau_hinh_hien_hanh(u=Depends(can_vai_tro("QUAN_TRI", "QUAN_LY", "KE_TOAN_AP"))):
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM cau_hinh_doi_soat ORDER BY hieu_luc_tu DESC, id DESC LIMIT 1")).mappings().first()
    return dict(r) if r else {}


@router.get("/audit-log")
def audit_log(doi_tuong: Optional[str] = None, doi_tuong_id: Optional[int] = None, nguoi_dung_id: Optional[int] = None,
              limit: int = 100, u=QT):
    where, p = ["TRUE"], {"limit": min(limit, 500)}
    for cond, k, v in (("doi_tuong=:a", "a", doi_tuong), ("doi_tuong_id=:b", "b", doi_tuong_id), ("nguoi_dung_id=:c", "c", nguoi_dung_id)):
        if v is not None:
            where.append(cond); p[k] = v
    with engine.connect() as c:
        return [dict(r) for r in c.execute(text(f"SELECT * FROM audit_log WHERE {' AND '.join(where)} ORDER BY id DESC LIMIT :limit"), p).mappings()]
