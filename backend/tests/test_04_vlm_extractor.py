import io
import json
import os
import sys
import types
from decimal import Decimal as D

from app.infrastructure import pdf_parser, vlm_extractor


def test_chuan_hoa_va_hau_kiem_hoa_don_vlm():
    raw_ok = {
        "loai_chung_tu": "INVOICE",
        "so_hoa_don": "00002118",
        "ngay_lap": "28/08/2026",
        "ten_ncc": "CÔNG TY TNHH ĐÀO TẠO THIÊN ƯNG",
        "mst": "0 1 1 1 2 1 4 0 2 1",
        "mst_nguoi_mua": "0106908158",
        "so_po": "PO-2026-001",
        "ma_cqt": "000B0B39978EE64C7F8349D4A83245702E",
        "vat": "0",
        "tien_coc_tru": 0,
        "tong_thanh_toan": "3.750.000",
        "dong": [
            {"ten_san_pham": "Khóa học TNDN", "so_luong": 1, "don_gia": "500.000", "thanh_tien": "500.000"},
            {"ten_san_pham": "Khóa học tổng hợp", "so_luong": 1, "don_gia": 3200000, "thanh_tien": 3200000},
            {"ten_san_pham": "Khóa học HTKK", "so_luong": 1, "don_gia": "50.000", "thanh_tien": "50.000"},
        ],
    }
    r = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm(raw_ok)
    assert r["mst"] == "0111214021"
    assert r["ngay_lap"] == "2026-08-28"
    assert r["vat"] == D(0)
    assert r["tong_thanh_toan"] == D(3750000)
    assert r["dong"][0]["ma_sku_ncc"] == "SP-01"
    assert r["dong"][2]["thanh_tien"] == D(50000)
    assert r["canh_bao"] == []

    raw_lech = dict(raw_ok, tong_thanh_toan="4.000.000")
    r_lech = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm(raw_lech)
    assert any("lệch so với tổng các dòng hàng" in w for w in r_lech["canh_bao"])

    raw_trung_mst = dict(raw_ok, mst_nguoi_mua="0111214021")
    r_trung_mst = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm(raw_trung_mst)
    assert any("trùng với mã số thuế người mua" in w for w in r_trung_mst["canh_bao"])


def test_gop_bo_sung_gemini_va_qwen():
    gemini_thieu = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm({
        "so_hoa_don": "00002118",
        "ngay_lap": "2026-08-28",
        "ten_ncc": "CÔNG TY A",
        "mst": None,
        "so_po": "PO-1",
        "vat": 0,
        "tong_thanh_toan": 3750000,
        "dong": [],
    })
    qwen_bo_sung = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm({
        "so_hoa_don": "00002118",
        "ngay_lap": "2026-08-28",
        "ten_ncc": "CÔNG TY A",
        "mst": "0111214021",
        "so_po": "PO-1",
        "vat": 0,
        "tong_thanh_toan": 3750000,
        "dong": [{"ten_san_pham": "Dịch vụ A", "so_luong": 1, "don_gia": 3750000, "thanh_tien": 3750000}],
    })
    merged = vlm_extractor._gop_ket_qua_vlm(gemini_thieu, qwen_bo_sung, "INVOICE")
    assert merged["mst"] == "0111214021"
    assert len(merged["dong"]) == 1
    assert merged["canh_bao"] == []

    qwen_lech_tong = dict(qwen_bo_sung, tong_thanh_toan=D(3900000))
    merged_diff = vlm_extractor._gop_ket_qua_vlm(
        vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm({
            "so_hoa_don": "00002118",
            "ngay_lap": "2026-08-28",
            "ten_ncc": "CÔNG TY A",
            "mst": "0111214021",
            "so_po": "PO-1",
            "vat": 0,
            "tong_thanh_toan": 3750000,
            "dong": [{"ten_san_pham": "Dịch vụ A", "so_luong": 1, "don_gia": 3750000, "thanh_tien": 3750000}],
        }),
        qwen_lech_tong,
        "INVOICE",
    )
    assert any("khác biệt ở Tổng tiền thanh toán" in w for w in merged_diff["canh_bao"])


