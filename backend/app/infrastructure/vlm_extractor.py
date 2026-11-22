"""Trích xuất chứng từ đa mô hình (Gemini VLM + Qwen VLM bổ sung/đối chiếu) kèm hậu kiểm số học."""
import base64
import copy
import hashlib
import io
import json
import os
import re
import time
import urllib.error
import urllib.request
from decimal import Decimal as D, InvalidOperation

from .pdf_parser import _lam_sach_anh_hoa_don, ngay

DEFAULT_GEMINI_MODELS = ("gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-4-hydrogen")
DEFAULT_QWEN_CLOUD_MODEL = "qwen2.5-vl-72b-instruct"
DEFAULT_QWEN_OLLAMA_MODEL = "qwen2.5vl:7b"
DEFAULT_DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

MODEL_COOLDOWN_SECONDS = 120.0
VLM_CACHE_TTL = 600.0
VLM_CACHE_MAX = 32

_GEMINI_CLIENTS: dict[tuple[str, int, int], object] = {}
_MODEL_COOLDOWN_UNTIL: dict[str, float] = {}
_VLM_CACHE: dict[tuple[str, str, str], tuple[float, dict]] = {}


class ExtractionCancelled(Exception):
    """Ngoại lệ báo hiệu người dùng đã hủy trích xuất chứng từ."""


def _kiem_tra_huy(cancel_event) -> None:
    if cancel_event is not None and cancel_event.is_set():
        raise ExtractionCancelled("Đã hủy quá trình trích xuất")

INVOICE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "loai_chung_tu": {"type": "string", "enum": ["INVOICE", "GRN", "PO"]},
        "so_hoa_don": {"type": ["string", "null"], "description": "Số hóa đơn (không lấy Mẫu số hay Ký hiệu)."},
        "ngay_lap": {"type": ["string", "null"], "description": "Ngày lập hóa đơn theo định dạng YYYY-MM-DD."},
        "ten_ncc": {"type": ["string", "null"], "description": "Tên đầy đủ của ĐƠN VỊ BÁN (nhà cung cấp), tuyệt đối không lấy người mua."},
        "mst": {"type": ["string", "null"], "description": "Mã số thuế của ĐƠN VỊ BÁN / NHÀ CUNG CẤP nằm ngay bên dưới tên Nhà cung cấp ở phần trên hóa đơn (10 số hoặc 10-3 số), TUYỆT ĐỐI KHÔNG lấy MST nằm dưới Người mua/Khách hàng."},
        "ten_nguoi_mua": {"type": ["string", "null"], "description": "Tên ĐƠN VỊ MUA HÀNG / CÔNG TY MUA (ưu tiên dòng 'Tên đơn vị' hoặc 'Đơn vị mua' hơn 'Họ tên người mua hàng')."},
        "mst_nguoi_mua": {"type": ["string", "null"], "description": "Mã số thuế của NGƯỜI MUA/KHÁCH HÀNG nằm ở phần Người mua (tách riêng để không lẫn vào trường mst của đơn vị bán)."},
        "so_po": {"type": ["string", "null"], "description": "Số đơn đặt hàng (PO) tham chiếu nếu có."},
        "ma_cqt": {"type": ["string", "null"], "description": "Mã của Cơ quan thuế (MCCQT) nếu có."},
        "vat": {"type": ["number", "string", "null"], "description": "Tổng tiền thuế GTGT. Nếu là Hóa đơn bán hàng trực tiếp không có VAT thì trả về 0."},
        "tien_coc_tru": {"type": ["number", "string", "null"], "description": "Tiền cọc trừ nếu có, mặc định 0."},
        "tong_thanh_toan": {"type": ["number", "string", "null"], "description": "Tổng cộng tiền thanh toán cuối cùng trên hóa đơn."},
        "dong": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ma_sku_ncc": {"type": ["string", "null"]},
                    "ten_san_pham": {"type": ["string", "null"]},
                    "so_luong": {"type": ["number", "string"]},
                    "don_gia": {"type": ["number", "string"]},
                    "thanh_tien": {"type": ["number", "string", "null"]},
                },
                "required": ["so_luong", "don_gia"],
            },
        },
    },
    "required": ["loai_chung_tu", "so_hoa_don", "ngay_lap", "ten_ncc", "mst", "tong_thanh_toan", "dong"],
}

