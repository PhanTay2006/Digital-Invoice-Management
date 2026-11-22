"""Bộ nhận diện & trích xuất chứng từ đa định dạng (PDF điện tử, PDF scan OCR, ảnh, DOCX, XLSX).
Quy trình:
1. File Type Detection: Kiểm tra định dạng (.pdf, .docx, .xlsx, .png, .jpg, .jpeg) và dung lượng (<= 10MB).
2. Document / OCR Processing (hỗ trợ PDF nhiều trang và ảnh trực tiếp):
   - Trang PDF có lớp văn bản điện tử (>= 20 ký tự) -> trích xuất bằng pdfplumber.
   - Trang PDF dạng ảnh scan (< 20 ký tự) hoặc ảnh tải lên -> tiền xử lý ảnh 300 DPI + TesseractOCR tiếng Việt
     (dự phòng PaddleOCR nếu có), gom bounding box theo từng dòng ngang.
3. Information Extraction: Tự nhận diện loại chứng từ (PO / GRN / INVOICE) và bóc tách trường + dòng hàng.
"""
import io
import os
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal as D
from fastapi import HTTPException

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "./uploads")
MAX_BYTES = 10 * 1024 * 1024
TEN_FILE = re.compile(r"^[0-9a-f]{32}\.(pdf|docx|xlsx|png|jpg|jpeg)$")

_PADDLE_OCR_INSTANCE = None
_RAPID_OCR_INSTANCE = None
_DON_VI_TINH = {
    "khóa", "khoa", "cái", "cai", "chiếc", "chiec", "bộ", "bo", "hộp", "hop",
    "kg", "g", "tấn", "tan", "tạ", "ta", "lít", "lit", "m", "m2", "m3",
    "gói", "goi", "thùng", "thung", "chai", "lon", "túi", "tui", "cuộn", "cuon",
    "lần", "lan", "tháng", "thang", "năm", "nam", "suất", "suat", "viên", "vien",
}


def _get_rapid_ocr():
    """Khởi tạo lười (lazy-init) RapidOCR ONNX cho việc phát hiện vùng chữ và đọc số/mã."""
    global _RAPID_OCR_INSTANCE
    if _RAPID_OCR_INSTANCE is None:
        from rapidocr_onnxruntime import RapidOCR
        _RAPID_OCR_INSTANCE = RapidOCR()
    return _RAPID_OCR_INSTANCE


def _get_paddle_ocr():
    """Khởi tạo lười (lazy-init) PaddleOCR nếu có cài đặt làm phương án dự phòng."""
    global _PADDLE_OCR_INSTANCE
    if _PADDLE_OCR_INSTANCE is None:
        from paddleocr import PaddleOCR
        try:
            _PADDLE_OCR_INSTANCE = PaddleOCR(use_angle_cls=True, lang="vi")
        except TypeError:
            _PADDLE_OCR_INSTANCE = PaddleOCR(lang="vi")
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
    if data.startswith(b"\x89PNG\r\n\x1a\n") or data.startswith(b"\xff\xd8\xff"):
        return "IMAGE"
    if data.startswith(b"PK\x03\x04"):
        if ext == ".docx":
            return "DOCX"
        if ext == ".xlsx":
            return "XLSX"
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = zf.namelist()
                if "word/document.xml" in names:
                    return "DOCX"
                if any(n.startswith("xl/") for n in names):
                    return "XLSX"
        except Exception:
            pass
    raise HTTPException(415, "Định dạng file không hỗ trợ. Chỉ nhận PDF, ảnh (PNG/JPG), DOCX hoặc XLSX.")


def _sap_xep_ket_qua_ocr_theo_dong(ocr_lines, y_tolerance: float | None = None) -> str:
    """Gom các box văn bản từ OCR nằm cùng một hàng ngang (theo tâm Y động) thành từng dòng."""
    items = []
    for line in ocr_lines or []:
        if not line or len(line) < 2:
            continue
        box, info = line[0], line[1]
        text = info[0] if isinstance(info, (list, tuple)) and info else str(info or "")
        if not text or not str(text).strip():
            continue
        ys = [pt[1] for pt in box]
        xs = [pt[0] for pt in box]
        y_top, y_bottom = min(ys), max(ys)
        y_center = (y_top + y_bottom) / 2.0
        box_h = max(1.0, float(y_bottom - y_top))
        x_left = min(xs)
        items.append((y_center, x_left, box_h, str(text).strip()))

    if not items:
        return ""

    if y_tolerance is None:
        heights = sorted(x[2] for x in items)
        mid = len(heights) // 2
        median_h = heights[mid] if len(heights) % 2 == 1 else (heights[mid - 1] + heights[mid]) / 2.0
        base_tol = max(10.0, median_h * 0.6)
    else:
        base_tol = float(y_tolerance)

    items.sort(key=lambda x: (x[0], x[1]))
    rows = []
    cur_row = [items[0]]
    sum_y = items[0][0]
    sum_h = items[0][2]
    for item in items[1:]:
        cnt = len(cur_row)
        mean_y = sum_y / cnt
        mean_h = sum_h / cnt
        tol = max(base_tol, min(item[2], mean_h) * 0.55)
        if abs(item[0] - mean_y) <= tol:
            cur_row.append(item)
            sum_y += item[0]
            sum_h += item[2]
        else:
            cur_row.sort(key=lambda x: x[1])
            rows.append(" ".join(x[3] for x in cur_row))
            cur_row = [item]
            sum_y = item[0]
            sum_h = item[2]
    if cur_row:
        cur_row.sort(key=lambda x: x[1])
        rows.append(" ".join(x[3] for x in cur_row))
    return "\n".join(rows)