def test_goi_gemini_vlm_cascade_va_interactions_api():
    calls = []

    class FakeInteractions:
        def create(self, **kwargs):
            calls.append(kwargs)
            if kwargs["model"] == "gemini-3.5-flash-lite":
                raise RuntimeError("429 quota exceeded")
            return types.SimpleNamespace(
                output_text=json.dumps({
                    "loai_chung_tu": "INVOICE",
                    "so_hoa_don": "00002118",
                    "mst": "0111214021",
                    "tong_thanh_toan": 3750000,
                    "dong": [{"ten_san_pham": "Khóa học", "so_luong": 1, "don_gia": 3750000, "thanh_tien": 3750000}],
                })
            )

    class FakeClient:
        def __init__(self, api_key=None):
            self.api_key = api_key
            self.interactions = FakeInteractions()

    old_google = sys.modules.get("google")
    old_genai = sys.modules.get("google.genai")
    old_key = os.environ.get("GEMINI_API_KEY")
    old_models = os.environ.get("GEMINI_VLM_MODELS")

    fake_genai = types.ModuleType("google.genai")
    fake_genai.Client = FakeClient
    fake_google = types.ModuleType("google")
    fake_google.genai = fake_genai
    sys.modules["google"] = fake_google
    sys.modules["google.genai"] = fake_genai
    os.environ["GEMINI_API_KEY"] = "test-gemini-key"
    os.environ["GEMINI_VLM_MODELS"] = "gemini-3.5-flash-lite,gemini-3.1-flash-lite"

    try:
        parsed, engine_name = vlm_extractor._goi_gemini_vlm(b"%PDF-1.4\nfake", "application/pdf", "INVOICE")
        assert len(calls) == 2
        assert calls[0]["store"] is False
        assert calls[0]["input"][0]["type"] == "document"
        assert calls[0]["input"][0]["mime_type"] == "application/pdf"
        assert calls[0]["response_format"]["mime_type"] == "application/json"
        assert calls[1]["model"] == "gemini-3.1-flash-lite"
        assert engine_name == "Gemini VLM (gemini-3.1-flash-lite)"
        assert parsed["so_hoa_don"] == "00002118"
    finally:
        if old_google is None:
            sys.modules.pop("google", None)
        else:
            sys.modules["google"] = old_google
        if old_genai is None:
            sys.modules.pop("google.genai", None)
        else:
            sys.modules["google.genai"] = old_genai
        if old_key is None:
            os.environ.pop("GEMINI_API_KEY", None)
        else:
            os.environ["GEMINI_API_KEY"] = old_key
        if old_models is None:
            os.environ.pop("GEMINI_VLM_MODELS", None)
        else:
            os.environ["GEMINI_VLM_MODELS"] = old_models


def test_goi_qwen_vlm_openai_compatible():
    captured = {}

    class FakeResp:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            payload = {
                "choices": [
                    {
                        "message": {
                            "content": '```json\n{"loai_chung_tu": "INVOICE", "so_hoa_don": "00002118", "mst": "0111214021", "tong_thanh_toan": 3750000, "dong": [{"ten_san_pham": "SP", "so_luong": 1, "don_gia": 3750000, "thanh_tien": 3750000}]}\n```'
                        }
                    }
                ]
            }
            return json.dumps(payload).encode("utf-8")

    old_urlopen = vlm_extractor.urllib.request.urlopen
    old_ollama = os.environ.get("OLLAMA_BASE_URL")
    old_qkey = os.environ.get("QWEN_API_KEY")
    old_qmodel = os.environ.get("QWEN_VLM_MODEL")

    def fake_urlopen(req, timeout=60):
        captured["url"] = req.full_url
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return FakeResp()

    vlm_extractor.urllib.request.urlopen = fake_urlopen
    os.environ.pop("QWEN_API_KEY", None)
    os.environ["OLLAMA_BASE_URL"] = "http://host.docker.internal:11434"
    os.environ["QWEN_VLM_MODEL"] = "qwen2.5vl:7b"

    try:
        parsed, engine_name = vlm_extractor._goi_qwen_vlm(b"\x89PNG\r\n\x1a\nfake", "image/png", "INVOICE")
        assert captured["url"] == "http://host.docker.internal:11434/v1/chat/completions"
        assert captured["body"]["model"] == "qwen2.5vl:7b"
        assert engine_name == "Qwen VLM (qwen2.5vl:7b)"
        assert parsed["so_hoa_don"] == "00002118"
        assert parsed["mst"] == "0111214021"
    finally:
        vlm_extractor.urllib.request.urlopen = old_urlopen
        if old_ollama is None:
            os.environ.pop("OLLAMA_BASE_URL", None)
        else:
            os.environ["OLLAMA_BASE_URL"] = old_ollama
        if old_qkey is None:
            os.environ.pop("QWEN_API_KEY", None)
        else:
            os.environ["QWEN_API_KEY"] = old_qkey
        if old_qmodel is None:
            os.environ.pop("QWEN_VLM_MODEL", None)
        else:
            os.environ["QWEN_VLM_MODEL"] = old_qmodel


def test_doc_tai_lieu_fast_check_khong_chay_ocr():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (60, 60), (255, 255, 255)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    old_ocr = pdf_parser.ocr_hinh_anh

    def _forbid_ocr(*args, **kwargs):
        raise AssertionError("Không được chạy OCR khi cho_phep_ocr=False")

    pdf_parser.ocr_hinh_anh = _forbid_ocr
    try:
        res = pdf_parser.doc_tai_lieu(png_bytes, "test.png", cho_phep_ocr=False)
        assert res["loai_file"] == "IMAGE"
        assert res["phuong_phap"] == "VLM"
        assert res["van_ban"] == ""
    finally:
        pdf_parser.ocr_hinh_anh = old_ocr