GRN_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "loai_chung_tu": {"type": "string", "enum": ["INVOICE", "GRN", "PO"]},
        "so_phieu": {"type": ["string", "null"]},
        "so_po": {"type": ["string", "null"]},
        "ngay_nhap": {"type": ["string", "null"], "description": "Ngày nhập kho theo YYYY-MM-DD."},
        "ten_cong_ty": {"type": ["string", "null"], "description": "Tên Công ty / Đơn vị lập phiếu nhập kho (thường nằm ở tiêu đề đầu phiếu)."},
        "mst_cong_ty": {"type": ["string", "null"], "description": "Mã số thuế Công ty / Đơn vị lập phiếu nhập kho nếu có trên phiếu."},
        "dong": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ma_sku": {"type": "string"},
                    "so_nhan": {"type": ["number", "string"]},
                    "so_dat": {"type": ["number", "string"]},
                    "so_tu_choi": {"type": ["number", "string", "null"]},
                    "ly_do": {"type": ["string", "null"]},
                },
                "required": ["ma_sku", "so_nhan", "so_dat"],
            },
        },
    },
    "required": ["loai_chung_tu", "so_phieu", "so_po", "ngay_nhap", "dong"],
}

PO_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "loai_chung_tu": {"type": "string", "enum": ["INVOICE", "GRN", "PO"]},
        "so_po": {"type": ["string", "null"]},
        "mst": {"type": ["string", "null"], "description": "Mã số thuế nhà cung cấp."},
        "ngay_dat": {"type": ["string", "null"], "description": "Ngày đặt hàng theo YYYY-MM-DD."},
        "tien_coc": {"type": ["number", "string", "null"]},
        "dong": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ma_sku": {"type": "string"},
                    "mo_ta": {"type": ["string", "null"]},
                    "so_luong_dat": {"type": ["number", "string"]},
                    "don_gia": {"type": ["number", "string"]},
                },
                "required": ["ma_sku", "so_luong_dat", "don_gia"],
            },
        },
    },
    "required": ["loai_chung_tu", "so_po", "mst", "ngay_dat", "dong"],
}

_SCHEMAS = {
    "INVOICE": INVOICE_JSON_SCHEMA,
    "GRN": GRN_JSON_SCHEMA,
    "PO": PO_JSON_SCHEMA,
}


def _vlm_mode() -> str:
    return (os.environ.get("VLM_PROVIDER", "auto") or "auto").strip().lower()


def gemini_san_sang() -> bool:
    return _vlm_mode() != "off" and bool(os.environ.get("GEMINI_API_KEY", "").strip())


def qwen_san_sang() -> bool:
    return _vlm_mode() != "off" and bool(
        os.environ.get("QWEN_API_KEY", "").strip() or os.environ.get("OLLAMA_BASE_URL", "").strip()
    )


def vlm_san_sang() -> bool:
    mode = _vlm_mode()
    if mode == "off":
        return False
    if mode == "gemini":
        return gemini_san_sang()
    if mode == "qwen":
        return qwen_san_sang()
    return gemini_san_sang() or qwen_san_sang()


def _xac_dinh_mime(data: bytes, filename: str = "") -> str:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    ext = (os.path.splitext(filename or "")[1] or "").lower()
    if ext == ".png":
        return "image/png"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    return "application/pdf"