def _lam_sach_anh_hoa_don(pil_img):
    """Chuẩn hóa kích thước mượt và tẩy watermark/con dấu đỏ khỏi ảnh hóa đơn RGB."""
    import numpy as np
    from PIL import Image

    rgb = pil_img.convert("RGB")
    resample = getattr(Image, "Resampling", Image).LANCZOS
    w, h = rgb.size
    if w < 1400:
        new_h = max(1, round(h * (1800 / max(w, 1))))
        rgb = rgb.resize((1800, new_h), resample)
        w, h = rgb.size
    if max(w, h) > 2600:
        scale = 2600 / max(w, h)
        rgb = rgb.resize((max(1, round(w * scale)), max(1, round(h * scale))), resample)

    arr = np.array(rgb, dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    red_mask = (r > 120) & ((r - g) > 45) & ((r - b) > 45)
    arr[red_mask] = 255
    return Image.fromarray(arr.astype(np.uint8), mode="RGB")


_tien_xu_ly_anh = _lam_sach_anh_hoa_don


def _co_ky_tu_han(txt: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", txt or ""))


def _la_ma_hoac_so_thuan(txt: str) -> bool:
    s = (txt or "").strip()
    if not s or _co_ky_tu_han(s):
        return False
    if re.fullmatch(r"[\d.,:/%()xX=\s+-]+", s):
        return True
    return bool(re.fullmatch(r"[A-Z0-9._/-]{6,}", s)) and bool(re.search(r"\d", s))


def _ocr_bang_rapid_va_tesseract(clean_rgb) -> tuple[str, str]:
    """Hybrid OCR: RapidOCR (DBNet) định vị vùng chữ & đọc số/mã; Tesseract (vie) đọc dòng tiếng Việt."""
    import numpy as np
    from PIL import Image, ImageOps

    engine = _get_rapid_ocr()
    res, _ = engine(np.array(clean_rgb))
    if not res:
        return "", "RapidOCR"

    try:
        import pytesseract
    except ImportError:
        pytesseract = None

    gray_img = ImageOps.grayscale(clean_rgb)
    gray_img.load()
    resample = getattr(Image, "Resampling", Image).LANCZOS

    final_items: list[tuple[int, object, tuple[str, float]]] = []
    crop_tasks: list[tuple[int, object, str, float]] = []

    for idx, item in enumerate(res):
        if not item or len(item) < 2:
            continue
        box = item[0]
        rapid_text = str(item[1] or "").strip()
        try:
            rapid_score = float(item[2]) if len(item) > 2 else 0.0
        except (ValueError, TypeError):
            rapid_score = 0.0

        if rapid_text and rapid_score >= 0.80 and _la_ma_hoac_so_thuan(rapid_text):
            final_items.append((idx, box, (rapid_text, rapid_score)))
        elif pytesseract is not None:
            crop_tasks.append((idx, box, rapid_text, rapid_score))
        elif rapid_text and not _co_ky_tu_han(rapid_text):
            final_items.append((idx, box, (rapid_text, rapid_score)))

    used_tesseract = False
    if crop_tasks and pytesseract is not None:
        tess_not_found = getattr(pytesseract, "TesseractNotFoundError", OSError)

        def _doc_crop(task):
            idx, box, rapid_text, rapid_score = task
            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]
            x0 = max(0, int(min(xs)) - 2)
            y0 = max(0, int(min(ys)) - 2)
            x1 = min(gray_img.width, int(max(xs)) + 2)
            y1 = min(gray_img.height, int(max(ys)) + 2)
            if x1 <= x0 or y1 <= y0 or (x1 - x0) < 6 or (y1 - y0) < 8:
                return idx, box, "", rapid_text, rapid_score
            crop = gray_img.crop((x0, y0, x1, y1))
            if crop.height < 48:
                new_w = max(1, round(crop.width * (52 / max(crop.height, 1))))
                crop = crop.resize((new_w, 52), resample)
            crop_padded = ImageOps.expand(crop, border=16, fill=255)
            try:
                txt = pytesseract.image_to_string(crop_padded, lang="vie", config="--oem 3 --psm 7").strip()
            except pytesseract.TesseractError:
                txt = pytesseract.image_to_string(crop_padded, lang="eng", config="--oem 3 --psm 7").strip()
            except (tess_not_found, OSError):
                return idx, box, None, rapid_text, rapid_score
            return idx, box, txt, rapid_text, rapid_score

        with ThreadPoolExecutor(max_workers=4) as executor:
            for idx, box, tess_txt, rapid_text, rapid_score in executor.map(_doc_crop, crop_tasks):
                if tess_txt:
                    used_tesseract = True
                    final_items.append((idx, box, (tess_txt, max(rapid_score, 0.90))))
                elif rapid_text and not _co_ky_tu_han(rapid_text):
                    final_items.append((idx, box, (rapid_text, rapid_score)))

    final_items.sort(key=lambda x: x[0])
    final_boxes = [(box, info) for _, box, info in final_items]
    text = _sap_xep_ket_qua_ocr_theo_dong(final_boxes)
    return text, ("RapidOCR+Tesseract" if used_tesseract else "RapidOCR")


def _ocr_bang_tesseract(clean_rgb) -> str:
    import pytesseract
    from PIL import ImageOps
    from pytesseract import Output

    gray = ImageOps.grayscale(clean_rgb)
    lang = "vie"
    try:
        data = pytesseract.image_to_data(gray, lang=lang, config="--oem 3 --psm 3", output_type=Output.DICT)
    except pytesseract.TesseractError:
        lang = "eng"
        data = pytesseract.image_to_data(gray, lang=lang, config="--oem 3 --psm 3", output_type=Output.DICT)

    boxes = []
    n = len(data.get("text", []))
    for i in range(n):
        word = (data["text"][i] or "").strip()
        if not word:
            continue
        try:
            conf = float(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1.0
        has_digit = bool(re.search(r"\d", word))
        if conf < (15.0 if has_digit else 25.0):
            continue
        x = int(data["left"][i])
        y = int(data["top"][i])
        w = int(data["width"][i])
        h = int(data["height"][i])
        boxes.append(([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], (word, conf / 100.0)))

    text = _sap_xep_ket_qua_ocr_theo_dong(boxes)
    if not text.strip():
        text = pytesseract.image_to_string(gray, lang=lang, config="--oem 3 --psm 3").strip()
    return text


def _ocr_bang_paddle(pil_img) -> str:
    import numpy as np

    img_np = np.array(pil_img.convert("RGB"))
    ocr = _get_paddle_ocr()
    if hasattr(ocr, "ocr"):
        result = ocr.ocr(img_np, cls=True)
        page_lines = result[0] if result and isinstance(result, list) else []
        return _sap_xep_ket_qua_ocr_theo_dong(page_lines)
    if hasattr(ocr, "predict"):
        res = ocr.predict(img_np)
        lines = []
        for item in res or []:
            if isinstance(item, dict) and "rec_texts" in item:
                lines.extend(str(t) for t in item["rec_texts"] if str(t).strip())
        return "\n".join(lines)
    return ""


def ocr_hinh_anh(pil_img) -> tuple[str, str, str | None]:
    """Chạy OCR trên 1 ảnh PIL. Ưu tiên Hybrid RapidOCR+Tesseract, dự phòng Tesseract/PaddleOCR.
    Trả về (van_ban, ten_engine, canh_bao_neu_co).
    """
    clean_rgb = _lam_sach_anh_hoa_don(pil_img)
    tess_err_msg = None

    try:
        text, engine_name = _ocr_bang_rapid_va_tesseract(clean_rgb)
        if len(text.strip()) >= 10:
            return text, engine_name, None
    except ImportError:
        pass
    except Exception:
        pass

    try:
        text = _ocr_bang_tesseract(clean_rgb)
        return text, "TesseractOCR", None
    except ImportError:
        pass
    except Exception as e_tess:
        tess_err_msg = str(e_tess)

    try:
        text = _ocr_bang_paddle(clean_rgb)
        return text, "PaddleOCR", None
    except ImportError:
        if tess_err_msg:
            if "not installed" in tess_err_msg.lower() or "not in your path" in tess_err_msg.lower():
                return "", "OCR", "Chưa có Tesseract OCR trong container. Hãy chạy 'sudo docker compose up -d --build' để cài đặt."
            return "", "TesseractOCR", f"Lỗi khi chạy TesseractOCR: {tess_err_msg[:120]}"
        return "", "OCR", "Chưa cài đặt engine OCR (RapidOCR/TesseractOCR). Hãy chạy 'sudo docker compose up -d --build'."
    except Exception as e_pad:
        if tess_err_msg:
            return "", "TesseractOCR", f"Lỗi khi chạy TesseractOCR: {tess_err_msg[:120]}"
        return "", "PaddleOCR", f"Lỗi khi chạy PaddleOCR: {str(e_pad)[:120]}"


def ocr_trang_pdf(page) -> tuple[str, str, str | None]:
    """Render 1 trang PDF scan ở độ phân giải 160 DPI và chạy OCR."""
    try:
        pil_img = page.to_image(resolution=160).original.convert("RGB")
        return ocr_hinh_anh(pil_img)
    except Exception as e:
        return "", "OCR", f"Không render được trang PDF scan sang ảnh: {str(e)[:120]}"


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


def doc_tai_lieu(data: bytes, filename: str = "", cho_phep_ocr: bool = True) -> dict:
    """Bước 2 - Xử lý tự động PDF điện tử (pdfplumber) vs PDF scan / ảnh (OCR), DOCX, XLSX."""
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

    if dinh_dang == "IMAGE":
        from PIL import Image
        try:
            with Image.open(io.BytesIO(data)) as img:
                if not cho_phep_ocr:
                    img.verify()
                    return {
                        "van_ban": "",
                        "loai_file": "IMAGE",
                        "phuong_phap": "VLM",
                        "so_trang": 1,
                        "canh_bao_ocr": [],
                    }
                pil_img = img.convert("RGB")
        except Exception:
            raise HTTPException(422, "Không đọc được file ảnh (file hỏng)")
        ocr_txt, engine_name, err = ocr_hinh_anh(pil_img)
        return {
            "van_ban": ocr_txt,
            "loai_file": "IMAGE",
            "phuong_phap": engine_name,
            "so_trang": 1,
            "canh_bao_ocr": [err] if err else [],
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
            ocr_engines = []
            canh_bao_ocr = []

            for page in pdf.pages:
                txt = (page.extract_text() or "").strip()
                if len(txt) >= 20:
                    dung_pdfplumber = True
                    trang_texts.append(txt)
                else:
                    dung_ocr = True
                    if cho_phep_ocr:
                        ocr_txt, engine_name, err = ocr_trang_pdf(page)
                        if engine_name and engine_name not in ocr_engines:
                            ocr_engines.append(engine_name)
                        if err and err not in canh_bao_ocr:
                            canh_bao_ocr.append(err)
                        trang_texts.append(ocr_txt or txt)
                    else:
                        if "VLM" not in ocr_engines:
                            ocr_engines.append("VLM")
                        if txt:
                            trang_texts.append(txt)

            ocr_label = " / ".join(ocr_engines) if ocr_engines else ("VLM" if not cho_phep_ocr else "OCR")
            if dung_pdfplumber and dung_ocr:
                loai_file = "PDF_HON_HOP"
                phuong_phap = f"pdfplumber + {ocr_label}"
            elif dung_ocr:
                loai_file = "PDF_SCAN"
                phuong_phap = ocr_label
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
    """Hàm tương thích ngược: đọc văn bản từ PDF."""
    return doc_tai_lieu(data, "file.pdf")["van_ban"]


def _bo_dau_va_map(s: str) -> tuple[str, list[int]]:
    """Chuẩn hóa chữ Việt không dấu (đ -> d) và lưu vị trí ký tự gốc tương ứng."""
    if not s:
        return "", []
    out: list[str] = []
    pos_map: list[int] = []
    for idx, ch in enumerate(s):
        if ch == "đ":
            out.append("d")
            pos_map.append(idx)
        elif ch == "Đ":
            out.append("D")
            pos_map.append(idx)
        else:
            for decomp in unicodedata.normalize("NFD", ch):
                if unicodedata.category(decomp) != "Mn":
                    out.append(decomp)
                    pos_map.append(idx)
    return "".join(out), pos_map


def _bo_dau(s: str) -> str:
    """Chuyển chuỗi tiếng Việt có dấu thành không dấu (chữ đ -> d)."""
    return _bo_dau_va_map(s)[0]


def nhan_dien_loai_chung_tu(text: str) -> str:
    """Tự động phân loại chứng từ thuộc PO, GRN hay INVOICE dựa trên nội dung."""
    t = _bo_dau(text or "").lower()
    if any(k in t for k in ("phieu nhap kho", "goods receipt", "grn-", "so phieu")):
        return "GRN"
    if any(k in t for k in ("hoa don", "gtgt", "invoice", "mau so", "thue gtgt", "so hd")):
        return "INVOICE"
    if any(k in t for k in ("don dat hang", "purchase order", "ngay dat")):
        return "PO"
    return "INVOICE"


def so(s: str) -> D:
    """'1.050.000' -> 1050000; '1.050.000,50' -> 1050000.50 (định dạng Việt Nam)."""
    return D(s.replace(".", "").replace(",", "."))


def ngay(s: str):
    if not s:
        return None
    norm = _bo_dau(s)
    m_iso = re.search(r"(?<!\d)(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?!\d)", norm)
    if m_iso and 1 <= int(m_iso[2]) <= 12 and 1 <= int(m_iso[3]) <= 31:
        return f"{m_iso[1]}-{int(m_iso[2]):02d}-{int(m_iso[3]):02d}"
    m = re.search(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?!\d)", norm)
    if m and 1 <= int(m[2]) <= 12 and 1 <= int(m[1]) <= 31:
        return f"{m[3]}-{int(m[2]):02d}-{int(m[1]):02d}"
    m_vn = re.search(
        r"(?:ngay(?:\s*\([^)]*\))?\s*)?(\d{1,2})\s+thang(?:\s*\([^)]*\))?\s+(\d{1,2})\s+nam(?:\s*\([^)]*\))?\s+(\d{4})",
        norm,
        re.I,
    )
    if m_vn and 1 <= int(m_vn[2]) <= 12 and 1 <= int(m_vn[1]) <= 31:
        return f"{m_vn[3]}-{int(m_vn[2]):02d}-{int(m_vn[1]):02d}"
    return None


def _cat_nhan_ben_canh(val: str) -> str:
    """Cắt bỏ phần nhãn cột kế bên nếu cùng nằm trên một dòng OCR."""
    norm, pos_map = _bo_dau_va_map(val)
    m = re.search(
        r"(?:\s{2,}|\s*[|│]\s*)(?:mau\s*so|ky\s*hieu|so\s*(?:hoa\s*don|hd|\([^)]{1,15}\))?\s*[:：]|"
        r"ma\s*so\s*thue|mst|tax\s*code|dien\s*thoai|tel|fax|so\s*tai\s*khoan|stk|ngay\b|cccd|citizen\s*id)",
        norm,
        re.I,
    )
    if m and m.start() < len(pos_map):
        return val[:pos_map[m.start()]].strip()
    return val.strip()


def _trich_theo_nhan_linh_hoat(lines: list[str], labels: tuple[str, ...]) -> str | None:
    """Tìm giá trị theo danh sách nhãn không dấu/song ngữ trên từng dòng."""
    for label in labels:
        for ln in lines:
            norm_ln, pos_map = _bo_dau_va_map(ln)
            m = re.search(
                r"(?:^|[\s|;•-])(" + label + r")(?:\s*\([^)]{1,35}\))?[ \t]*[:：][ \t]*(.+)$",
                norm_ln,
                re.I,
            )
            if not m:
                m = re.match(
                    r"^[ \t]*(" + label + r")(?:\s*\([^)]{1,35}\))?[ \t]+(.+)$",
                    norm_ln,
                    re.I,
                )
            if m and m.start(2) < len(pos_map):
                val = _cat_nhan_ben_canh(ln[pos_map[m.start(2)]:])
                if val and not re.fullmatch(r"[:：\s.-]*", val):
                    return val
    return None


def _vung_nguoi_ban(lines: list[str]) -> list[str]:
    """Lấy các dòng thuộc phần người bán (trước khu vực thông tin người mua)."""
    vung: list[str] = []
    for ln in lines:
        norm = _bo_dau(ln).lower()
        if re.search(r"\b(?:nguoi mua|ten nguoi mua|don vi mua|ten don vi mua|khach hang|buyer|purchaser)\b", norm):
            break
        vung.append(ln)
    return vung


def _vung_nguoi_mua(lines: list[str]) -> list[str]:
    """Lấy các dòng thuộc khu vực thông tin người mua (từ nhãn người mua đến trước bảng hàng hóa)."""
    vung: list[str] = []
    trong_vung = False
    for ln in lines:
        norm = _bo_dau(ln).lower()
        if not trong_vung:
            if re.search(r"\b(?:nguoi mua|ten nguoi mua|don vi mua|ten don vi mua|khach hang|buyer|purchaser)\b", norm):
                trong_vung = True
                vung.append(ln)
            continue
        if re.match(r"^(?:stt\b|1\s+2\s+3\s+4\b|ten\s+hang\s+hoa|ten\s+san\s+pham|hang\s+hoa\s*,?\s*dich\s+vu)", norm.strip()):
            break
        vung.append(ln)
    return vung


_BUYER_UNIT_LABELS = (
    r"ten\s+don\s+vi\s+mua\s+hang",
    r"ten\s+don\s+vi\s+mua",
    r"don\s+vi\s+mua\s+hang",
    r"don\s+vi\s+mua",
    r"ten\s+don\s+vi",
    r"cong\s+ty\s+mua",
    r"khach\s+hang",
    r"buyer",
    r"purchaser",
)
_BUYER_PERSON_LABELS = (
    r"ho\s+ten\s+nguoi\s+mua\s+hang",
    r"ten\s+nguoi\s+mua",
    r"nguoi\s+mua",
)


def _trich_thong_tin_nguoi_mua(lines: list[str]) -> tuple[str | None, str | None]:
    """Trích xuất (tên đơn vị mua, MST bên mua) chỉ trong vùng người mua."""
    vung_mua = _vung_nguoi_mua(lines)
    if not vung_mua:
        return None, None
    ten_mua = _trich_theo_nhan_linh_hoat(vung_mua, _BUYER_UNIT_LABELS)
    if not ten_mua:
        for ln in vung_mua:
            s_ln = ln.strip()
            if not s_ln:
                continue
            norm_ln = _bo_dau(s_ln).lower()
            if re.match(
                r"^(?:cong\s*ty|cty|doanh\s*nghiep|tong\s*cong\s*ty|tap\s*doan|chi\s*nhanh)\b",
                norm_ln,
            ):
                ten_mua = _cat_nhan_ben_canh(s_ln)
                break
    if not ten_mua:
        ten_mua = _trich_theo_nhan_linh_hoat(vung_mua, _BUYER_PERSON_LABELS)
    mst_mua = _tim_mst_trong_dong(vung_mua)
    return ten_mua, mst_mua


def _truong(text, *nhan):
    norm_text, pos_map = _bo_dau_va_map(text)
    for n in nhan:
        pat = _bo_dau(n) + r"(?:\s*\([^)]{1,35}\))?[ \t]*[:：]?[ \t]*([^\n]+)"
        m = re.search(pat, norm_text, re.I)
        if m and m.start(1) < len(pos_map):
            val = _cat_nhan_ben_canh(text[pos_map[m.start(1)]:].split("\n", 1)[0])
            if val and not re.fullmatch(r"[:：\s.-]*", val):
                return val
    return None


_NCC_LABELS = (
    r"don\s+vi\s+ban\s+hang",
    r"ten\s+don\s+vi\s+ban",
    r"don\s+vi\s+ban",
    r"ten\s+nguoi\s+ban",
    r"nguoi\s+ban",
    r"ben\s+ban",
    r"nha\s+cung\s+cap",
    r"don\s+vi\s+cung\s+cap",
    r"don\s+vi\s+phat\s+hanh",
    r"seller",
    r"vendor",
    r"supplier",
    r"don\s+vi(?!\s+(?:tinh|tien\s*te))\b",
)

_TU_LOAI_TRU_MST_LINE = (
    "so tai khoan", "stk", "dien thoai", "tel", "fax", "cccd", "cmnd", "co quan thue", "cqt", "ho chieu", "ngay"
)


def _tim_dong_ten_ncc(vung_ban: list[str]) -> int | None:
    """Tìm chỉ số dòng chứa tên Nhà cung cấp/Đơn vị bán trong vùng người bán."""
    for label in _NCC_LABELS:
        for idx, ln in enumerate(vung_ban):
            norm_ln = _bo_dau(ln)
            m = re.search(
                r"(?:^|[\s|;•-])(" + label + r")(?:\s*\([^)]{1,35}\))?[ \t]*[:：][ \t]*(.+)$",
                norm_ln,
                re.I,
            )
            if not m:
                m = re.match(
                    r"^[ \t]*(" + label + r")(?:\s*\([^)]{1,35}\))?[ \t]+(.+)$",
                    norm_ln,
                    re.I,
                )
            if m and not re.fullmatch(r"[:：\s.-]*", m.group(2).strip()):
                return idx
    for idx, ln in enumerate(vung_ban):
        norm_ln = _bo_dau(ln.strip()).lower()
        if re.match(
            r"^(?:cong\s*ty|cty|doanh\s*nghiep|tong\s*cong\s*ty|tap\s*doan|chi\s*nhanh|ho\s*kinh\s*doanh)\b",
            norm_ln,
        ):
            return idx
    return None


def _tim_mst_trong_dong(scope: list[str]) -> str | None:
    if not scope:
        return None
    pat = r"(?:Ma\s*so\s*thue|MST|Tax\s*code)(?:\s*\([^)]{1,35}\))?[ \t]*[:：]?[ \t]*([0-9][0-9 -]{8,30})"
    norm_scope = _bo_dau("\n".join(scope))
    m = re.search(pat, norm_scope, re.I)
    if m:
        cleaned = re.sub(r"\s+", "", m[1])
        m_mst = re.match(r"(\d{10}(?:-\d{3})?)", cleaned)
        if m_mst:
            return m_mst[1]
    for ln in scope:
        norm_ln = _bo_dau(ln).lower()
        if any(k in norm_ln for k in _TU_LOAI_TRU_MST_LINE):
            continue
        cleaned_ln = re.sub(r"(?<=\d)\s+(?=\d)", "", ln)
        m_fb = re.search(r"(?<!\d)(\d{10}(?:-\d{3})?)(?!\d)", cleaned_ln)
        if m_fb:
            return m_fb[1]
    return None


def _chuan_hoa_mst(text: str):
    lines = text.splitlines()
    vung_ban = _vung_nguoi_ban(lines)
    idx_ncc = _tim_dong_ten_ncc(vung_ban)
    if idx_ncc is not None:
        mst = _tim_mst_trong_dong(vung_ban[idx_ncc : idx_ncc + 5])
        if mst:
            return mst
    return _tim_mst_trong_dong(vung_ban)


def _trich_so_hoa_don(text: str):
    norm_text = _bo_dau(text)
    m_full = re.search(
        r"(?:^|[\n\r]|(?<![A-Za-z]))(?:So\s*hoa\s*don|So\s*HD|So\s*chung\s*tu|Invoice\s*No\.?|Inv\s*No\.?)"
        r"(?:\s*\([^)]{1,35}\))?[ \t]*[:：]?[ \t]*([A-Za-z0-9/_-]{2,30})",
        norm_text,
        re.I,
    )
    if m_full and re.search(r"\d", m_full[1]):
        return m_full[1].strip()

    skip_prefixes = {"mau", "ma", "co", "he", "ty", "ky"}
    for ln in norm_text.splitlines():
        for m in re.finditer(
            r"(?:([A-Za-z]+)\s+)?\bSo\b(?:\s*\([^)]{1,35}\))?(?:[ \t]*[:：][ \t]*([A-Za-z0-9/_-]{2,30})|[ \t]+(\d{4,12})\b)",
            ln,
            re.I,
        ):
            if (m.group(1) or "").lower() in skip_prefixes:
                continue
            val = (m.group(2) or m.group(3) or "").strip()
            if val and re.search(r"\d", val):
                return val
    return None


def _trich_ten_ncc(vung_ban: list[str]) -> str | None:
    ten = _trich_theo_nhan_linh_hoat(vung_ban, _NCC_LABELS)
    if ten:
        return ten
    for ln in vung_ban:
        s_ln = ln.strip()
        if not s_ln:
            continue
        norm_ln = _bo_dau(s_ln).lower()
        if re.match(
            r"^(?:cong\s*ty|cty|doanh\s*nghiep|tong\s*cong\s*ty|tap\s*doan|chi\s*nhanh|ho\s*kinh\s*doanh)\b",
            norm_ln,
        ):
            return _cat_nhan_ben_canh(s_ln)
    return None


def _trich_so_tien_theo_nhan(text: str, *nhan):
    norm_text = _bo_dau(text)
    for n in nhan:
        pat_label = _bo_dau(n)
        for m in re.finditer(
            r"(?:^|[\n\r]|[^\w])(?:" + pat_label + r")(?:\s*\([^)]{1,35}\))?[ \t]*[:：|│]?[ \t|│]*([\d.,]+)([ \t]*%?)",
            norm_text,
            re.I,
        ):
            prefix_ctx = norm_text[max(0, m.start() - 20):m.start()].lower()
            if re.search(r"thue\s+suat\s*$", prefix_ctx) or "%" in m.group(2):
                continue
            num_str = m.group(1).strip(".,")
            if num_str and re.search(r"\d", num_str):
                return so(num_str)
    return None


def _la_so(t):
    return bool(re.fullmatch(r"\d[\d.,]*", t))


def _sku_hop_le(t):
    return bool(re.fullmatch(r"[A-Za-z0-9][\w./-]*", t)) and bool(re.search(r"[\d-]", t))


def _tach_mo_ta_va_dvt(tokens: list[str]) -> str:
    desc = list(tokens)
    dvt_khong_dau = {_bo_dau(u).lower() for u in _DON_VI_TINH}
    if len(desc) >= 2 and (desc[-1].lower() in _DON_VI_TINH or _bo_dau(desc[-1]).lower() in dvt_khong_dau):
        desc.pop()
    return " ".join(desc).strip()


def _bo_phan_tram_cuoi(tokens: list[str]) -> list[str]:
    out = list(tokens)
    if out and re.fullmatch(r"\d{1,2}%", out[-1]):
        out.pop()
    elif len(out) >= 2 and out[-1] == "%" and re.fullmatch(r"\d{1,2}", out[-2]):
        out = out[:-2]
    return out


def _khop_tien_dong(sl: D, dg: D, tt: D, ck: D = D(0)) -> bool:
    return abs(sl * dg - ck - tt) <= max(D(100), abs(tt) * D("0.02"))


def trich_hoa_don(text: str) -> dict:
    dong, canh_bao = [], []
    lines = text.splitlines()
    for ln in lines:
        s_ln = ln.strip()
        if not s_ln:
            continue
        norm_s = _bo_dau(s_ln).lower()
        if re.match(r"^(stt|cong\b|tong\b|thue\b|vat\b|so tien|chiet khau|hinh thuc|don vi|thanh tien|tien thue)", norm_s):
            continue
        if re.match(r"^1\s+2\s+3\s+4", norm_s):
            continue
        t = s_ln.split()
        # Loại 1: dòng bắt đầu bằng mã SKU (không phải số STT 1-99)
        if len(t) >= 4 and not re.fullmatch(r"\d{1,2}", t[0]) and _sku_hop_le(t[0]) and all(_la_so(x) for x in t[-3:]):
            dong.append({"ma_sku_ncc": t[0], "so_luong": so(t[-3]), "don_gia": so(t[-2]), "thanh_tien": so(t[-1])})
            continue

        # Loại 2: bảng hóa đơn có cột STT (1..99) + Tên hàng + [ĐVT] + SL + Đơn giá + [Chiết khấu] + Thành tiền + [% VAT]
        tokens = _bo_phan_tram_cuoi(t)
        if not (len(tokens) >= 5 and re.fullmatch(r"\d{1,2}", tokens[0]) and 1 <= int(tokens[0]) <= 99):
            continue
        stt_num = int(tokens[0])
        if (
            len(tokens) >= 6
            and all(_la_so(x) for x in tokens[-4:])
            and any(re.search(r"[A-Za-z]", _bo_dau(tok)) for tok in tokens[1:-4])
        ):
            sl, dg, ck, tt = so(tokens[-4]), so(tokens[-3]), so(tokens[-2]), so(tokens[-1])
            if _khop_tien_dong(sl, dg, tt, ck):
                dong.append({
                    "ma_sku_ncc": f"SP-{stt_num:02d}",
                    "ten_san_pham": _tach_mo_ta_va_dvt(tokens[1:-4]),
                    "so_luong": sl,
                    "don_gia": dg,
                    "thanh_tien": tt,
                })
                continue
        if all(_la_so(x) for x in tokens[-3:]) and any(re.search(r"[A-Za-z]", _bo_dau(tok)) for tok in tokens[1:-3]):
            dong.append({
                "ma_sku_ncc": f"SP-{stt_num:02d}",
                "ten_san_pham": _tach_mo_ta_va_dvt(tokens[1:-3]),
                "so_luong": so(tokens[-3]),
                "don_gia": so(tokens[-2]),
                "thanh_tien": so(tokens[-1]),
            })

    # Loại 3 (fallback): bảng không có cột STT và không có mã SKU, nằm giữa tiêu đề bảng và dòng tổng
    if not dong:
        in_table = False
        idx_sp = 0
        for ln in lines:
            s_ln = ln.strip()
            if not s_ln:
                continue
            norm_s = _bo_dau(s_ln).lower()
            if not in_table:
                if re.search(r"\b(?:ten hang|ten san pham|hang hoa|dich vu|dien giai|noi dung|mo ta)\b", norm_s):
                    in_table = True
                continue
            if re.match(r"^(?:cong tien|tong cong|tong tien|thue gtgt|tien thue|so tien viet)\b", norm_s):
                break
            if re.match(r"^(?:1\s+2\s+3\s+4|stt\b|don vi tinh\b)", norm_s):
                continue
            tokens = _bo_phan_tram_cuoi(s_ln.split())
            if (
                len(tokens) >= 4
                and all(_la_so(x) for x in tokens[-3:])
                and any(re.search(r"[A-Za-z]", _bo_dau(tok)) for tok in tokens[:-3])
            ):
                sl, dg, tt = so(tokens[-3]), so(tokens[-2]), so(tokens[-1])
                if _khop_tien_dong(sl, dg, tt):
                    idx_sp += 1
                    dong.append({
                        "ma_sku_ncc": f"SP-{idx_sp:02d}",
                        "ten_san_pham": _tach_mo_ta_va_dvt(tokens[:-3]),
                        "so_luong": sl,
                        "don_gia": dg,
                        "thanh_tien": tt,
                    })

    vung_ban = _vung_nguoi_ban(lines)
    ten_nguoi_mua, mst_nguoi_mua = _trich_thong_tin_nguoi_mua(lines)
    coc = _truong(text, r"Trừ cọc", r"Tiền cọc")
    m_cqt = re.search(
        r"(?:Ma\s*cua\s*Co\s*quan\s*thue|Ma\s*CQT|MCCQT)(?:\s*\([^)]{1,35}\))?[ \t]*[:：]?[ \t]*([A-Z0-9-]{8,50})",
        _bo_dau(text),
        re.I,
    )
    ten_ncc = _trich_ten_ncc(vung_ban)
    tong_tt = _trich_so_tien_theo_nhan(
        text,
        r"Tổng cộng tiền thanh toán",
        r"Tổng tiền thanh toán",
        r"Cộng tiền thanh toán",
        r"Tổng thanh toán",
        r"Tổng cộng",
        r"Total amount",
        r"Grand total",
    )
    tong_truoc_vat = _trich_so_tien_theo_nhan(
        text,
        r"Cộng tiền hàng",
        r"Tổng tiền hàng",
        r"Thành tiền trước thuế GTGT",
        r"Thành tiền chưa thuế",
        r"Tiền hàng chưa thuế",
        r"Subtotal",
    )
    vat_val = _trich_so_tien_theo_nhan(text, r"Tiền thuế GTGT", r"Thuế GTGT", r"VAT amount", r"VAT")
    if vat_val is None and tong_tt is not None and tong_truoc_vat is not None and tong_tt >= tong_truoc_vat:
        vat_val = tong_tt - tong_truoc_vat
    if vat_val is None and tong_tt is not None and "hoa don ban hang" in _bo_dau(text).lower():
        vat_val = D(0)

    ngay_lap = ngay(_truong(text, r"Ngày lập", r"Ngày hóa đơn", r"Ngày ký", r"Date", r"Ngày") or "") or ngay(text)

    r = {
        "so_hoa_don": _trich_so_hoa_don(text),
        "mst": _chuan_hoa_mst(text),
        "ten_nguoi_mua": ten_nguoi_mua,
        "mst_nguoi_mua": mst_nguoi_mua,
        "so_po": _truong(text, r"Số PO", r"PO\s*No\.?", r"Số đơn hàng", r"Theo đơn hàng(?:\s+số)?"),
        "ngay_lap": ngay_lap,
        "ma_cqt": m_cqt[1].strip() if m_cqt else None,
        "ten_ncc": ten_ncc,
        "vat": vat_val,
        "tien_coc_tru": so(re.search(r"[\d.,]+", coc)[0]) if coc and re.search(r"\d", coc) else D(0),
        "tong_thanh_toan": tong_tt,
        "dong": dong,
    }
    for k in ("so_hoa_don", "mst", "so_po", "ngay_lap", "vat"):
        if r[k] is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r


def _trich_cong_ty_phieu_kho(lines: list[str]) -> tuple[str | None, str | None]:
    """Trích tên đơn vị lập phiếu kho & MST từ phần đầu phiếu (trước phần bảng hàng & NCC)."""
    header_lines: list[str] = []
    for ln in lines:
        norm = _bo_dau(ln).lower().strip()
        if re.match(r"^(?:so phieu|so po|stt\b|nha cung cap|ben giao|nguoi giao)", norm):
            break
        t = ln.split()
        if len(t) >= 4 and _sku_hop_le(t[0]) and any(_la_so(x) for x in t[1:]):
            break
        header_lines.append(ln)
    if not header_lines:
        return None, None
    ten = _trich_theo_nhan_linh_hoat(
        header_lines,
        (r"ten\s+cong\s+ty", r"don\s+vi\s+nhap", r"ten\s+don\s+vi", r"don\s+vi(?!\s+(?:tinh|tien\s*te))\b"),
    )
    if not ten:
        for ln in header_lines:
            norm_ln, pos_map = _bo_dau_va_map(ln)
            m_colon = re.search(r"(?:^|\s)cong\s+ty[ \t]*[:：][ \t]*(.+)$", norm_ln, re.I)
            if m_colon and m_colon.start(1) < len(pos_map):
                ten = _cat_nhan_ben_canh(ln[pos_map[m_colon.start(1)]:])
                if ten:
                    break
    if not ten:
        for ln in header_lines:
            s_ln = ln.strip()
            norm_ln = _bo_dau(s_ln).lower()
            if re.match(
                r"^(?:cong\s*ty|cty|doanh\s*nghiep|tong\s*cong\s*ty|tap\s*doan|chi\s*nhanh)\b",
                norm_ln,
            ):
                ten = _cat_nhan_ben_canh(s_ln)
                break
    mst = _tim_mst_trong_dong(header_lines)
    return ten, mst


def trich_phieu_kho(text: str) -> dict:
    dong, canh_bao = [], []
    lines = text.splitlines()
    for ln in lines:
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
    ten_cty, mst_cty = _trich_cong_ty_phieu_kho(lines)
    r = {
        "so_phieu": _truong(text, r"Số phiếu"),
        "so_po": _truong(text, r"Số PO", r"Theo đơn hàng"),
        "ngay_nhap": ngay(_truong(text, r"Ngày nhập", r"Ngày") or "") or ngay(text),
        "ten_nguoi_mua": ten_cty,
        "mst_nguoi_mua": mst_cty,
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
        "mst": _chuan_hoa_mst(text),
        "ngay_dat": ngay(_truong(text, r"Ngày đặt", r"Ngày lập", r"Ngày") or "") or ngay(text),
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