def test_vlm_cache_va_cooldown_nhanh():
    import threading

    calls = []

    class FakeInteractions:
        def create(self, **kwargs):
            calls.append(kwargs["model"])
            if kwargs["model"] == "gemini-3.5-flash-lite":
                raise RuntimeError("503 service_unavailable high demand")
            return types.SimpleNamespace(
                output_text=json.dumps({
                    "loai_chung_tu": "INVOICE",
                    "so_hoa_don": "00009999",
                    "mst": "0111214021",
                    "tong_thanh_toan": 500000,
                    "dong": [{"ten_san_pham": "Dịch vụ B", "so_luong": 1, "don_gia": 500000, "thanh_tien": 500000}],
                })
            )

    class FakeClient:
        def __init__(self, api_key=None):
            self.interactions = FakeInteractions()

    old_google = sys.modules.get("google")
    old_genai = sys.modules.get("google.genai")
    old_key = os.environ.get("GEMINI_API_KEY")
    old_models = os.environ.get("GEMINI_VLM_MODELS")
    old_mode = os.environ.get("VLM_PROVIDER")

    fake_genai = types.ModuleType("google.genai")
    fake_genai.Client = FakeClient
    fake_google = types.ModuleType("google")
    fake_google.genai = fake_genai
    sys.modules["google"] = fake_google
    sys.modules["google.genai"] = fake_genai
    os.environ["GEMINI_API_KEY"] = "test-cache-key"
    os.environ["GEMINI_VLM_MODELS"] = "gemini-3.5-flash-lite,gemini-3.1-flash-lite"
    os.environ["VLM_PROVIDER"] = "gemini"
    vlm_extractor._VLM_CACHE.clear()
    vlm_extractor._MODEL_COOLDOWN_UNTIL.clear()

    try:
        r1 = vlm_extractor.trich_xuat_bang_vlm(b"%PDF-1.4\ncache-A", "a.pdf", "INVOICE")
        assert r1["ket_qua"]["so_hoa_don"] == "00009999"
        assert calls == ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]

        # Lần 2 cùng bytes -> hit cache ngay lập tức, không gọi API
        r2 = vlm_extractor.trich_xuat_bang_vlm(b"%PDF-1.4\ncache-A", "a.pdf", "INVOICE")
        assert r2["ket_qua"]["so_hoa_don"] == "00009999"
        assert len(calls) == 2

        # File khác -> bỏ qua gemini-3.5-flash-lite đang cooldown, gọi thẳng gemini-3.1-flash-lite
        r3 = vlm_extractor.trich_xuat_bang_vlm(b"%PDF-1.4\ncache-B", "b.pdf", "INVOICE")
        assert r3["ket_qua"]["so_hoa_don"] == "00009999"
        assert calls == ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]

        # cancel_event đã set -> ném ExtractionCancelled ngay, không gọi API
        ev = threading.Event()
        ev.set()
        raised = False
        try:
            vlm_extractor.trich_xuat_bang_vlm(b"%PDF-1.4\ncancel-C", "c.pdf", "INVOICE", cancel_event=ev)
        except vlm_extractor.ExtractionCancelled:
            raised = True
        assert raised
        assert len(calls) == 3
    finally:
        vlm_extractor._VLM_CACHE.clear()
        vlm_extractor._MODEL_COOLDOWN_UNTIL.clear()
        if old_google is None:
            sys.modules.pop("google", None)
        else:
            sys.modules["google"] = old_google
        if old_genai is None:
            sys.modules.pop("google.genai", None)
        else:
            sys.modules["google.genai"] = old_genai
        for k, v in (("GEMINI_API_KEY", old_key), ("GEMINI_VLM_MODELS", old_models), ("VLM_PROVIDER", old_mode)):
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def test_toi_uu_anh_lon_cho_vlm():
    import numpy as np
    from PIL import Image

    rng = np.random.default_rng(42)
    arr = rng.integers(0, 256, (1800, 2200, 3), dtype=np.uint8)
    buf = io.BytesIO()
    Image.fromarray(arr, mode="RGB").save(buf, format="PNG")
    big_png = buf.getvalue()
    assert len(big_png) > 300_000

    opt_bytes, opt_mime = vlm_extractor._toi_uu_anh_cho_vlm(big_png, "image/png")
    assert opt_mime == "image/jpeg"
    assert len(opt_bytes) < len(big_png)
    with Image.open(io.BytesIO(opt_bytes)) as out_img:
        assert max(out_img.size) == 1600