def _tao_prompt(loai_chung_tu: str, include_schema: bool = False) -> str:
    schema = _SCHEMAS.get(loai_chung_tu, INVOICE_JSON_SCHEMA)
    if loai_chung_tu == "GRN":
        huong_dan = (
            "Bạn là chuyên gia kiểm kho. Hãy đọc chứng từ Phiếu nhập kho (GRN) và trích xuất chính xác toàn bộ thông tin.\n"
            "- Đọc Tên công ty / Đơn vị lập phiếu ở phần tiêu đề vào 'ten_cong_ty' và MST vào 'mst_cong_ty' (nếu có).\n"
            "- Chú ý đọc đúng số lượng thực nhận (so_nhan), đạt (so_dat), từ chối (so_tu_choi).\n"
            "- Ngày chuyển sang YYYY-MM-DD. Giá trị nào không có trên chứng từ trả về null."
        )
    elif loai_chung_tu == "PO":
        huong_dan = (
            "Bạn là chuyên gia mua hàng. Hãy đọc chứng từ Đơn đặt hàng (PO) và trích xuất chính xác toàn bộ thông tin.\n"
            "- Trả về số nguyên VND chính xác cho đơn giá/tiền cọc (không làm tròn).\n"
            "- Ngày chuyển sang YYYY-MM-DD. Trường nào không có trả về null."
        )
    else:
        huong_dan = (
            "Bạn là kế toán kiểm tra hóa đơn Việt Nam. Hãy đọc ảnh/PDF hóa đơn và trích xuất chính xác theo JSON Schema:\n"
            "- Hóa đơn Việt Nam thường có 2 mã số thuế: BẮT BUỘC đặt MST nằm ngay bên dưới tên ĐƠN VỊ BÁN / NHÀ CUNG CẤP vào trường 'mst', và đặt MST nằm dưới phần Người mua / Khách hàng vào 'mst_nguoi_mua'. TUYỆT ĐỐI KHÔNG lấy MST người mua gán vào 'mst'.\n"
            "- Đọc ĐÚNG tên ĐƠN VỊ BÁN vào 'ten_ncc', và tên ĐƠN VỊ MUA HÀNG / CÔNG TY MUA vào 'ten_nguoi_mua' (ưu tiên dòng 'Tên đơn vị' ở phần người mua hơn 'Họ tên người mua hàng').\n"
            "- Không lấy nhầm 'Mẫu số' hay 'Ký hiệu' làm 'so_hoa_don'. Nếu MST có khoảng trắng ở giữa các số thì ghép liền lại.\n"
            "- Các số tiền tại Việt Nam dùng dấu chấm phân tách hàng nghìn (ví dụ '3.750.000' là 3750000); trả về số nguyên chuẩn.\n"
            "- Nếu là 'Hóa đơn bán hàng' trực tiếp không có thuế GTGT riêng thì đặt vat = 0.\n"
            "- Đọc đầy đủ từng dòng hàng hóa/dịch vụ trong bảng. Trường nào không có trên chứng từ trả về null."
        )
    if include_schema:
        huong_dan += "\n\nChỉ trả về đúng 1 object JSON hợp lệ theo schema sau (không giải thích thêm):\n" + json.dumps(
            schema, ensure_ascii=False
        )
    return huong_dan


def _parse_json_tu_van_ban(text: str) -> dict:
    s = (text or "").strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.I)
        s = re.sub(r"\s*```$", "", s)
    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", s, re.S)
        if m:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict):
                return obj
        raise
    raise ValueError("Phản hồi VLM không phải JSON object.")


def _pdf_thanh_anh_jpeg_base64(data: bytes, max_pages: int = 3) -> list[str]:
    import pdfplumber

    encoded: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[:max_pages]:
            pil_img = page.to_image(resolution=180).original.convert("RGB")
            cleaned = _lam_sach_anh_hoa_don(pil_img)
            buf = io.BytesIO()
            cleaned.save(buf, format="JPEG", quality=88)
            encoded.append(base64.b64encode(buf.getvalue()).decode("ascii"))
    return encoded


def _get_gemini_client(genai_mod, api_key: str):
    timeout_ms = int(os.environ.get("VLM_TIMEOUT_MS", "20000") or "20000")
    cache_key = (api_key, timeout_ms, id(genai_mod.Client))
    client = _GEMINI_CLIENTS.get(cache_key)
    if client is not None:
        return client

    types_mod = getattr(genai_mod, "types", None)
    try:
        if types_mod and hasattr(types_mod, "HttpOptions") and hasattr(types_mod, "HttpRetryOptions"):
            opts = types_mod.HttpOptions(
                timeout=timeout_ms,
                retry_options=types_mod.HttpRetryOptions(attempts=1),
            )
        else:
            opts = {"timeout": timeout_ms, "retry_options": {"attempts": 1}}
        client = genai_mod.Client(api_key=api_key, http_options=opts)
    except TypeError:
        client = genai_mod.Client(api_key=api_key)

    _GEMINI_CLIENTS[cache_key] = client
    return client


def _toi_uu_anh_cho_vlm(data: bytes, mime_type: str) -> tuple[bytes, str]:
    """Thu nhỏ & nén ảnh lớn > 300KB trước khi upload lên VLM để giảm độ trễ mạng."""
    if mime_type not in ("image/png", "image/jpeg") or len(data) <= 300_000:
        return data, mime_type
    try:
        from PIL import Image

        with Image.open(io.BytesIO(data)) as img:
            rgb = img.convert("RGB")
            resample = getattr(Image, "Resampling", Image).LANCZOS
            w, h = rgb.size
            max_dim = max(w, h)
            if max_dim > 1600:
                scale = 1600 / max_dim
                rgb = rgb.resize((max(1, round(w * scale)), max(1, round(h * scale))), resample)
            buf = io.BytesIO()
            rgb.save(buf, format="JPEG", quality=85)
            out_bytes = buf.getvalue()
            if len(out_bytes) < len(data):
                return out_bytes, "image/jpeg"
    except Exception:
        pass
    return data, mime_type


