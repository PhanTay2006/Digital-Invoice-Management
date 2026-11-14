"""Module tranh_chap: tranh chấp, lịch sử, thông báo (F-09, F-10, F-11)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, nguoi_dung, can_vai_tro, phien, loi_db

router = APIRouter()
THU_TU = {"OPEN": ["IN_PROGRESS"], "IN_PROGRESS": ["RESOLVED"], "RESOLVED": []}


class TCIn(BaseModel):
    ly_do: str


@router.post("/hoa-don/{hid}/tranh-chap", status_code=201)
def mo_tranh_chap(hid: int, b: TCIn, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    if not b.ly_do.strip():
        raise HTTPException(422, "Lý do bắt buộc")
    try:
        with engine.begin() as c:  # TR-04 chặn nếu hóa đơn không Mismatch/Partial; chỉ mục UQ một phần chặn trùng
            phien(c, u["id"])
            tid = c.execute(text("INSERT INTO tranh_chap(hoa_don_id,phu_trach_id,ly_do) VALUES(:h,:u,:d) RETURNING id"),
                            {"h": hid, "u": u["id"], "d": b.ly_do}).scalar()
            c.execute(text("INSERT INTO lich_su_tranh_chap(tranh_chap_id,nguoi_thuc_hien_id,trang_thai_moi,ghi_chu) VALUES(:t,:u,'OPEN',:d)"),
                      {"t": tid, "u": u["id"], "d": b.ly_do})
        return {"id": tid}
    except DBAPIError as e:
        raise loi_db(e)


class TTIn(BaseModel):
    trang_thai: str
    ghi_chu: str | None = None


@router.put("/tranh-chap/{tid}/trang-thai")
def doi_trang_thai(tid: int, b: TTIn, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            cur = c.execute(text("SELECT trang_thai FROM tranh_chap WHERE id=:i FOR UPDATE"), {"i": tid}).scalar()
            if cur is None:
                raise HTTPException(404, "Không có tranh chấp")
            if b.trang_thai not in THU_TU[cur]:
                raise HTTPException(409, f"Không chuyển {cur} → {b.trang_thai}")
            c.execute(text("UPDATE tranh_chap SET trang_thai=:s WHERE id=:i"), {"s": b.trang_thai, "i": tid})  # TR-05 xử lý RESOLVED
            c.execute(text("INSERT INTO lich_su_tranh_chap(tranh_chap_id,nguoi_thuc_hien_id,trang_thai_moi,ghi_chu) VALUES(:t,:u,:s,:g)"),
                      {"t": tid, "u": u["id"], "s": b.trang_thai, "g": b.ghi_chu})
        return {"trang_thai": b.trang_thai}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/tranh-chap/{tid}")
def xem_tranh_chap(tid: int, u=Depends(can_vai_tro("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    with engine.connect() as c:
        tc = c.execute(text("SELECT * FROM tranh_chap WHERE id=:i"), {"i": tid}).mappings().first()
        if not tc:
            raise HTTPException(404, "Không có tranh chấp")
        ls = [dict(r) for r in c.execute(text("SELECT * FROM lich_su_tranh_chap WHERE tranh_chap_id=:i ORDER BY thoi_gian"), {"i": tid}).mappings()]
    return {**tc, "lich_su": ls}


@router.get("/thong-bao")
def thong_bao_cua_toi(chua_doc: bool = False, u=Depends(nguoi_dung)):
    with engine.connect() as c:
        q = "SELECT * FROM thong_bao WHERE nguoi_nhan_id=:u" + (" AND NOT da_doc" if chua_doc else "") + " ORDER BY thoi_gian DESC LIMIT 100"
        return [dict(r) for r in c.execute(text(q), {"u": u["id"]}).mappings()]


@router.put("/thong-bao/{nid}/da-doc")
def danh_dau_da_doc(nid: int, u=Depends(nguoi_dung)):
    with engine.begin() as c:
        n = c.execute(text("UPDATE thong_bao SET da_doc=TRUE WHERE id=:i AND nguoi_nhan_id=:u"), {"i": nid, "u": u["id"]}).rowcount
    if not n:
        raise HTTPException(404, "Không có thông báo")
    return {"da_doc": True}
