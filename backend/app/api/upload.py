"""Upload chứng từ (PDF điện tử / PDF scan OCR / DOCX / XLSX) -> Trích xuất bản nháp.
Tuân thủ quy tắc:
- Người dùng không cần phân biệt PDF điện tử hay PDF scan (hệ thống tự điều phối pdfplumber / PaddleOCR).
- Hỗ trợ PDF nhiều trang.
- Không tự động lưu dữ liệu trích xuất/OCR vào quy trình đối soát trước khi người dùng kiểm tra và bấm Xác nhận.
"""
import json
import os
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from ..core.common import engine, nguoi_dung, can_vai_tro, phien
from ..infrastructure.pdf_parser import (
    UPLOAD_DIR,
    MAX_BYTES,
    TEN_FILE,
    doc_tai_lieu,
    nhan_dien_loai_chung_tu,
    trich_hoa_don,
    trich_phieu_kho,
    trich_po,
)

router = APIRouter()

EXT_MAP = {
    "PDF_DIEN_TU": ".pdf",
    "PDF_SCAN": ".pdf",
    "PDF_HON_HOP": ".pdf",
    "DOCX": ".docx",
    "XLSX": ".xlsx",
}


async def _nhan(file: UploadFile):
    data = await file.read(MAX_BYTES + 1)
    meta = doc_tai_lieu(data, file.filename or "")
    van_ban = meta["van_ban"]
    if len(van_ban.strip()) < 10 and not meta["canh_bao_ocr"]:
        raise HTTPException(422, "Không trích xuất được nội dung từ tài liệu. Hãy kiểm tra lại file hoặc nhập thủ công.")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = EXT_MAP.get(meta["loai_file"], ".pdf")
    ten = uuid.uuid4().hex + ext  # tên do hệ thống sinh, chống path traversal
    with open(os.path.join(UPLOAD_DIR, ten), "wb") as f:
        f.write(data)
    return ten, meta


@router.post("/hoa-don/upload")
async def upload_hoa_don(file: UploadFile = File(...), u=Depends(can_vai_tro("KE_TOAN_AP"))):
    ten, meta = await _nhan(file)
    vb = meta["van_ban"]
    r = trich_hoa_don(vb)
    r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]
    loai_ct = nhan_dien_loai_chung_tu(vb)
    if loai_ct != "INVOICE":
        r["canh_bao"].insert(0, f"Tài liệu có dấu hiệu là {loai_ct}, vui lòng kiểm tra kỹ trước khi xác nhận.")

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
        c.execute(
            text("INSERT INTO audit_log(nguoi_dung_id,hanh_dong,doi_tuong,doi_tuong_id,du_lieu_moi) VALUES(:u,'UPLOAD','hoa_don',0,CAST(:j AS JSONB))"),
            {"u": u["id"], "j": json.dumps({"file_pdf": ten, "loai_file": meta["loai_file"], "phuong_phap": meta["phuong_phap"], "so_trang": meta["so_trang"]})},
        )
    return {
        "file_pdf": ten,
        "loai_file": meta["loai_file"],
        "phuong_phap": meta["phuong_phap"],
        "so_trang": meta["so_trang"],
        "loai_chung_tu_nhan_dien": loai_ct,
        "nha_cung_cap_id": ncc,
        "po_id": po,
        **{k: (str(v) if k in ("vat", "tien_coc_tru") and v is not None else v) for k, v in r.items() if k != "dong"},
        "dong": [{k: (str(v) if not isinstance(v, (str, bool)) else v) for k, v in d.items()} for d in r["dong"]],
    }


@router.post("/phieu-kho/upload")
async def upload_phieu_kho(file: UploadFile = File(...), u=Depends(can_vai_tro("THU_KHO"))):
    ten, meta = await _nhan(file)
    vb = meta["van_ban"]
    r = trich_phieu_kho(vb)
    r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]

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
        c.execute(
            text("INSERT INTO audit_log(nguoi_dung_id,hanh_dong,doi_tuong,doi_tuong_id,du_lieu_moi) VALUES(:u,'UPLOAD','phieu_kho',0,CAST(:j AS JSONB))"),
            {"u": u["id"], "j": json.dumps({"file_pdf": ten, "loai_file": meta["loai_file"], "phuong_phap": meta["phuong_phap"], "so_trang": meta["so_trang"]})},
        )
    return {
        "file_pdf": ten,
        "loai_file": meta["loai_file"],
        "phuong_phap": meta["phuong_phap"],
        "so_trang": meta["so_trang"],
        "po_id": po,
        **{k: v for k, v in r.items() if k != "dong"},
        "dong": [{k: (str(v) if not isinstance(v, (str, int, type(None))) else v) for k, v in d.items()} for d in r["dong"]],
    }


@router.post("/po/upload")
async def upload_po(file: UploadFile = File(...), u=Depends(can_vai_tro("MUA_HANG"))):
    ten, meta = await _nhan(file)
    vb = meta["van_ban"]
    r = trich_po(vb)
    r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]

    with engine.begin() as c:
        phien(c, u["id"])
        ncc = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst=:m"), {"m": r["mst"]}).scalar() if r["mst"] else None
        if r["mst"] and not ncc:
            r["canh_bao"].append("MST chưa có trong danh mục NCC")
        if r["so_po"] and c.execute(text("SELECT 1 FROM don_hang_po WHERE so_po=:p"), {"p": r["so_po"]}).first():
            r["canh_bao"].append("Số PO đã tồn tại trong hệ thống")
        c.execute(
            text("INSERT INTO audit_log(nguoi_dung_id,hanh_dong,doi_tuong,doi_tuong_id,du_lieu_moi) VALUES(:u,'UPLOAD','don_hang_po',0,CAST(:j AS JSONB))"),
            {"u": u["id"], "j": json.dumps({"file_pdf": ten, "loai_file": meta["loai_file"], "phuong_phap": meta["phuong_phap"], "so_trang": meta["so_trang"]})},
        )
    return {
        "file_pdf": ten,
        "loai_file": meta["loai_file"],
        "phuong_phap": meta["phuong_phap"],
        "so_trang": meta["so_trang"],
        "nha_cung_cap_id": ncc,
        **{k: (str(v) if k == "tien_coc" and v is not None else v) for k, v in r.items() if k != "dong"},
        "dong": [{k: (str(v) if not isinstance(v, (str, type(None))) else v) for k, v in d.items()} for d in r["dong"]],
    }


@router.get("/tep-dinh-kem/{ten_file}")
def xem_tep_dinh_kem(ten_file: str):
    """Cho phép xem trước (Preview) file PDF vừa upload trước khi xác nhận lưu."""
    if not TEN_FILE.match(ten_file):
        raise HTTPException(422, "Tên file không hợp lệ")
    path = os.path.join(UPLOAD_DIR, ten_file)
    if not os.path.exists(path):
        raise HTTPException(404, "Không tìm thấy file")
    media_type = "application/pdf" if ten_file.endswith(".pdf") else "application/octet-stream"
    return FileResponse(path, media_type=media_type)


@router.get("/hoa-don/{hid}/file")
def tai_file_hoa_don(hid: int, u=Depends(nguoi_dung)):
    with engine.connect() as c:
        f = c.execute(text("SELECT file_pdf FROM hoa_don WHERE id=:i"), {"i": hid}).scalar()
    if not f:
        raise HTTPException(404, "Hóa đơn không có file đính kèm")
    return FileResponse(os.path.join(UPLOAD_DIR, f), media_type="application/pdf")