def _sap_xep_model_theo_cooldown(models: list[str]) -> list[str]:
    now = time.monotonic()
    san_sang = [m for m in models if _MODEL_COOLDOWN_UNTIL.get(m, 0.0) <= now]
    return san_sang if san_sang else list(models)


def _goi_gemini_vlm(data: bytes, mime_type: str, loai_chung_tu: str, cancel_event=None) -> tuple[dict, str]:
    _kiem_tra_huy(cancel_event)
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Thiếu GEMINI_API_KEY")

    from google import genai

    client = _get_gemini_client(genai, api_key)
    models_raw = os.environ.get("GEMINI_VLM_MODELS", "")
    models = _sap_xep_model_theo_cooldown(
        [m.strip() for m in models_raw.split(",") if m.strip()] or list(DEFAULT_GEMINI_MODELS)
    )
    schema = _SCHEMAS.get(loai_chung_tu, INVOICE_JSON_SCHEMA)
    prompt = _tao_prompt(loai_chung_tu, include_schema=False)
    opt_data, opt_mime = _toi_uu_anh_cho_vlm(data, mime_type)
    b64 = base64.b64encode(opt_data).decode("ascii")
    media_part = (
        {"type": "document", "data": b64, "mime_type": "application/pdf"}
        if opt_mime == "application/pdf"
        else {"type": "image", "data": b64, "mime_type": opt_mime}
    )

    errs: list[str] = []
    for model in models:
        _kiem_tra_huy(cancel_event)
        try:
            interaction = client.interactions.create(
                model=model,
                input=[media_part, {"type": "text", "text": prompt}],
                store=False,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": schema,
                },
            )
            _kiem_tra_huy(cancel_event)
            parsed = _parse_json_tu_van_ban(getattr(interaction, "output_text", "") or "")
            _MODEL_COOLDOWN_UNTIL.pop(model, None)
            return parsed, f"Gemini VLM ({model})"
        except ExtractionCancelled:
            raise
        except Exception as e:
            msg_low = str(e).lower()
            if any(k in msg_low for k in ("503", "429", "high demand", "service_unavailable", "quota", "resource_exhausted")):
                _MODEL_COOLDOWN_UNTIL[model] = time.monotonic() + MODEL_COOLDOWN_SECONDS
            errs.append(f"{model}: {e}")
    raise RuntimeError("; ".join(errs))


def _goi_qwen_vlm(data: bytes, mime_type: str, loai_chung_tu: str, cancel_event=None) -> tuple[dict, str]:
    _kiem_tra_huy(cancel_event)
    qwen_key = os.environ.get("QWEN_API_KEY", "").strip()
    qwen_base = os.environ.get("QWEN_API_BASE", "").strip()
    ollama_base = os.environ.get("OLLAMA_BASE_URL", "").strip()
    env_model = os.environ.get("QWEN_VLM_MODEL", "").strip()

    if qwen_key:
        base_url = (qwen_base or DEFAULT_DASHSCOPE_URL).rstrip("/")
        endpoint = base_url if base_url.endswith("/chat/completions") else f"{base_url}/chat/completions"
        model = env_model or DEFAULT_QWEN_CLOUD_MODEL
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {qwen_key}"}
    elif ollama_base:
        base_url = ollama_base.rstrip("/")
        if base_url.endswith("/chat/completions"):
            endpoint = base_url
        elif base_url.endswith("/v1"):
            endpoint = f"{base_url}/chat/completions"
        else:
            endpoint = f"{base_url}/v1/chat/completions"
        model = env_model or DEFAULT_QWEN_OLLAMA_MODEL
        headers = {"Content-Type": "application/json"}
    else:
        raise RuntimeError("Chưa cấu hình QWEN_API_KEY hoặc OLLAMA_BASE_URL")

    if mime_type == "application/pdf":
        b64_list = _pdf_thanh_anh_jpeg_base64(data, max_pages=3)
        image_urls = [f"data:image/jpeg;base64,{b64}" for b64 in b64_list]
    else:
        opt_data, opt_mime = _toi_uu_anh_cho_vlm(data, mime_type)
        b64 = base64.b64encode(opt_data).decode("ascii")
        image_urls = [f"data:{opt_mime};base64,{b64}"]

    _kiem_tra_huy(cancel_event)
    prompt = _tao_prompt(loai_chung_tu, include_schema=True)
    content_parts = [{"type": "image_url", "image_url": {"url": u}} for u in image_urls]
    content_parts.append({"type": "text", "text": prompt})

    def _post(with_json_mode: bool) -> dict:
        _kiem_tra_huy(cancel_event)
        body: dict = {
            "model": model,
            "temperature": 0,
            "messages": [{"role": "user", "content": content_parts}],
        }
        if with_json_mode:
            body["response_format"] = {"type": "json_object"}
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(body).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        resp_json = _post(with_json_mode=True)
    except urllib.error.HTTPError as e:
        if e.code == 400:
            resp_json = _post(with_json_mode=False)
        else:
            raise

    _kiem_tra_huy(cancel_event)
    msg_content = resp_json["choices"][0]["message"]["content"]
    if isinstance(msg_content, list):
        msg_content = "\n".join(str(p.get("text", "")) for p in msg_content if isinstance(p, dict))
    parsed = _parse_json_tu_van_ban(str(msg_content))
    return parsed, f"Qwen VLM ({model})"


