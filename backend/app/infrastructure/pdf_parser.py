"""Đọc PDF và trích trường (F-01, F-04). Các hàm trich_* là hàm thuần trên văn bản nên test được."""
import io, os, re
from decimal import Decimal as D
from fastapi import HTTPException

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
MAX_BYTES = 10 * 1024 * 1024
TEN_FILE = re.compile(r"^[0-9a-f]{32}\.pdf$")


def kiem_tra_file(ten):
    """Chỉ nhận tên file do hệ thống sinh (chống path traversal) và file phải tồn tại."""
    if ten is None:
        return
    if not TEN_FILE.match(ten) or not os.path.exists(os.path.join(UPLOAD_DIR, ten)):
        raise HTTPException(422, "file_pdf không hợp lệ, hãy upload qua /upload")


def kiem_tra_pdf(data: bytes):
    if not data.startswith(b"%PDF-"):
        raise HTTPException(415, "Không phải file PDF")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File quá 10 MB")


def doc_van_ban(data: bytes) -> str:
    import pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)
    except Exception:
        raise HTTPException(422, "Không đọc được PDF (file hỏng hoặc có mật khẩu)")


def so(s: str) -> D:
    """'1.050.000' -> 1050000; '1.050.000,50' -> 1050000.50 (định dạng Việt Nam)."""
    return D(s.replace(".", "").replace(",", "."))


def ngay(s: str):
    m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s or "")
    return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}" if m else None


def _truong(text, *nhan):
    for n in nhan:
        m = re.search(n + r"\s*[:：]?\s*([^\n]+)", text, re.I)
        if m:
            return m[1].strip()
    return None


def _la_so(t):
    return bool(re.fullmatch(r"\d[\d.,]*", t))


def _sku_hop_le(t):
    return bool(re.fullmatch(r"[A-Za-z0-9][\w./-]*", t)) and bool(re.search(r"[\d-]", t))


def trich_hoa_don(text: str) -> dict:
    dong, canh_bao = [], []
    for ln in text.splitlines():
        t = ln.split()
        if len(t) >= 4 and _sku_hop_le(t[0]) and all(_la_so(x) for x in t[-3:]) and not re.match(r"(cộng|tổng|thuế|vat)", ln, re.I):
            dong.append({"ma_sku_ncc": t[0], "so_luong": so(t[-3]), "don_gia": so(t[-2]), "thanh_tien": so(t[-1])})
    vat = _truong(text, r"Thuế GTGT", r"VAT")
    coc = _truong(text, r"Trừ cọc", r"Tiền cọc")
    r = {"so_hoa_don": _truong(text, r"Số hóa đơn", r"Số HĐ"), "mst": _truong(text, r"Mã số thuế", r"MST"),
         "so_po": _truong(text, r"Số PO", r"Theo đơn hàng"), "ngay_lap": ngay(_truong(text, r"Ngày lập", r"Ngày") or ""),
         "vat": so(re.search(r"[\d.,]+", vat)[0]) if vat and re.search(r"\d", vat) else None,
         "tien_coc_tru": so(re.search(r"[\d.,]+", coc)[0]) if coc and re.search(r"\d", coc) else D(0), "dong": dong}
    for k in ("so_hoa_don", "mst", "so_po", "ngay_lap", "vat"):
        if r[k] is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r


def trich_phieu_kho(text: str) -> dict:
    dong, canh_bao = [], []
    for ln in text.splitlines():
        t = ln.split()
        if len(t) < 4 or not _sku_hop_le(t[0]):
            continue
        for i in range(1, len(t) - 2):  # cụm 3 số đầu tiên: nhận, đạt, từ chối; phần sau là lý do
            if all(_la_so(x) for x in t[i:i + 3]):
                dong.append({"ma_sku": t[0], "so_nhan": so(t[i]), "so_dat": so(t[i + 1]), "so_tu_choi": so(t[i + 2]),
                             "ly_do": " ".join(t[i + 3:]) or None})
                break
    r = {"so_phieu": _truong(text, r"Số phiếu"), "so_po": _truong(text, r"Số PO", r"Theo đơn hàng"),
         "ngay_nhap": ngay(_truong(text, r"Ngày nhập", r"Ngày") or ""), "dong": dong}
    for k in ("so_phieu", "so_po", "ngay_nhap"):
        if r[k] is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r
