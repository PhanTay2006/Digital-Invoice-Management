"""Upload PDF -> trích bản nháp. Không tự lưu chứng từ: người dùng xem, sửa rồi gọi POST /hoa-don hoặc /phieu-kho."""
import os, uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from ..core.common import engine, nguoi_dung, can_vai_tro, phien
from ..infrastructure.pdf_parser import UPLOAD_DIR, MAX_BYTES, kiem_tra_pdf, doc_van_ban, trich_hoa_don, trich_phieu_kho

router = APIRouter()


async def _nhan(file: UploadFile):
    data = await file.read(MAX_BYTES + 1)
    kiem_tra_pdf(data)
    van_ban = doc_van_ban(data)
    if len(van_ban.strip()) < 20:
        raise HTTPException(422, "PDF dạng ảnh scan, chưa có OCR. Hãy nhập tay hoặc dùng PDF có chữ.")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ten = uuid.uuid4().hex + ".pdf"  # tên do hệ thống sinh, không dùng tên người dùng
    with open(os.path.join(UPLOAD_DIR, ten), "wb") as f:
        f.write(data)
    return ten, van_ban


@router.post("/hoa-don/upload")
async def upload_hoa_don(file: UploadFile = File(...), u=Depends(can_vai_tro("KE_TOAN_AP"))):
    ten, vb = await _nhan(file)
    r = trich_hoa_don(vb)
    with engine.begin() as c:
        phien(c, u["id"])
        ncc = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst=:m"), {"m": r["mst"]}).scalar() if r["mst"] else None
        po = c.execute(text("SELECT id FROM don_hang_po WHERE so_po=:p"), {"p": r["so_po"]}).scalar() if r["so_po"] else None
        if r["mst"] and not ncc:
            r["canh_bao"].append("MST chưa có trong danh mục NCC")
        if r["so_po"] and not po:
            r["canh_bao"].append("Số PO không tồn tại")
        if ncc and r["so_hoa_don"] and c.execute(text("SELECT 1 FROM hoa_don WHERE nha_cung_cap_id=:n AND so_hoa_don=:s"), {"n": ncc, "s": r["so_hoa_don"]}).first():
            r["canh_bao"].append("Hóa đơn trùng số trong cùng NCC")
        for d in r["dong"]:  # SKU nào chưa ánh xạ sẽ được đối soát báo lệch (bước b)
            d["da_anh_xa"] = bool(ncc and c.execute(text("SELECT 1 FROM anh_xa_sku WHERE nha_cung_cap_id=:n AND ma_sku_ncc=:s"), {"n": ncc, "s": d["ma_sku_ncc"]}).first())
        c.execute(text("INSERT INTO audit_log(nguoi_dung_id,hanh_dong,doi_tuong,doi_tuong_id,du_lieu_moi) VALUES(:u,'UPLOAD','hoa_don',0,CAST(:j AS JSONB))"),
                  {"u": u["id"], "j": '{"file_pdf":"%s"}' % ten})
    return {"file_pdf": ten, "nha_cung_cap_id": ncc, "po_id": po, **{k: (str(v) if k in ("vat", "tien_coc_tru") and v is not None else v) for k, v in r.items() if k != "dong"},
            "dong": [{k: (str(v) if not isinstance(v, (str, bool)) else v) for k, v in d.items()} for d in r["dong"]]}


@router.post("/phieu-kho/upload")
async def upload_phieu_kho(file: UploadFile = File(...), u=Depends(can_vai_tro("THU_KHO"))):
    ten, vb = await _nhan(file)
    r = trich_phieu_kho(vb)
    with engine.begin() as c:
        phien(c, u["id"])
        po = c.execute(text("SELECT id FROM don_hang_po WHERE so_po=:p"), {"p": r["so_po"]}).scalar() if r["so_po"] else None
        if r["so_po"] and not po:
            r["canh_bao"].append("Số PO không tồn tại")
        if r["so_phieu"] and c.execute(text("SELECT 1 FROM phieu_kho WHERE so_phieu=:s"), {"s": r["so_phieu"]}).first():
            r["canh_bao"].append("Số phiếu kho đã tồn tại")
        for d in r["dong"]:  # mã SKU trên phiếu kho là mã nội bộ -> dong_po_id
            d["dong_po_id"] = c.execute(text("SELECT id FROM dong_po WHERE po_id=:p AND ma_sku=:s"), {"p": po, "s": d["ma_sku"]}).scalar() if po else None
            if po and d["dong_po_id"] is None:
                r["canh_bao"].append(f"SKU {d['ma_sku']} không có trong PO")
        c.execute(text("INSERT INTO audit_log(nguoi_dung_id,hanh_dong,doi_tuong,doi_tuong_id,du_lieu_moi) VALUES(:u,'UPLOAD','phieu_kho',0,CAST(:j AS JSONB))"),
                  {"u": u["id"], "j": '{"file_pdf":"%s"}' % ten})
    return {"file_pdf": ten, "po_id": po, **{k: v for k, v in r.items() if k != "dong"},
            "dong": [{k: (str(v) if not isinstance(v, (str, int, type(None))) else v) for k, v in d.items()} for d in r["dong"]]}


@router.get("/hoa-don/{hid}/file")
def tai_file_hoa_don(hid: int, u=Depends(nguoi_dung)):
    with engine.connect() as c:
        f = c.execute(text("SELECT file_pdf FROM hoa_don WHERE id=:i"), {"i": hid}).scalar()
    if not f:
        raise HTTPException(404, "Hóa đơn không có file PDF")
    return FileResponse(os.path.join(UPLOAD_DIR, f), media_type="application/pdf")