def _chuoi_sach(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "n/a"):
        return None
    return s


def _chuan_hoa_mst_tu_chuoi(val) -> str | None:
    s = _chuoi_sach(val)
    if not s:
        return None
    cleaned = re.sub(r"\s+", "", s)
    m = re.search(r"(\d{10}(?:-\d{3})?)", cleaned)
    return m[1] if m else None


def _to_decimal(val) -> D | None:
    if val is None or isinstance(val, bool):
        return None
    if isinstance(val, D):
        return val
    if isinstance(val, int):
        return D(val)
    if isinstance(val, float):
        try:
            return D(str(val))
        except InvalidOperation:
            return None
    s = _chuoi_sach(val)
    if not s:
        return None
    s = re.sub(r"(?i)(vnđ|vnd|[₫đ\s])", "", s)
    if not re.search(r"\d", s):
        return None
    if "." in s and "," in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "." in s:
        if re.fullmatch(r"-?\d{1,3}(?:\.\d{3})+", s):
            s = s.replace(".", "")
    elif "," in s:
        if re.fullmatch(r"-?\d{1,3}(?:,\d{3})+", s):
            s = s.replace(",", "")
        else:
            s = s.replace(",", ".")
    try:
        return D(s)
    except InvalidOperation:
        return None


def _cap_nhat_canh_bao_hoa_don(r: dict, giu_canh_bao_khac: list[str] | None = None) -> dict:
    canh_bao: list[str] = []
    for k in ("so_hoa_don", "mst", "so_po", "ngay_lap", "vat"):
        if r.get(k) is None:
            canh_bao.append(f"Không tìm thấy: {k}")
    dong = r.get("dong") or []
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    elif r.get("tong_thanh_toan") is not None:
        tong_dong = sum((d.get("thanh_tien") or D(0)) for d in dong)
        tong_tinh = tong_dong + (r.get("vat") or D(0)) - (r.get("tien_coc_tru") or D(0))
        tong_tt = r["tong_thanh_toan"]
        if abs(tong_tinh - tong_tt) > max(D(100), abs(tong_tt) * D("0.01")):
            canh_bao.append("Tổng tiền thanh toán trích xuất lệch so với tổng các dòng hàng + VAT, vui lòng kiểm tra lại.")
    for msg in giu_canh_bao_khac or []:
        if msg not in canh_bao and not msg.startswith("Không tìm thấy:") and msg != "Không đọc được dòng hàng" and "Tổng tiền thanh toán trích xuất lệch" not in msg:
            canh_bao.append(msg)
    r["canh_bao"] = canh_bao
    return r


