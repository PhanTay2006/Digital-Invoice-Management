"""Bộ nhận diện & trích xuất chứng từ đa định dạng (PDF điện tử, PDF scan OCR, DOCX, XLSX).
Quy trình:
1. File Type Detection: Kiểm tra định dạng (.pdf, .docx, .xlsx) và dung lượng (<= 10MB).
2. PDF Processing (hỗ trợ nhiều trang):
   - Trang có lớp văn bản điện tử (>= 20 ký tự) -> trích xuất bằng pdfplumber.
   - Trang là ảnh scan (< 20 ký tự) -> tự động chuyển sang PaddleOCR (sắp xếp bounding box theo dòng).
3. Information Extraction: Tự nhận diện loại chứng từ (PO / GRN / INVOICE) và bóc tách các trường + dòng hàng.
"""
import io
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from decimal import Decimal as D
from fastapi import HTTPException

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
MAX_BYTES = 10 * 1024 * 1024
TEN_FILE = re.compile(r"^[0-9a-f]{32}\.(pdf|docx|xlsx)$")

_PADDLE_OCR_INSTANCE = None


def _get_paddle_ocr():
    """Khởi tạo lười (lazy-init) PaddleOCR để không làm chậm lúc khởi động API."""
    global _PADDLE_OCR_INSTANCE
    if _PADDLE_OCR_INSTANCE is None:
        from paddleocr import PaddleOCR
        _PADDLE_OCR_INSTANCE = PaddleOCR(use_angle_cls=True, lang="vi", show_log=False)
    return _PADDLE_OCR_INSTANCE


def kiem_tra_file(ten):
    """Chỉ nhận tên file do hệ thống sinh (chống path traversal) và file phải tồn tại."""
    if ten is None:
        return
    if not TEN_FILE.match(ten) or not os.path.exists(os.path.join(UPLOAD_DIR, ten)):
        raise HTTPException(422, "file đính kèm không hợp lệ, hãy upload qua /upload")


def kiem_tra_pdf(data: bytes):
    if not data.startswith(b"%PDF-"):
        raise HTTPException(415, "Không phải file PDF")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File quá 10 MB")


def nhan_dien_loai_file(data: bytes, filename: str = "") -> str:
    """Bước 1 - File Type Detection: Kiểm tra định dạng thực tế của file."""
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File vượt quá dung lượng tối đa 10 MB")
    ext = (os.path.splitext(filename or "")[1] or "").lower()
    if data.startswith(b"%PDF-"):
        return "PDF"
    if data.startswith(b"PK\x03\x04"):
        if ext == ".docx":
            return "DOCX"
        if ext == ".xlsx":
            return "XLSX"
        # Tự động kiểm tra cấu trúc ZIP bên trong nếu không rõ đuôi file
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = zf.namelist()
                if "word/document.xml" in names:
                    return "DOCX"
                if any(n.startswith("xl/") for n in names):
                    return "XLSX"
        except Exception:
            pass
    raise HTTPException(415, "Định dạng file không hỗ trợ. Chỉ nhận PDF, DOCX hoặc XLSX.")


def _sap_xep_ket_qua_ocr_theo_dong(ocr_lines, y_tolerance: float = 12.0) -> str:
    """Gom các box văn bản từ PaddleOCR nằm cùng một hàng ngang (theo tọa độ Y) thành từng dòng chuẩn."""
    items = []
    for line in ocr_lines or []:
        if not line or len(line) < 2:
            continue
        box, info = line[0], line[1]
        text = info[0] if isinstance(info, (list, tuple)) and info else ""
        if not text or not str(text).strip():
            continue
        y_top = min(pt[1] for pt in box)
        x_left = min(pt[0] for pt in box)
        items.append((y_top, x_left, str(text).strip()))

    if not items:
        return ""

    items.sort(key=lambda x: (x[0], x[1]))
    rows = []
    cur_row = [items[0]]
    for item in items[1:]:
        if abs(item[0] - cur_row[-1][0]) <= y_tolerance:
            cur_row.append(item)
        else:
            cur_row.sort(key=lambda x: x[1])
            rows.append(" ".join(x[2] for x in cur_row))
            cur_row = [item]
    if cur_row:
        cur_row.sort(key=lambda x: x[1])
        rows.append(" ".join(x[2] for x in cur_row))
    return "\n".join(rows)


