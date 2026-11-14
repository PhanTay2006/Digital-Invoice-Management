"""Module doi_soat + duyệt ngoại lệ: Sequence 1 (F-07) và Sequence 2 (F-16)."""
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from ..core.common import engine, can_vai_tro, phien
from ..domain.doi_soat import doi_soat, Cau_hinh

router = APIRouter()


@router.post("/hoa-don/{hid}/doi-soat")  # Sequence 1 (F-07)
def chay_doi_soat(hid: int, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    with engine.begin() as c:  # một giao dịch: INSERT lan_doi_soat + UPDATE trạng thái
        phien(c, u["id"])
        hd = c.execute(text("SELECT * FROM hoa_don WHERE id=:i FOR UPDATE"), {"i": hid}).mappings().first()
        if not hd:
            raise HTTPException(404, "Không có hóa đơn")
        if hd["trang_thai"] == "RECONCILED":
            raise HTTPException(409, "Hóa đơn đã Reconciled, bị khóa")
        po = c.execute(text("SELECT * FROM don_hang_po WHERE id=:i"), {"i": hd["po_id"]}).mappings().first()
        dhd = [dict(r) for r in c.execute(text("SELECT * FROM dong_hoa_don WHERE hoa_don_id=:i"), {"i": hid}).mappings()]
        dpo = {r["id"]: dict(r) for r in c.execute(text("SELECT * FROM dong_po WHERE po_id=:i"), {"i": po["id"]}).mappings()}
        kho = {r[0]: r[1] for r in c.execute(text(
            "SELECT dong_po_id,sum(so_dat) FROM dong_phieu_kho d JOIN phieu_kho p ON p.id=d.phieu_kho_id WHERE p.po_id=:i GROUP BY 1"), {"i": po["id"]})}
        ch = c.execute(text("SELECT * FROM cau_hinh_doi_soat ORDER BY hieu_luc_tu DESC LIMIT 1")).mappings().first()
        if not ch:
            raise HTTPException(409, "Chưa có cấu hình đối soát")
        r = doi_soat(hd, dhd, po, dpo, kho, Cau_hinh(ch["dung_sai_don_gia_pct"], ch["nguong_lech_lon_pct"], ch["nguong_lech_lon_tien"], ch["han_muc_duyet"]))
        lid = c.execute(text("""INSERT INTO lan_doi_soat(hoa_don_id,cau_hinh_id,nguoi_chay_id,ket_qua,lech_lon,muc_lech_tien,chi_tiet_buoc)
            VALUES(:h,:c,:u,:k,:l,:m,CAST(:j AS JSONB)) RETURNING id"""),
            {"h": hid, "c": ch["id"], "u": u["id"], "k": r["ket_qua"], "l": r["lech_lon"], "m": r["muc_lech_tien"], "j": json.dumps(r["chi_tiet_buoc"])}).scalar()
        c.execute(text("UPDATE hoa_don SET trang_thai=:k WHERE id=:i"), {"k": r["ket_qua"], "i": hid})
        if r["ket_qua"] == "MISMATCH":
            c.execute(text("INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung) VALUES(:u,:h,'MISMATCH','Hóa đơn lệch, cần xử lý')"), {"u": u["id"], "h": hid})
    return {"lan_doi_soat_id": lid, **r, "muc_lech_tien": str(r["muc_lech_tien"]) if r["muc_lech_tien"] else None}


class YeuCau(BaseModel):
    ly_do: str


@router.post("/tranh-chap/{tid}/yeu-cau-duyet", status_code=201)  # Sequence 2: gửi (F-16)
def gui_yeu_cau(tid: int, b: YeuCau, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    with engine.begin() as c:
        phien(c, u["id"])
        tc = c.execute(text("SELECT hoa_don_id FROM tranh_chap WHERE id=:i"), {"i": tid}).first()
        if not tc:
            raise HTTPException(404, "Không có tranh chấp")
        ld = c.execute(text("SELECT id FROM lan_doi_soat WHERE hoa_don_id=:h AND lech_lon ORDER BY thoi_gian DESC LIMIT 1"), {"h": tc[0]}).scalar()
        if not ld:
            raise HTTPException(409, "Hóa đơn không có lần đối soát lệch lớn")
        try:  # TR-08/TR-09 chặn nếu vượt hạn mức hoặc sai vai trò
            yid = c.execute(text("""INSERT INTO yeu_cau_duyet_ngoai_le(hoa_don_id,tranh_chap_id,lan_doi_soat_id,nguoi_gui_id,ly_do)
                VALUES(:h,:t,:l,:u,:d) RETURNING id"""), {"h": tc[0], "t": tid, "l": ld, "u": u["id"], "d": b.ly_do}).scalar()
        except Exception as e:
            raise HTTPException(422, str(e.orig) if hasattr(e, "orig") else str(e))
        c.execute(text("""INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung)
            SELECT id,:h,'YEU_CAU_DUYET','Có yêu cầu duyệt ngoại lệ cần xử lý' FROM nguoi_dung
            WHERE vai_tro='QUAN_LY' AND hoat_dong"""), {"h": tc[0]})
    return {"id": yid}


class QuyetDinh(BaseModel):
    quyet_dinh: str  # DUYET | TU_CHOI
    ghi_chu: str


@router.put("/yeu-cau-duyet/{yid}")  # Sequence 2: duyệt/từ chối (F-16)
def duyet(yid: int, b: QuyetDinh, u=Depends(can_vai_tro("QUAN_LY"))):
    if b.quyet_dinh not in ("DUYET", "TU_CHOI") or not b.ghi_chu.strip():
        raise HTTPException(422, "Cần quyết định hợp lệ và ghi chú")
    with engine.begin() as c:
        phien(c, u["id"])
        y = c.execute(text("SELECT * FROM yeu_cau_duyet_ngoai_le WHERE id=:i FOR UPDATE"), {"i": yid}).mappings().first()
        if not y or y["trang_thai"] != "CHO_DUYET":
            raise HTTPException(409, "Yêu cầu không tồn tại hoặc đã quyết định")
        if y["nguoi_gui_id"] == u["id"]:
            raise HTTPException(403, "Không tự duyệt")
        c.execute(text("UPDATE yeu_cau_duyet_ngoai_le SET trang_thai=:q,nguoi_duyet_id=:u,ghi_chu_duyet=:g,thoi_gian_duyet=now() WHERE id=:i"),
                  {"q": b.quyet_dinh, "u": u["id"], "g": b.ghi_chu, "i": yid})
        if b.quyet_dinh == "DUYET":
            c.execute(text("UPDATE hoa_don SET trang_thai='RECONCILED' WHERE id=:h"), {"h": y["hoa_don_id"]})  # TR-07 đặt theo_ngoai_le
            tt = "RESOLVED"
            c.execute(text("UPDATE tranh_chap SET trang_thai='RESOLVED' WHERE id=:t"), {"t": y["tranh_chap_id"]})  # TR-05 đặt ngay_dong
        else:
            tt = "IN_PROGRESS"
            c.execute(text("UPDATE tranh_chap SET trang_thai='IN_PROGRESS' WHERE id=:t"), {"t": y["tranh_chap_id"]})
        c.execute(text("INSERT INTO lich_su_tranh_chap(tranh_chap_id,nguoi_thuc_hien_id,trang_thai_moi,ghi_chu) VALUES(:t,:u,:s,:g)"),
                  {"t": y["tranh_chap_id"], "u": u["id"], "s": tt, "g": b.ghi_chu})
        c.execute(text("INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung) VALUES(:n,:h,'QUYET_DINH_DUYET',:d)"),
                  {"n": y["nguoi_gui_id"], "h": y["hoa_don_id"], "d": f"Yêu cầu duyệt: {b.quyet_dinh}"})
    return {"trang_thai": b.quyet_dinh}