def chuan_hoa_ket_qua_hoa_don_vlm(raw: dict) -> dict:
    dong = []
    for idx, item in enumerate(raw.get("dong") or [], start=1):
        if not isinstance(item, dict):
            continue
        sl = _to_decimal(item.get("so_luong"))
        dg = _to_decimal(item.get("don_gia"))
        tt = _to_decimal(item.get("thanh_tien"))
        if sl is None and tt is not None and dg and dg > 0:
            sl = tt / dg
        if sl is None or dg is None:
            continue
        if tt is None:
            tt = sl * dg
        row = {
            "ma_sku_ncc": _chuoi_sach(item.get("ma_sku_ncc")) or f"SP-{idx:02d}",
            "so_luong": sl,
            "don_gia": dg,
            "thanh_tien": tt,
        }
        ten_sp = _chuoi_sach(item.get("ten_san_pham"))
        if ten_sp:
            row["ten_san_pham"] = ten_sp
        dong.append(row)

    ngay_str = _chuoi_sach(raw.get("ngay_lap"))
    coc = _to_decimal(raw.get("tien_coc_tru"))
    mst_ban = _chuan_hoa_mst_tu_chuoi(raw.get("mst"))
    mst_mua = _chuan_hoa_mst_tu_chuoi(raw.get("mst_nguoi_mua"))
    extra_warnings: list[str] = []
    if mst_ban and mst_mua and mst_ban == mst_mua:
        extra_warnings.append("Mã số thuế đơn vị bán trùng với mã số thuế người mua, vui lòng kiểm tra lại.")
    r = {
        "so_hoa_don": _chuoi_sach(raw.get("so_hoa_don")),
        "mst": mst_ban,
        "ten_nguoi_mua": _chuoi_sach(raw.get("ten_nguoi_mua")),
        "mst_nguoi_mua": mst_mua,
        "so_po": _chuoi_sach(raw.get("so_po")),
        "ngay_lap": ngay(ngay_str or "") or (ngay_str if ngay_str and re.fullmatch(r"\d{4}-\d{2}-\d{2}", ngay_str) else None),
        "ma_cqt": _chuoi_sach(raw.get("ma_cqt")),
        "ten_ncc": _chuoi_sach(raw.get("ten_ncc")),
        "vat": _to_decimal(raw.get("vat")),
        "tien_coc_tru": coc if coc is not None else D(0),
        "tong_thanh_toan": _to_decimal(raw.get("tong_thanh_toan")),
        "dong": dong,
    }
    return _cap_nhat_canh_bao_hoa_don(r, extra_warnings)


def chuan_hoa_ket_qua_phieu_kho_vlm(raw: dict) -> dict:
    dong = []
    for item in raw.get("dong") or []:
        if not isinstance(item, dict):
            continue
        sku = _chuoi_sach(item.get("ma_sku"))
        nhan = _to_decimal(item.get("so_nhan"))
        dat = _to_decimal(item.get("so_dat"))
        tc = _to_decimal(item.get("so_tu_choi"))
        if not sku or nhan is None or dat is None:
            continue
        dong.append({
            "ma_sku": sku,
            "so_nhan": nhan,
            "so_dat": dat,
            "so_tu_choi": tc if tc is not None else D(0),
            "ly_do": _chuoi_sach(item.get("ly_do")),
        })

    ngay_str = _chuoi_sach(raw.get("ngay_nhap"))
    r = {
        "so_phieu": _chuoi_sach(raw.get("so_phieu")),
        "so_po": _chuoi_sach(raw.get("so_po")),
        "ngay_nhap": ngay(ngay_str or "") or (ngay_str if ngay_str and re.fullmatch(r"\d{4}-\d{2}-\d{2}", ngay_str) else None),
        "ten_nguoi_mua": _chuoi_sach(raw.get("ten_cong_ty") or raw.get("ten_nguoi_mua")),
        "mst_nguoi_mua": _chuan_hoa_mst_tu_chuoi(raw.get("mst_cong_ty") or raw.get("mst_nguoi_mua")),
        "dong": dong,
    }
    canh_bao = [f"Không tìm thấy: {k}" for k in ("so_phieu", "so_po", "ngay_nhap") if r[k] is None]
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r