def ocr_trang_pdf(page) -> tuple[str, str | None]:
    """Chạy PaddleOCR trên 1 trang PDF dạng ảnh scan.
    Trả về (van_ban_ocr, canh_bao_neu_co).
    """
    try:
        import numpy as np
        pil_img = page.to_image(resolution=200).original.convert("RGB")
        img_np = np.array(pil_img)
        ocr = _get_paddle_ocr()
        result = ocr.ocr(img_np, cls=True)
        page_lines = result[0] if result and isinstance(result, list) else []
        text = _sap_xep_ket_qua_ocr_theo_dong(page_lines)
        return text, None
    except ImportError:
        return "", "Trang PDF dạng ảnh scan nhưng thư viện PaddleOCR chưa được cài đặt trong môi trường hiện tại."
    except Exception as e:
        return "", f"Lỗi khi chạy PaddleOCR trên trang scan: {str(e)[:120]}"


def _doc_docx(data: bytes) -> str:
    """Đọc toàn bộ đoạn văn và bảng biểu từ file Word (.docx)."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            xml_content = z.read("word/document.xml")
        tree = ET.fromstring(xml_content)
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        lines = []
        for elem in tree.iter():
            if elem.tag == f"{ns}tr":
                row_cells = []
                for tc in elem.findall(f".//{ns}tc"):
                    cell_text = "".join(t.text for t in tc.iter(f"{ns}t") if t.text).strip()
                    if cell_text:
                        row_cells.append(cell_text)
                if row_cells:
                    lines.append(" ".join(row_cells))
            elif elem.tag == f"{ns}p":
                texts = [t.text for t in elem.iter(f"{ns}t") if t.text]
                if texts:
                    lines.append("".join(texts).strip())
        return "\n".join(dict.fromkeys(l for l in lines if l))
    except Exception:
        raise HTTPException(422, "Không đọc được file DOCX (file hỏng)")


def _doc_xlsx(data: bytes) -> str:
    """Đọc các dòng dữ liệu từ file Excel (.xlsx)."""
    from openpyxl import load_workbook
    try:
        wb = load_workbook(io.BytesIO(data), data_only=True)
        lines = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                vals = [str(v).strip() for v in row if v is not None and str(v).strip()]
                if vals:
                    lines.append(" ".join(vals))
        return "\n".join(lines)
    except Exception:
        raise HTTPException(422, "Không đọc được file XLSX (file hỏng)")


def doc_tai_lieu(data: bytes, filename: str = "") -> dict:
    """Bước 2 - Xử lý tự động PDF điện tử (pdfplumber) vs PDF scan (PaddleOCR), DOCX, XLSX.
    Hỗ trợ PDF nhiều trang.
    Trả về dict:
      - van_ban: toàn bộ văn bản trích xuất
      - loai_file: PDF_DIEN_TU | PDF_SCAN | PDF_HON_HOP | DOCX | XLSX
      - phuong_phap: pdfplumber | PaddleOCR | pdfplumber + PaddleOCR | docx_parser | openpyxl
      - so_trang: số trang
      - canh_bao_ocr: list cảnh báo (nếu có)
    """
    dinh_dang = nhan_dien_loai_file(data, filename)

    if dinh_dang == "DOCX":
        vb = _doc_docx(data)
        return {
            "van_ban": vb,
            "loai_file": "DOCX",
            "phuong_phap": "docx_parser",
            "so_trang": 1,
            "canh_bao_ocr": [],
        }

    if dinh_dang == "XLSX":
        vb = _doc_xlsx(data)
        return {
            "van_ban": vb,
            "loai_file": "XLSX",
            "phuong_phap": "openpyxl",
            "so_trang": 1,
            "canh_bao_ocr": [],
        }

    # Xử lý file PDF (1 hoặc nhiều trang)
    import pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            so_trang = len(pdf.pages)
            if so_trang == 0:
                raise HTTPException(422, "File PDF trống (0 trang)")

            trang_texts = []
            dung_pdfplumber = False
            dung_ocr = False
            canh_bao_ocr = []

            for idx, page in enumerate(pdf.pages, start=1):
                txt = (page.extract_text() or "").strip()
                if len(txt) >= 20:
                    dung_pdfplumber = True
                    trang_texts.append(txt)
                else:
                    # Trang này không có lớp văn bản điện tử -> Tự động chuyển sang PaddleOCR
                    dung_ocr = True
                    ocr_txt, err = ocr_trang_pdf(page)
                    if err and err not in canh_bao_ocr:
                        canh_bao_ocr.append(err)
                    trang_texts.append(ocr_txt or txt)

            if dung_pdfplumber and dung_ocr:
                loai_file = "PDF_HON_HOP"
                phuong_phap = "pdfplumber + PaddleOCR"
            elif dung_ocr:
                loai_file = "PDF_SCAN"
                phuong_phap = "PaddleOCR"
            else:
                loai_file = "PDF_DIEN_TU"
                phuong_phap = "pdfplumber"

            return {
                "van_ban": "\n".join(t for t in trang_texts if t),
                "loai_file": loai_file,
                "phuong_phap": phuong_phap,
                "so_trang": so_trang,
                "canh_bao_ocr": canh_bao_ocr,
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "Không đọc được PDF (file hỏng hoặc có mật khẩu)")


def doc_van_ban(data: bytes) -> str:
    """Hàm tương thích ngược: đọc văn bản từ PDF (tự động dùng pdfplumber hoặc PaddleOCR)."""
    return doc_tai_lieu(data, "file.pdf")["van_ban"]


def nhan_dien_loai_chung_tu(text: str) -> str:
    """Tự động phân loại chứng từ thuộc PO, GRN hay INVOICE dựa trên nội dung."""
    t = (text or "").lower()
    if any(k in t for k in ("phiếu nhập kho", "goods receipt", "grn-", "số phiếu")):
        return "GRN"
    if any(k in t for k in ("hóa đơn", "gtgt", "invoice", "mẫu số", "thuế gtgt", "số hđ")):
        return "INVOICE"
    if any(k in t for k in ("đơn đặt hàng", "purchase order", "ngày đặt")):
        return "PO"
    return "INVOICE"


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
    r = {
        "so_hoa_don": _truong(text, r"Số hóa đơn", r"Số HĐ"),
        "mst": _truong(text, r"Mã số thuế", r"MST"),
        "so_po": _truong(text, r"Số PO", r"Theo đơn hàng"),
        "ngay_lap": ngay(_truong(text, r"Ngày lập", r"Ngày") or ""),
        "vat": so(re.search(r"[\d.,]+", vat)[0]) if vat and re.search(r"\d", vat) else None,
        "tien_coc_tru": so(re.search(r"[\d.,]+", coc)[0]) if coc and re.search(r"\d", coc) else D(0),
        "dong": dong,
    }
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
                dong.append({
                    "ma_sku": t[0],
                    "so_nhan": so(t[i]),
                    "so_dat": so(t[i + 1]),
                    "so_tu_choi": so(t[i + 2]),
                    "ly_do": " ".join(t[i + 3:]) or None,
                })
                break
    r = {
        "so_phieu": _truong(text, r"Số phiếu"),
        "so_po": _truong(text, r"Số PO", r"Theo đơn hàng"),
        "ngay_nhap": ngay(_truong(text, r"Ngày nhập", r"Ngày") or ""),
        "dong": dong,
    }
    for k in ("so_phieu", "so_po", "ngay_nhap"):
        if r[k] is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r


def trich_po(text: str) -> dict:
    """Trích xuất thông tin Đơn đặt hàng (PO) từ văn bản PDF/DOCX/XLSX."""
    dong, canh_bao = [], []
    for ln in text.splitlines():
        t = ln.split()
        if len(t) >= 3 and _sku_hop_le(t[0]) and all(_la_so(x) for x in t[-2:]) and not re.match(r"(cộng|tổng|thuế|vat|cọc)", ln, re.I):
            # Nếu có 3 cột số ở cuối (Số lượng, Đơn giá, Thành tiền) thì lấy [-3] và [-2]
            if len(t) >= 4 and _la_so(t[-3]):
                sl, dg = so(t[-3]), so(t[-2])
                mo_ta = " ".join(t[1:-3]) or None
            else:
                sl, dg = so(t[-2]), so(t[-1])
                mo_ta = " ".join(t[1:-2]) or None
            dong.append({"ma_sku": t[0], "mo_ta": mo_ta, "so_luong_dat": sl, "don_gia": dg})
    coc = _truong(text, r"Tiền cọc", r"Đặt cọc")
    r = {
        "so_po": _truong(text, r"Số PO", r"Mã PO", r"Đơn đặt hàng"),
        "mst": _truong(text, r"Mã số thuế", r"MST"),
        "ngay_dat": ngay(_truong(text, r"Ngày đặt", r"Ngày lập", r"Ngày") or ""),
        "tien_coc": so(re.search(r"[\d.,]+", coc)[0]) if coc and re.search(r"\d", coc) else D(0),
        "dong": dong,
    }
    for k in ("so_po", "mst", "ngay_dat"):
        if r[k] is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r
