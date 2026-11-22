"""Upload chứng từ (PDF điện tử / PDF scan VLM & OCR / DOCX / XLSX) -> Trích xuất bản nháp.
Tuân thủ quy tắc:
- Người dùng không cần phân biệt PDF điện tử hay PDF scan (hệ thống tự điều phối pdfplumber / VLM / OCR).
- Hỗ trợ PDF nhiều trang.
- Không tự động lưu dữ liệu trích xuất vào quy trình đối soát trước khi người dùng kiểm tra và bấm Xác nhận.
"""
import asyncio
import json
import os
import threading
import uuid
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, nguoi_dung, can_vai_tro, phien
from ..domain.company import DEFAULT_COMPANY_INFO, doi_chieu_cong_ty
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
from ..infrastructure.vlm_extractor import (
    ExtractionCancelled,
    _co_thieu_truong_quan_trong,
    _gop_ket_qua_vlm,
    trich_xuat_bang_vlm,
    vlm_san_sang,
)

router = APIRouter()

EXT_MAP = {
    "PDF_DIEN_TU": ".pdf",
    "PDF_SCAN": ".pdf",
    "PDF_HON_HOP": ".pdf",
    "DOCX": ".docx",
    "XLSX": ".xlsx",
    "IMAGE": ".png",
}


def _luu_tep_upload(data: bytes, filename: str, loai_file: str) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    orig_ext = os.path.splitext(filename or "")[1].lower()
    if loai_file == "IMAGE" and orig_ext in (".png", ".jpg", ".jpeg"):
        ext = orig_ext
    else:
        ext = EXT_MAP.get(loai_file, ".pdf")
    ten = uuid.uuid4().hex + ext  # tên do hệ thống sinh, chống path traversal
    with open(os.path.join(UPLOAD_DIR, ten), "wb") as f:
        f.write(data)
    return ten


def _trich_theo_loai_regex(vb: str, loai_chung_tu: str) -> dict:
    if loai_chung_tu == "GRN":
        return trich_phieu_kho(vb)
    if loai_chung_tu == "PO":
        return trich_po(vb)
    return trich_hoa_don(vb)


async def _chay_co_the_huy(request: Request, fn):
    """Chạy tác vụ trích xuất trên worker thread và theo dõi ngắt kết nối để hủy kịp thời."""
    cancel_event = threading.Event()
    worker_task = asyncio.create_task(asyncio.to_thread(fn, cancel_event))
    try:
        while not worker_task.done():
            if await request.is_disconnected():
                cancel_event.set()
                raise HTTPException(499, "Đã hủy quá trình trích xuất")
            await asyncio.wait({worker_task}, timeout=0.15)
        return worker_task.result()
    except ExtractionCancelled:
        raise HTTPException(499, "Đã hủy quá trình trích xuất")


async def _nhan_va_trich_xuat(request: Request, file: UploadFile, loai_chung_tu: str):
    data = await file.read(MAX_BYTES + 1)
    if await request.is_disconnected():
        raise HTTPException(499, "Đã hủy quá trình trích xuất")
    filename = file.filename or ""
    dung_vlm = vlm_san_sang()

    def _xu_ly_sync(cancel_event: threading.Event):
        if cancel_event.is_set():
            raise ExtractionCancelled()
        meta = doc_tai_lieu(data, filename, cho_phep_ocr=not dung_vlm)
        loai_file = meta["loai_file"]
        vb = meta["van_ban"]
        loi_vlm: list[str] = []

        if loai_file in ("DOCX", "XLSX"):
            if len(vb.strip()) < 10:
                raise HTTPException(422, "Không trích xuất được nội dung từ tài liệu. Hãy kiểm tra lại file hoặc nhập thủ công.")
            r = _trich_theo_loai_regex(vb, loai_chung_tu)
            r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]
            return meta, vb, r, nhan_dien_loai_chung_tu(vb), False

        if loai_file == "PDF_DIEN_TU":
            r = _trich_theo_loai_regex(vb, loai_chung_tu)
            r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]
            loai_ct = nhan_dien_loai_chung_tu(vb)
            if dung_vlm and _co_thieu_truong_quan_trong(r, loai_chung_tu):
                if cancel_event.is_set():
                    raise ExtractionCancelled()
                vlm_out = trich_xuat_bang_vlm(data, filename, loai_chung_tu, loi_out=loi_vlm, cancel_event=cancel_event)
                if vlm_out:
                    r = _gop_ket_qua_vlm(r, vlm_out["ket_qua"], loai_chung_tu)
                    meta["phuong_phap"] = f"pdfplumber + {vlm_out['phuong_phap']}"
            return meta, vb, r, loai_ct, False

        if dung_vlm:
            vlm_out = trich_xuat_bang_vlm(data, filename, loai_chung_tu, loi_out=loi_vlm, cancel_event=cancel_event)
            if vlm_out:
                meta["phuong_phap"] = vlm_out["phuong_phap"]
                return meta, vlm_out["van_ban_tom_tat"], vlm_out["ket_qua"], vlm_out["loai_chung_tu"], False
            if cancel_event.is_set():
                raise ExtractionCancelled()
            # Fallback sang OCR local khi tất cả VLM gặp lỗi
            meta = doc_tai_lieu(data, filename, cho_phep_ocr=True)
            vb = meta["van_ban"]

        if len(vb.strip()) < 10 and not meta["canh_bao_ocr"]:
            if loi_vlm:
                meta["canh_bao_ocr"] = [f"Không đọc được bằng VLM ({'; '.join(loi_vlm)[:140]}) và không trích xuất được chữ từ tài liệu."]
            else:
                raise HTTPException(422, "Không trích xuất được nội dung từ tài liệu. Hãy kiểm tra lại file hoặc nhập thủ công.")

        r = _trich_theo_loai_regex(vb, loai_chung_tu)
        khong_co_text = len(vb.strip()) < 10 and bool(meta["canh_bao_ocr"])
        loai_ct = nhan_dien_loai_chung_tu(vb)
        if khong_co_text:
            r["canh_bao"] = list(meta["canh_bao_ocr"])
        else:
            r["canh_bao"] = list(meta["canh_bao_ocr"]) + r["canh_bao"]
        if loi_vlm and meta["phuong_phap"] != "VLM":
            msg_vlm = f"VLM tạm thời chưa phản hồi ({loi_vlm[0][:90]}), đã tự chuyển sang OCR dự phòng."
            if msg_vlm not in r["canh_bao"]:
                r["canh_bao"].append(msg_vlm)
        return meta, vb, r, loai_ct, khong_co_text

    meta, vb, r, loai_ct, khong_co_text = await _chay_co_the_huy(request, _xu_ly_sync)
    if await request.is_disconnected():
        raise HTTPException(499, "Đã hủy quá trình trích xuất")
    ten = _luu_tep_upload(data, filename, meta["loai_file"])
    return ten, meta, vb, r, loai_ct, khong_co_text