def chuan_hoa_ket_qua_po_vlm(raw: dict) -> dict:
    dong = []
    for item in raw.get("dong") or []:
        if not isinstance(item, dict):
            continue
        sku = _chuoi_sach(item.get("ma_sku"))
        sl = _to_decimal(item.get("so_luong_dat"))
        dg = _to_decimal(item.get("don_gia"))
        if not sku or sl is None or dg is None:
            continue
        dong.append({
            "ma_sku": sku,
            "mo_ta": _chuoi_sach(item.get("mo_ta")),
            "so_luong_dat": sl,
            "don_gia": dg,
        })

    ngay_str = _chuoi_sach(raw.get("ngay_dat"))
    coc = _to_decimal(raw.get("tien_coc"))
    r = {
        "so_po": _chuoi_sach(raw.get("so_po")),
        "mst": _chuan_hoa_mst_tu_chuoi(raw.get("mst")),
        "ngay_dat": ngay(ngay_str or "") or (ngay_str if ngay_str and re.fullmatch(r"\d{4}-\d{2}-\d{2}", ngay_str) else None),
        "tien_coc": coc if coc is not None else D(0),
        "dong": dong,
    }
    canh_bao = [f"Không tìm thấy: {k}" for k in ("so_po", "mst", "ngay_dat") if r[k] is None]
    if not dong:
        canh_bao.append("Không đọc được dòng hàng")
    r["canh_bao"] = canh_bao
    return r


def _gop_ket_qua_vlm(primary: dict, secondary: dict, loai_chung_tu: str = "INVOICE") -> dict:
    merged = dict(primary)
    extra_warnings = list(primary.get("canh_bao") or [])

    if loai_chung_tu == "GRN":
        for k in ("so_phieu", "so_po", "ngay_nhap", "ten_nguoi_mua", "mst_nguoi_mua"):
            if merged.get(k) is None and secondary.get(k) is not None:
                merged[k] = secondary[k]
        if not merged.get("dong") and secondary.get("dong"):
            merged["dong"] = list(secondary["dong"])
        cb = [f"Không tìm thấy: {k}" for k in ("so_phieu", "so_po", "ngay_nhap") if merged.get(k) is None]
        if not merged.get("dong"):
            cb.append("Không đọc được dòng hàng")
        merged["canh_bao"] = cb
        return merged

    if loai_chung_tu == "PO":
        for k in ("so_po", "mst", "ngay_dat"):
            if merged.get(k) is None and secondary.get(k) is not None:
                merged[k] = secondary[k]
        if (merged.get("tien_coc") or D(0)) == D(0) and secondary.get("tien_coc"):
            merged["tien_coc"] = secondary["tien_coc"]
        if not merged.get("dong") and secondary.get("dong"):
            merged["dong"] = list(secondary["dong"])
        cb = [f"Không tìm thấy: {k}" for k in ("so_po", "mst", "ngay_dat") if merged.get(k) is None]
        if not merged.get("dong"):
            cb.append("Không đọc được dòng hàng")
        merged["canh_bao"] = cb
        return merged

    for k in ("so_hoa_don", "mst", "ten_nguoi_mua", "mst_nguoi_mua", "so_po", "ngay_lap", "ten_ncc", "ma_cqt", "vat", "tong_thanh_toan"):
        if merged.get(k) is None and secondary.get(k) is not None:
            merged[k] = secondary[k]
    if (merged.get("tien_coc_tru") or D(0)) == D(0) and secondary.get("tien_coc_tru"):
        merged["tien_coc_tru"] = secondary["tien_coc_tru"]
    if not merged.get("dong") and secondary.get("dong"):
        merged["dong"] = list(secondary["dong"])

    if (
        primary.get("tong_thanh_toan") is not None
        and secondary.get("tong_thanh_toan") is not None
        and abs(primary["tong_thanh_toan"] - secondary["tong_thanh_toan"]) > D(100)
    ):
        extra_warnings.append("Kết quả đối chiếu giữa 2 mô hình có sự khác biệt ở Tổng tiền thanh toán, vui lòng kiểm tra kỹ.")
    if primary.get("mst") and secondary.get("mst") and primary["mst"] != secondary["mst"]:
        extra_warnings.append("Kết quả đối chiếu giữa 2 mô hình có sự khác biệt ở Mã số thuế, vui lòng kiểm tra kỹ.")

    return _cap_nhat_canh_bao_hoa_don(merged, extra_warnings)


def _chuan_hoa_theo_loai(raw: dict, loai_chung_tu: str) -> dict:
    if loai_chung_tu == "GRN":
        return chuan_hoa_ket_qua_phieu_kho_vlm(raw)
    if loai_chung_tu == "PO":
        return chuan_hoa_ket_qua_po_vlm(raw)
    return chuan_hoa_ket_qua_hoa_don_vlm(raw)


def _co_thieu_truong_quan_trong(r: dict, loai_chung_tu: str) -> bool:
    if not r.get("dong"):
        return True
    if loai_chung_tu == "GRN":
        return r.get("so_phieu") is None
    if loai_chung_tu == "PO":
        return r.get("so_po") is None or r.get("mst") is None
    if any(r.get(k) is None for k in ("so_hoa_don", "mst", "tong_thanh_toan")):
        return True
    return any("Tổng tiền thanh toán trích xuất lệch" in w for w in (r.get("canh_bao") or []))


def _danh_sach_provider() -> list[str]:
    mode = _vlm_mode()
    if mode == "off":
        return []
    if mode == "gemini":
        return ["gemini"] if gemini_san_sang() else []
    if mode == "qwen":
        return ["qwen"] if qwen_san_sang() else []
    order = ("qwen", "gemini") if mode == "qwen_then_gemini" else ("gemini", "qwen")
    return [p for p in order if (gemini_san_sang() if p == "gemini" else qwen_san_sang())]


def _json_tom_tat(r: dict) -> str:
    return json.dumps(
        r,
        ensure_ascii=False,
        indent=2,
        default=lambda v: str(v) if isinstance(v, D) else v,
    )


def trich_xuat_bang_vlm(
    data: bytes,
    filename: str = "",
    loai_chung_tu: str = "INVOICE",
    loi_out: list[str] | None = None,
    cancel_event=None,
) -> dict | None:
    """Trích xuất chứng từ bằng Multi-VLM (Gemini VLM / Qwen VLM) và tự động bổ sung/đối chiếu."""
    _kiem_tra_huy(cancel_event)
    providers = _danh_sach_provider()
    if not providers:
        return None

    ensemble = os.environ.get("VLM_ENSEMBLE", "").strip().lower() in ("1", "true", "yes")
    cache_key = (hashlib.sha256(data).hexdigest(), loai_chung_tu, f"v3:{','.join(providers)}:{int(ensemble)}")
    now = time.monotonic()
    cached = _VLM_CACHE.get(cache_key)
    if cached is not None:
        cached_at, cached_res = cached
        if now - cached_at <= VLM_CACHE_TTL:
            return copy.deepcopy(cached_res)
        _VLM_CACHE.pop(cache_key, None)

    mime_type = _xac_dinh_mime(data, filename)
    loi_vlm: list[str] = []

    def _run_one(name: str) -> tuple[dict, str, str] | None:
        _kiem_tra_huy(cancel_event)
        try:
            raw, engine_label = (
                _goi_gemini_vlm(data, mime_type, loai_chung_tu, cancel_event=cancel_event)
                if name == "gemini"
                else _goi_qwen_vlm(data, mime_type, loai_chung_tu, cancel_event=cancel_event)
            )
            norm = _chuan_hoa_theo_loai(raw, loai_chung_tu)
            loai_nhan_dien = str(raw.get("loai_chung_tu") or loai_chung_tu).upper()
            if loai_nhan_dien not in ("INVOICE", "GRN", "PO"):
                loai_nhan_dien = loai_chung_tu
            return norm, loai_nhan_dien, engine_label
        except ExtractionCancelled:
            raise
        except Exception as e:
            loi_vlm.append(f"{name}: {str(e)[:180]}")
            return None

    first = _run_one(providers[0])
    final_norm = first[0] if first else None
    final_loai = first[1] if first else loai_chung_tu
    final_engine = first[2] if first else ""

    if len(providers) > 1 and (
        first is None or ensemble or _co_thieu_truong_quan_trong(first[0], loai_chung_tu)
    ):
        _kiem_tra_huy(cancel_event)
        second = _run_one(providers[1])
        if second is not None:
            if final_norm is None:
                final_norm, final_loai, final_engine = second
            else:
                final_norm = _gop_ket_qua_vlm(final_norm, second[0], loai_chung_tu)
                final_engine = f"{final_engine} + {second[2]}"

    if loi_out is not None and loi_vlm:
        loi_out.extend(loi_vlm)

    if final_norm is None:
        return None

    result = {
        "ket_qua": final_norm,
        "loai_chung_tu": final_loai,
        "phuong_phap": final_engine,
        "van_ban_tom_tat": _json_tom_tat(final_norm),
        "loi_vlm": loi_vlm,
    }
    if len(_VLM_CACHE) >= VLM_CACHE_MAX:
        oldest_key = min(_VLM_CACHE, key=lambda k: _VLM_CACHE[k][0])
        _VLM_CACHE.pop(oldest_key, None)
    _VLM_CACHE[cache_key] = (time.monotonic(), copy.deepcopy(result))
    return result