def _lay_cong_ty_hien_hanh(c) -> dict:
    try:
        with c.begin_nested():
            row = c.execute(text("SELECT * FROM thong_tin_cong_ty ORDER BY id DESC LIMIT 1")).mappings().first()
            if row:
                return dict(row)
    except DBAPIError:
        pass
    return dict(DEFAULT_COMPANY_INFO)


@router.post("/hoa-don/upload")
async def upload_hoa_don(request: Request, file: UploadFile = File(...), u=Depends(can_vai_tro("KE_TOAN_AP"))):
    ten, meta, vb, r, loai_ct, khong_co_text = await _nhan_va_trich_xuat(request, file, "INVOICE")
    if not khong_co_text and loai_ct != "INVOICE":
        r["canh_bao"].insert(0, f"Tài liệu có dấu hiệu là {loai_ct}, vui lòng kiểm tra kỹ trước khi xác nhận.")

    with engine.begin() as c:
        phien(c, u["id"])
        ncc = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst=:m"), {"m": r["mst"]}).scalar() if r["mst"] else None
        po = c.execute(text("SELECT id FROM don_hang_po WHERE so_po=:p"), {"p": r["so_po"]}).scalar() if r["so_po"] else None
        cong_ty = _lay_cong_ty_hien_hanh(c)
        kiem_tra_cong_ty = doi_chieu_cong_ty(r.get("ten_nguoi_mua"), r.get("mst_nguoi_mua"), cong_ty)
        if not khong_co_text:
            if kiem_tra_cong_ty["trang_thai"] == "KHONG_KHOP":
                r["canh_bao"].insert(0, kiem_tra_cong_ty["thong_bao"])
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
        "kiem_tra_cong_ty": kiem_tra_cong_ty,
        "van_ban_trich_xuat": vb[:4000],
        **{k: (str(v) if k in ("vat", "tien_coc_tru", "tong_thanh_toan") and v is not None else v) for k, v in r.items() if k != "dong"},
        "dong": [{k: (str(v) if not isinstance(v, (str, bool)) else v) for k, v in d.items()} for d in r["dong"]],
    }


@router.post("/phieu-kho/upload")
async def upload_phieu_kho(request: Request, file: UploadFile = File(...), u=Depends(can_vai_tro("THU_KHO"))):
    ten, meta, vb, r, _, khong_co_text = await _nhan_va_trich_xuat(request, file, "GRN")

    with engine.begin() as c:
        phien(c, u["id"])
        po = c.execute(text("SELECT id FROM don_hang_po WHERE so_po=:p"), {"p": r["so_po"]}).scalar() if r["so_po"] else None
        cong_ty = _lay_cong_ty_hien_hanh(c)
        kiem_tra_cong_ty = doi_chieu_cong_ty(r.get("ten_nguoi_mua"), r.get("mst_nguoi_mua"), cong_ty)
        if not khong_co_text:
            if kiem_tra_cong_ty["trang_thai"] == "KHONG_KHOP":
                r["canh_bao"].insert(0, kiem_tra_cong_ty["thong_bao"])
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
        "kiem_tra_cong_ty": kiem_tra_cong_ty,
        "van_ban_trich_xuat": vb[:4000],
        **{k: v for k, v in r.items() if k != "dong"},
        "dong": [{k: (str(v) if not isinstance(v, (str, int, type(None))) else v) for k, v in d.items()} for d in r["dong"]],
    }


@router.post("/po/upload")
async def upload_po(request: Request, file: UploadFile = File(...), u=Depends(can_vai_tro("MUA_HANG"))):
    ten, meta, vb, r, _, khong_co_text = await _nhan_va_trich_xuat(request, file, "PO")

    with engine.begin() as c:
        phien(c, u["id"])
        ncc = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst=:m"), {"m": r["mst"]}).scalar() if r["mst"] else None
        if not khong_co_text:
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
        "van_ban_trich_xuat": vb[:4000],
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
def tai_file_hoa_don(hid: int, u=Depends(can_vai_tro("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    with engine.connect() as c:
        f = c.execute(text("SELECT file_pdf FROM hoa_don WHERE id=:i"), {"i": hid}).scalar()
    if not f:
        raise HTTPException(404, "Hóa đơn không có file đính kèm")
    return FileResponse(os.path.join(UPLOAD_DIR, f), media_type="application/pdf")
