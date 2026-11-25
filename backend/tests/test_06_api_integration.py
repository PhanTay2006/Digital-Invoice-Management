"""Cấp độ 2: Integration Testing (FastAPI + PostgreSQL Triggers + 24 mẫu PDF + TC01..TC14 + DEF-01..DEF-07)."""
import io
import os
import sys
import time
from pathlib import Path

import httpx
import openpyxl
import pytest
from sqlalchemy import create_engine, text

_QA_CANDIDATES = [Path(__file__).resolve().parents[2] / "qa", Path(__file__).resolve().parents[1] / "qa"]
QA_ROOT = next((p for p in _QA_CANDIDATES if p.exists()), _QA_CANDIDATES[0])
SCRIPTS_DIR = QA_ROOT / "scripts"
PDF_ROOT = QA_ROOT / "pdf-samples"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import seed_demo_data as demo_seed

API_BASE = os.environ.get("CNPM_API_BASE", "http://localhost:8000/api")
DB_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://app:app@localhost:5432/doisoat")

engine = create_engine(DB_URL, pool_pre_ping=True)


def login(client: httpx.Client, username: str, password: str = "Matkhau@123") -> dict:
    r = client.post(f"{API_BASE}/dang-nhap", json={"ten_dang_nhap": username, "mat_khau": password})
    return {"status": r.status_code, "body": r.json()}


def auth_hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def upload_pdf(client: httpx.Client, token: str, endpoint: str, file_path: Path):
    with open(file_path, "rb") as f:
        return client.post(
            f"{API_BASE}{endpoint}",
            headers=auth_hdr(token),
            files={"file": (file_path.name, f.read(), "application/pdf")},
        )


@pytest.fixture(scope="module")
def env_ctx():
    # Kiểm tra API và DB đang chạy trước khi test
    demo_seed.seed_all(reset=True, fix_seed_buyer=False)
    with httpx.Client(timeout=30.0) as client:
        tokens = {}
        for u in ("admin", "muahang", "thukho", "ketoan", "quanly", "tester"):
            res = login(client, u)
            assert res["status"] == 200, f"Không đăng nhập được {u}: {res}"
            tokens[u] = res["body"]["token"]
        yield {"client": client, "tokens": tokens, "state": {}}


# ---------------------------------------------------------------------------
# TC01 - TC03: XÁC THỰC JWT & PHÂN QUYỀN RBAC 6 VAI TRÒ
# ---------------------------------------------------------------------------

def test_tc01_dang_nhap_hop_le(env_ctx):
    c = env_ctx["client"]
    res = login(c, "ketoan")
    assert res["status"] == 200
    assert res["body"]["token"]
    assert res["body"]["nguoi_dung"]["vai_tro"] == "KE_TOAN_AP"


def test_tc02_dang_nhap_sai_mat_khau_va_tai_khoan_khoa(env_ctx):
    c = env_ctx["client"]
    res_wrong = login(c, "ketoan", "WrongPassword!")
    assert res_wrong["status"] == 401

    # Tạo user mới rồi khóa tài khoản -> không đăng nhập được (401)
    uname = f"qa_lock_{int(time.time())}"
    r_new = c.post(
        f"{API_BASE}/nguoi-dung",
        headers=auth_hdr(env_ctx["tokens"]["admin"]),
        json={"ten_dang_nhap": uname, "mat_khau": "Matkhau@123", "ho_ten": "QA Temp Lock", "vai_tro": "MUA_HANG"},
    )
    assert r_new.status_code == 201
    uid = r_new.json()["id"]
    r_lock = c.put(
        f"{API_BASE}/nguoi-dung/{uid}",
        headers=auth_hdr(env_ctx["tokens"]["admin"]),
        json={"hoat_dong": False},
    )
    assert r_lock.status_code == 200
    assert login(c, uname)["status"] == 401


def test_tc03_phan_quyen_rbac_6_vai_tro(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    # Thủ kho không được tạo hóa đơn
    assert c.post(f"{API_BASE}/hoa-don", headers=auth_hdr(t["thukho"]), json={}).status_code == 403
    # Mua hàng không được lập phiếu kho
    assert c.post(f"{API_BASE}/phieu-kho", headers=auth_hdr(t["muahang"]), json={}).status_code == 403
    # Kế toán không được tạo PO, duyệt ngoại lệ, xem audit-log
    assert c.post(f"{API_BASE}/po", headers=auth_hdr(t["ketoan"]), json={}).status_code == 403
    assert c.put(f"{API_BASE}/yeu-cau-duyet/1", headers=auth_hdr(t["ketoan"]), json={"quyet_dinh": "DUYET", "ghi_chu": "test"}).status_code == 403
    assert c.get(f"{API_BASE}/audit-log", headers=auth_hdr(t["ketoan"])).status_code == 403
    # Token giả bị 401
    assert c.get(f"{API_BASE}/hoa-don", headers=auth_hdr("invalid.jwt.token")).status_code == 401
    # Admin không thể tự khóa/đổi vai trò hoặc xóa chính mình
    me_admin = c.get(f"{API_BASE}/nguoi-dung", headers=auth_hdr(t["admin"])).json()
    admin_id = next(u["id"] for u in me_admin if u["ten_dang_nhap"] == "admin")
    assert c.put(f"{API_BASE}/nguoi-dung/{admin_id}", headers=auth_hdr(t["admin"]), json={"hoat_dong": False}).status_code == 403
    assert c.delete(f"{API_BASE}/nguoi-dung/{admin_id}", headers=auth_hdr(t["admin"])).status_code == 403


# ---------------------------------------------------------------------------
# TC04 - TC06: TẠO HÓA ĐƠN, UPLOAD PDF ĐÚNG / SAI, BẮT LỖI KỸ THUẬT
# ---------------------------------------------------------------------------

def test_tc04_tao_hoa_don_thu_cong_va_chong_trung(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    nccs = c.get(f"{API_BASE}/nha-cung-cap", headers=auth_hdr(t["ketoan"])).json()
    pos = c.get(f"{API_BASE}/po", headers=auth_hdr(t["ketoan"])).json()
    ncc_abc = next(x for x in nccs if x["mst"] == "0312345678")
    po_001 = next(x for x in pos if x["so_po"] == "PO-2026-001")

    payload = {
        "so_hoa_don": "HD-2026-9901",
        "nha_cung_cap_id": ncc_abc["id"],
        "po_id": po_001["id"],
        "ngay_lap": "2026-10-12",
        "vat": 5000000,
        "tien_coc_tru": 0,
        "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM",
        "mst_nguoi_mua": "0108666888",
        "dong": [
            {"ma_sku_ncc": "ABC-01", "ten_san_pham": "Thiết bị 5G tiêu chuẩn", "so_luong": 50, "don_gia": 1000000}
        ],
    }
    r1 = c.post(f"{API_BASE}/hoa-don", headers=auth_hdr(t["ketoan"]), json=payload)
    assert r1.status_code == 201
    assert r1.json()["tong_thanh_toan"] == "55000000.00"
    # Trùng số hóa đơn cùng NCC -> 409 Conflict (BR-01)
    r_dup = c.post(f"{API_BASE}/hoa-don", headers=auth_hdr(t["ketoan"]), json=payload)
    assert r_dup.status_code == 409


def test_tc05_upload_pdf_dung_grn_va_invoice_va_preview(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    # Upload GRN_DUNG_01
    rg = upload_pdf(c, t["thukho"], "/phieu-kho/upload", PDF_ROOT / "01-grn-valid/GRN_DUNG_01_NhapDu_PO101.pdf")
    assert rg.status_code == 200
    gdata = rg.json()
    assert gdata["so_phieu"] == "GRN-2026-101"
    assert gdata["po_id"] is not None
    assert gdata["kiem_tra_cong_ty"]["dat"] is True
    assert len(gdata["dong"]) == 2
    assert c.get(f"{API_BASE}/tep-dinh-kem/{gdata['file_pdf']}").status_code == 200

    # Lưu GRN_DUNG_01 qua API
    r_save_g = c.post(
        f"{API_BASE}/phieu-kho",
        headers=auth_hdr(t["thukho"]),
        json={
            "so_phieu": gdata["so_phieu"],
            "po_id": gdata["po_id"],
            "ngay_nhap": gdata["ngay_nhap"],
            "file_pdf": gdata["file_pdf"],
            "ten_don_vi": gdata["ten_nguoi_mua"],
            "mst_don_vi": gdata["mst_nguoi_mua"],
            "dong": [
                {"dong_po_id": d["dong_po_id"], "so_nhan": float(d["so_nhan"]), "so_dat": float(d["so_dat"]), "so_tu_choi": float(d["so_tu_choi"]), "ly_do": d.get("ly_do")}
                for d in gdata["dong"]
            ],
        },
    )
    assert r_save_g.status_code == 201
    assert r_save_g.json()["trang_thai"] == "CONFIRMED"

    # Upload HD_DUNG_01
    rh = upload_pdf(c, t["ketoan"], "/hoa-don/upload", PDF_ROOT / "03-invoice-valid/HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf")
    assert rh.status_code == 200
    hdata = rh.json()
    assert hdata["so_hoa_don"] == "00015801"
    assert hdata["kiem_tra_cong_ty"]["trang_thai"] == "KHOP"
    assert hdata["canh_bao"] == []
    env_ctx["state"]["hd_dung_01_upload"] = hdata


def test_tc06_upload_pdf_sai_va_loi_ky_thuat(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    d = PDF_ROOT / "04-invoice-invalid"

    # File hỏng cấu trúc -> 422
    assert upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_10_FileHongCauTruc_Corrupted.pdf").status_code == 422
    # File giả mạo .pdf -> 415
    assert upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf").status_code == 415
    # Ảnh scan trắng -> 422 (hoặc cảnh báo OCR nếu container chạy OCR rỗng)
    r_blank = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_12_AnhScanTrang_KhongCoChu.pdf")
    assert r_blank.status_code in (200, 422)
    if r_blank.status_code == 200:
        assert len(r_blank.json()["canh_bao"]) >= 4

    # Nhầm phiếu kho vào hóa đơn -> cảnh báo loại GRN
    r_wrong = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf")
    assert r_wrong.status_code == 200
    assert r_wrong.json()["loai_chung_tu_nhan_dien"] == "GRN"
    assert any("GRN" in w for w in r_wrong.json()["canh_bao"])

    # Thiếu trường UC07
    r_miss = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf")
    assert r_miss.status_code == 200
    assert len(r_miss.json()["canh_bao"]) >= 5

    # Sai công ty bên mua
    r_comp = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf")
    assert r_comp.status_code == 200
    assert r_comp.json()["kiem_tra_cong_ty"]["trang_thai"] == "KHONG_KHOP"

    # Trùng số hóa đơn & sai PO
    r_dup = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / "HD_SAI_07_TrungSoHoaDon_Va_SaiPO_BR01.pdf")
    assert r_dup.status_code == 200
    assert any("trùng" in w.lower() for w in r_dup.json()["canh_bao"])
    assert any("po không tồn tại" in w.lower() for w in r_dup.json()["canh_bao"])


def _save_invoice_from_upload(c: httpx.Client, token: str, upload_json: dict, override_po_id: int | None = None) -> int:
    payload = {
        "so_hoa_don": upload_json["so_hoa_don"],
        "nha_cung_cap_id": upload_json["nha_cung_cap_id"],
        "po_id": override_po_id or upload_json["po_id"],
        "ngay_lap": upload_json["ngay_lap"],
        "vat": float(upload_json["vat"] or 0),
        "tien_coc_tru": float(upload_json["tien_coc_tru"] or 0),
        "file_pdf": upload_json["file_pdf"],
        "ma_cqt": upload_json.get("ma_cqt"),
        "ten_nguoi_mua": upload_json.get("ten_nguoi_mua"),
        "mst_nguoi_mua": upload_json.get("mst_nguoi_mua"),
        "dong": [
            {
                "ma_sku_ncc": d["ma_sku_ncc"],
                "ten_san_pham": d.get("ten_san_pham") or d["ma_sku_ncc"],
                "so_luong": float(d["so_luong"]),
                "don_gia": float(d["don_gia"]),
            }
            for d in upload_json["dong"]
        ],
    }
    r = c.post(f"{API_BASE}/hoa-don", headers=auth_hdr(token), json=payload)
    assert r.status_code == 201, f"Save invoice failed: {r.status_code} {r.text}"
    return r.json()["id"]


# ---------------------------------------------------------------------------
# TC07 - TC11: ĐỐI SOÁT 3 CHIỀU (KHỚP, DUNG SAI, CỌC, PARTIAL, DỊCH VỤ, MISMATCH)
# ---------------------------------------------------------------------------

def test_tc07_doi_soat_khop_tuyet_doi_va_khoa_reconciled(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    hdata = env_ctx["state"]["hd_dung_01_upload"]
    hid = _save_invoice_from_upload(c, t["ketoan"], hdata)

    rm = c.post(f"{API_BASE}/hoa-don/{hid}/doi-soat", headers=auth_hdr(t["ketoan"]))
    assert rm.status_code == 200
    assert rm.json()["ket_qua"] == "MATCHED"

    rc = c.post(f"{API_BASE}/hoa-don/{hid}/xac-nhan", headers=auth_hdr(t["ketoan"]))
    assert rc.status_code == 200
    assert rc.json()["trang_thai"] == "RECONCILED"

    # Chạy lại trên hóa đơn RECONCILED bị khóa 409 (BR-04)
    assert c.post(f"{API_BASE}/hoa-don/{hid}/doi-soat", headers=auth_hdr(t["ketoan"])).status_code == 409


def test_tc08_doi_soat_dung_sai_tru_coc_viet_tat_va_po_dich_vu(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    for fname in (
        "HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf",
        "HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf",
        "HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf",
    ):
        ru = upload_pdf(c, t["ketoan"], "/hoa-don/upload", PDF_ROOT / "03-invoice-valid" / fname)
        assert ru.status_code == 200
        hid = _save_invoice_from_upload(c, t["ketoan"], ru.json())
        rm = c.post(f"{API_BASE}/hoa-don/{hid}/doi-soat", headers=auth_hdr(t["ketoan"]))
        assert rm.status_code == 200
        assert rm.json()["ket_qua"] == "MATCHED", f"{fname} phải MATCHED, thực tế: {rm.json()}"


def test_tc10_doi_soat_partial_va_nhap_bo_sung_dot_2(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    # Đợt 1: Nhập 600, đạt 500, từ chối 100 trên PO-2026-102 (đặt 1000)
    rg1 = upload_pdf(c, t["thukho"], "/phieu-kho/upload", PDF_ROOT / "01-grn-valid/GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf")
    g1 = rg1.json()
    r_sg1 = c.post(
        f"{API_BASE}/phieu-kho",
        headers=auth_hdr(t["thukho"]),
        json={
            "so_phieu": g1["so_phieu"], "po_id": g1["po_id"], "ngay_nhap": g1["ngay_nhap"],
            "file_pdf": g1["file_pdf"], "ten_don_vi": g1["ten_nguoi_mua"], "mst_don_vi": g1["mst_nguoi_mua"],
            "dong": [{"dong_po_id": d["dong_po_id"], "so_nhan": float(d["so_nhan"]), "so_dat": float(d["so_dat"]), "so_tu_choi": float(d["so_tu_choi"]), "ly_do": d.get("ly_do")} for d in g1["dong"]],
        },
    )
    assert r_sg1.status_code == 201
    assert r_sg1.json()["trang_thai"] == "PARTIAL"

    # Hóa đơn khai khống 600 > 500 đạt -> MISMATCH bước c
    rh_bad = upload_pdf(c, t["ketoan"], "/hoa-don/upload", PDF_ROOT / "04-invoice-invalid/HD_SAI_03_KhaiKhongSoLuong_VuotNhapKho_PO102.pdf")
    hid_bad = _save_invoice_from_upload(c, t["ketoan"], rh_bad.json())
    rm_bad = c.post(f"{API_BASE}/hoa-don/{hid_bad}/doi-soat", headers=auth_hdr(t["ketoan"]))
    assert rm_bad.json()["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in rm_bad.json()["chi_tiet_buoc"] if not b["dat"]] == ["c"]

    # Hóa đơn 500 == 500 đạt -> PARTIAL
    rh_part = upload_pdf(c, t["ketoan"], "/hoa-don/upload", PDF_ROOT / "03-invoice-valid/HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf")
    hid_part = _save_invoice_from_upload(c, t["ketoan"], rh_part.json())
    rm_part = c.post(f"{API_BASE}/hoa-don/{hid_part}/doi-soat", headers=auth_hdr(t["ketoan"]))
    assert rm_part.json()["ket_qua"] == "PARTIAL"

    # Đợt 2: Nhập bổ sung 500 -> CONFIRMED, chạy lại đối soát ra MATCHED và giữ 2 dòng lịch sử (BR-17)
    rg2 = upload_pdf(c, t["thukho"], "/phieu-kho/upload", PDF_ROOT / "01-grn-valid/GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf")
    g2 = rg2.json()
    r_sg2 = c.post(
        f"{API_BASE}/phieu-kho",
        headers=auth_hdr(t["thukho"]),
        json={
            "so_phieu": g2["so_phieu"], "po_id": g2["po_id"], "ngay_nhap": g2["ngay_nhap"],
            "file_pdf": g2["file_pdf"], "ten_don_vi": g2["ten_nguoi_mua"], "mst_don_vi": g2["mst_nguoi_mua"],
            "dong": [{"dong_po_id": d["dong_po_id"], "so_nhan": float(d["so_nhan"]), "so_dat": float(d["so_dat"]), "so_tu_choi": float(d["so_tu_choi"]), "ly_do": d.get("ly_do")} for d in g2["dong"]],
        },
    )
    assert r_sg2.status_code == 201 and r_sg2.json()["trang_thai"] == "CONFIRMED"

    rm_full = c.post(f"{API_BASE}/hoa-don/{hid_part}/doi-soat", headers=auth_hdr(t["ketoan"]))
    assert rm_full.json()["ket_qua"] == "MATCHED"
    detail = c.get(f"{API_BASE}/hoa-don/{hid_part}", headers=auth_hdr(t["ketoan"])).json()
    assert len(detail["lan_doi_soat"]) == 2


def test_tc09_tc11_cac_truong_hop_mismatch_va_doi_soat_hang_loat(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    d = PDF_ROOT / "04-invoice-invalid"

    cases = [
        ("HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf", "sai_01_id", ["d"]),
        ("HD_SAI_02_LechDonGia_15Pct_VuotHanMucDuyet_PO101.pdf", "sai_02_id", ["d"]),
        ("HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf", "sai_04_id", ["f"]),
        ("HD_SAI_05_MaHangSKULa_ChuaAnhXa_PO101.pdf", "sai_05_id", ["b", "c"]),  # SKU lạ không map -> thiếu SL dòng PO còn lại hoặc SKU lạ ở bước b
        ("HD_SAI_06_QuenTruTienCoc_SaiTongTien_PO103.pdf", "sai_06_id", ["e"]),
    ]
    batch_ids = []
    for fname, state_key, _ in cases:
        ru = upload_pdf(c, t["ketoan"], "/hoa-don/upload", d / fname)
        assert ru.status_code == 200
        hid = _save_invoice_from_upload(c, t["ketoan"], ru.json())
        env_ctx["state"][state_key] = hid
        batch_ids.append(hid)

    # Đối soát hàng loạt trong < 3000ms (NF-01)
    t0 = time.perf_counter()
    rb = c.post(f"{API_BASE}/hoa-don/doi-soat-hang-loat", headers=auth_hdr(t["ketoan"]), json={"hoa_don_ids": batch_ids})
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert rb.status_code == 200
    assert rb.json()["tong_xu_ly"] == len(batch_ids)
    assert rb.json()["mismatch"] == len(batch_ids)
    assert elapsed_ms < 3000

    # Kiểm tra chi tiết từng loại lỗi và Notification sinh ra
    d1 = c.get(f"{API_BASE}/hoa-don/{env_ctx['state']['sai_01_id']}", headers=auth_hdr(t["ketoan"])).json()
    assert d1["lan_doi_soat"][0]["lech_lon"] is True
    assert float(d1["lan_doi_soat"][0]["muc_lech_tien"]) == 6000000.0

    d4 = c.get(f"{API_BASE}/hoa-don/{env_ctx['state']['sai_04_id']}", headers=auth_hdr(t["ketoan"])).json()
    assert [b["ma_buoc"] for b in d4["lan_doi_soat"][0]["chi_tiet_buoc"] if not b["dat"]] == ["f"]

    d5 = c.get(f"{API_BASE}/hoa-don/{env_ctx['state']['sai_05_id']}", headers=auth_hdr(t["ketoan"])).json()
    assert "b" in [b["ma_buoc"] for b in d5["lan_doi_soat"][0]["chi_tiet_buoc"] if not b["dat"]]

    d6 = c.get(f"{API_BASE}/hoa-don/{env_ctx['state']['sai_06_id']}", headers=auth_hdr(t["ketoan"])).json()
    assert [b["ma_buoc"] for b in d6["lan_doi_soat"][0]["chi_tiet_buoc"] if not b["dat"]] == ["e"]

    # Kiểm tra Thông báo (F-11) & đánh dấu đã đọc
    notifs = c.get(f"{API_BASE}/thong-bao?chua_doc=true", headers=auth_hdr(t["ketoan"])).json()
    assert len(notifs) >= 1
    assert c.put(f"{API_BASE}/thong-bao/{notifs[0]['id']}/da-doc", headers=auth_hdr(t["ketoan"])).status_code == 200


# ---------------------------------------------------------------------------
# TC12: TRANH CHẤP & PHÊ DUYỆT NGOẠI LỆ LỆCH LỚN (TR-04, TR-05, TR-07, TR-08)
# ---------------------------------------------------------------------------

def test_tc12_vong_doi_tranh_chap_va_duyet_ngoai_le(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    hid_6pct = env_ctx["state"]["sai_01_id"]
    hid_15pct = env_ctx["state"]["sai_02_id"]

    # 1. Tranh chấp + Duyệt ngoại lệ cho HD_SAI_01 (lệch 6tr <= hạn mức 10tr)
    rtc1 = c.post(f"{API_BASE}/hoa-don/{hid_6pct}/tranh-chap", headers=auth_hdr(t["ketoan"]), json={"ly_do": "NCC báo tăng giá bơ lạt 6%"})
    assert rtc1.status_code == 201
    tid1 = rtc1.json()["id"]

    # Không được nhảy cóc OPEN -> RESOLVED (409)
    assert c.put(f"{API_BASE}/tranh-chap/{tid1}/trang-thai", headers=auth_hdr(t["ketoan"]), json={"trang_thai": "RESOLVED"}).status_code == 409
    assert c.put(f"{API_BASE}/tranh-chap/{tid1}/trang-thai", headers=auth_hdr(t["ketoan"]), json={"trang_thai": "IN_PROGRESS", "ghi_chu": "Đang trình xin duyệt"}).status_code == 200

    ry1 = c.post(f"{API_BASE}/tranh-chap/{tid1}/yeu-cau-duyet", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Biến động giá nguyên liệu nhập khẩu"})
    assert ry1.status_code == 201
    yid1 = ry1.json()["id"]

    # Quản lý thiếu ghi chú -> 422
    assert c.put(f"{API_BASE}/yeu-cau-duyet/{yid1}", headers=auth_hdr(t["quanly"]), json={"quyet_dinh": "DUYET", "ghi_chu": "   "}).status_code == 422

    # Quản lý duyệt -> Hóa đơn tự động sang RECONCILED + theo_ngoai_le=True, Tranh chấp sang RESOLVED
    r_app = c.put(f"{API_BASE}/yeu-cau-duyet/{yid1}", headers=auth_hdr(t["quanly"]), json={"quyet_dinh": "DUYET", "ghi_chu": "Kế toán trưởng đồng ý duyệt theo ngoại lệ"})
    assert r_app.status_code == 200
    hd_after = c.get(f"{API_BASE}/hoa-don/{hid_6pct}", headers=auth_hdr(t["ketoan"])).json()
    assert hd_after["trang_thai"] == "RECONCILED"
    assert hd_after["theo_ngoai_le"] is True

    # 2. HD_SAI_02 (lệch 15tr > hạn mức 10tr) -> Trigger TR-08 chặn gửi duyệt ngoại lệ (422)
    rtc2 = c.post(f"{API_BASE}/hoa-don/{hid_15pct}/tranh-chap", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Lệch đơn giá 15%"})
    assert rtc2.status_code == 201
    tid2 = rtc2.json()["id"]
    ry2 = c.post(f"{API_BASE}/tranh-chap/{tid2}/yeu-cau-duyet", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Xin vượt hạn mức"})
    assert ry2.status_code == 422
    assert "vượt hạn mức" in ry2.json()["detail"].lower()

    # Đóng tranh chấp thủ công (OPEN -> IN_PROGRESS -> RESOLVED) -> TR-05 đưa hóa đơn về CHUA_DOI_SOAT
    assert c.put(f"{API_BASE}/tranh-chap/{tid2}/trang-thai", headers=auth_hdr(t["ketoan"]), json={"trang_thai": "IN_PROGRESS", "ghi_chu": "Yêu cầu NCC xuất lại"}).status_code == 200
    assert c.put(f"{API_BASE}/tranh-chap/{tid2}/trang-thai", headers=auth_hdr(t["ketoan"]), json={"trang_thai": "RESOLVED", "ghi_chu": "NCC đồng ý điều chỉnh"}).status_code == 200
    hd2_after = c.get(f"{API_BASE}/hoa-don/{hid_15pct}", headers=auth_hdr(t["ketoan"])).json()
    assert hd2_after["trang_thai"] == "CHUA_DOI_SOAT"


# ---------------------------------------------------------------------------
# TC13: KIỂM TRA TRIGGERS CSDL & AUDIT LOG BẤT BIẾN
# ---------------------------------------------------------------------------

def test_tc13_triggers_csdl_va_audit_log_bat_bien(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    # 1. GRN vượt số lượng PO -> Trigger TR-02 / BR-09 chặn 422
    pos = c.get(f"{API_BASE}/po", headers=auth_hdr(t["thukho"])).json()
    po102 = next(x for x in pos if x["so_po"] == "PO-2026-102")
    po102_d = c.get(f"{API_BASE}/po/{po102['id']}", headers=auth_hdr(t["thukho"])).json()
    assert c.post(
        f"{API_BASE}/phieu-kho",
        headers=auth_hdr(t["thukho"]),
        json={"so_phieu": "GRN-2026-902", "po_id": po102["id"], "ngay_nhap": "2026-10-07", "dong": [{"dong_po_id": po102_d["dong"][0]["id"], "so_nhan": 1200, "so_dat": 1200, "so_tu_choi": 0}]},
    ).status_code == 422

    # 2. GRN lập cho PO dịch vụ -> Trigger TR-01 / BR-08 chặn 422
    po104 = next(x for x in pos if x["so_po"] == "PO-2026-104")
    po104_d = c.get(f"{API_BASE}/po/{po104['id']}", headers=auth_hdr(t["thukho"])).json()
    assert c.post(
        f"{API_BASE}/phieu-kho",
        headers=auth_hdr(t["thukho"]),
        json={"so_phieu": "GRN-2026-904", "po_id": po104["id"], "ngay_nhap": "2026-10-09", "dong": [{"dong_po_id": po104_d["dong"][0]["id"], "so_nhan": 1, "so_dat": 1, "so_tu_choi": 0}]},
    ).status_code == 422

    # 3. Kiểm tra Audit Log qua API (admin) không lộ mat_khau_bam và ghi đủ vết
    logs = c.get(f"{API_BASE}/audit-log?limit=100", headers=auth_hdr(t["admin"])).json()
    assert len(logs) > 5
    for lg in logs:
        if isinstance(lg.get("du_lieu_moi"), dict):
            assert "mat_khau_bam" not in lg["du_lieu_moi"]

    # 4. Trigger tầng CSDL chặn DELETE phieu_kho, UPDATE/DELETE hoa_don RECONCILED, UPDATE/DELETE audit_log
    with engine.connect() as conn:
        with pytest.raises(Exception):
            conn.execute(text("DELETE FROM phieu_kho WHERE so_phieu='GRN-001'"))
            conn.commit()
        conn.rollback()

        with pytest.raises(Exception):
            conn.execute(text("DELETE FROM audit_log WHERE id = (SELECT id FROM audit_log LIMIT 1)"))
            conn.commit()
        conn.rollback()

        with pytest.raises(Exception):
            conn.execute(text("UPDATE audit_log SET hanh_dong='TAMPERED' WHERE id = (SELECT id FROM audit_log LIMIT 1)"))
            conn.commit()
        conn.rollback()


# ---------------------------------------------------------------------------
# TC14: DASHBOARD & XUẤT BÁO CÁO CSV / XLSX
# ---------------------------------------------------------------------------

def test_tc14_dashboard_va_xuat_bao_cao(env_ctx):
    c, t = env_ctx["client"], env_ctx["tokens"]
    rd = c.get(f"{API_BASE}/dashboard", headers=auth_hdr(t["quanly"]))
    assert rd.status_code == 200
    assert "theo_trang_thai" in rd.json()

    t0 = time.perf_counter()
    rcsv = c.get(f"{API_BASE}/bao-cao/hoa-don.csv", headers=auth_hdr(t["ketoan"]))
    rxlsx = c.get(f"{API_BASE}/bao-cao/hoa-don.xlsx", headers=auth_hdr(t["ketoan"]))
    assert (time.perf_counter() - t0) < 3.0
    assert rcsv.status_code == 200 and rcsv.content.startswith(b"\xef\xbb\xbf")
    assert rxlsx.status_code == 200
    wb = openpyxl.load_workbook(io.BytesIO(rxlsx.content))
    ws = wb.active
    assert ws.title == "Hóa đơn"
    assert ws.cell(1, 1).value == "Số hóa đơn"
    assert ws.max_row >= 5


# ---------------------------------------------------------------------------
# KIỂM CHỨNG THỰC NGHIỆM 7 ĐIỂM LỆCH / BUG ĐẶC TẢ CNPM (DEF-01 .. DEF-07)
# ---------------------------------------------------------------------------

def test_defects_01_to_07_tai_hien_thuc_nghiem(env_ctx):
    """Kiểm chứng trung thực các sai lệch giữa code hiện tại và đặc tả SRS/BR để đưa vào Bug Log."""
    c, t = env_ctx["client"], env_ctx["tokens"]

    # DEF-01: HD-0457 gốc thiếu ten_nguoi_mua/mst_nguoi_mua -> khi đối soát bị rớt thêm bước f
    hds = c.get(f"{API_BASE}/hoa-don?so_hoa_don=HD-0457", headers=auth_hdr(t["ketoan"])).json()
    hd_0457_id = hds[0]["id"]
    rm_0457 = c.post(f"{API_BASE}/hoa-don/{hd_0457_id}/doi-soat", headers=auth_hdr(t["ketoan"])).json()
    failed_steps = [b["ma_buoc"] for b in rm_0457["chi_tiet_buoc"] if not b["dat"]]
    assert failed_steps == ["d", "f"], f"DEF-01 xác nhận: rớt cả bước d và f ({failed_steps})"

    # DEF-02: Đang có yêu cầu duyệt ngoại lệ CHO_DUYET nhưng hệ thống chưa khóa tạm đối soát lại & cập nhật tranh chấp (BR-04, BR-22)
    hid_06 = env_ctx["state"]["sai_06_id"]
    rtc_lock = c.post(f"{API_BASE}/hoa-don/{hid_06}/tranh-chap", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Test DEF-02"})
    assert rtc_lock.status_code == 201
    # Hóa đơn có mức lệch 0 (chỉ lệch bước e cọc), chuyển thử trên sai_04 hoặc dùng đơn giá lệch lớn mới
    # Tạo hóa đơn mới trên PO-2026-105 bị lệch lớn 6tr để kiểm tra lúc CHO_DUYET
    pos = c.get(f"{API_BASE}/po", headers=auth_hdr(t["ketoan"])).json()
    po105 = next(x for x in pos if x["so_po"] == "PO-2026-105")
    r_h_def2 = c.post(
        f"{API_BASE}/hoa-don",
        headers=auth_hdr(t["ketoan"]),
        json={
            "so_hoa_don": "HD-2026-DEF02", "nha_cung_cap_id": po105["nha_cung_cap_id"], "po_id": po105["id"],
            "ngay_lap": "2026-10-18", "vat": 10600000, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888",
            "dong": [{"ma_sku_ncc": "AC-BOLAT-02", "so_luong": 100, "don_gia": 1060000}],
        },
    )
    hid_def2 = r_h_def2.json()["id"]
    c.post(f"{API_BASE}/hoa-don/{hid_def2}/doi-soat", headers=auth_hdr(t["ketoan"]))
    tid_def2 = c.post(f"{API_BASE}/hoa-don/{hid_def2}/tranh-chap", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Lệch 6tr"}).json()["id"]
    c.post(f"{API_BASE}/tranh-chap/{tid_def2}/yeu-cau-duyet", headers=auth_hdr(t["ketoan"]), json={"ly_do": "Test lock"}).raise_for_status()
    # DEF-02: Hệ thống hiện cho phép chạy lại đối soát (200) và đổi trạng thái tranh chấp (200) khi đang CHO_DUYET
    assert c.post(f"{API_BASE}/hoa-don/{hid_def2}/doi-soat", headers=auth_hdr(t["ketoan"])).status_code == 200
    assert c.put(f"{API_BASE}/tranh-chap/{tid_def2}/trang-thai", headers=auth_hdr(t["ketoan"]), json={"trang_thai": "IN_PROGRESS", "ghi_chu": "DEF-02"}).status_code == 200

    # DEF-03: Chưa kiểm tra điều kiện ngay_lap >= ngay_dat (BR-14)
    r_h_def3 = c.post(
        f"{API_BASE}/hoa-don",
        headers=auth_hdr(t["ketoan"]),
        json={
            "so_hoa_don": "HD-2026-DEF03", "nha_cung_cap_id": po105["nha_cung_cap_id"], "po_id": po105["id"],
            "ngay_lap": "2020-01-01",  # Trước ngày PO 2026-10-10!
            "vat": 10000000, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888",
            "dong": [{"ma_sku_ncc": "AC-BOLAT-02", "so_luong": 100, "don_gia": 1000000}],
        },
    )
    rm_def3 = c.post(f"{API_BASE}/hoa-don/{r_h_def3.json()['id']}/doi-soat", headers=auth_hdr(t["ketoan"])).json()
    assert rm_def3["ket_qua"] == "MATCHED"  # Xác nhận chưa kiểm tra ngày hóa đơn < ngày PO

    # DEF-04: POST /api/cau-hinh khi nguong_lech_lon_tien > han_muc_duyet chưa bắt DBAPIError -> lỗi 500
    with httpx.Client(timeout=15.0) as raw_c:
        try:
            r_cfg = raw_c.post(
                f"{API_BASE}/cau-hinh",
                headers=auth_hdr(t["admin"]),
                json={"dung_sai_don_gia_pct": 2, "nguong_lech_lon_pct": 5, "nguong_lech_lon_tien": 20000000, "han_muc_duyet": 5000000},
            )
            assert r_cfg.status_code == 500
        except httpx.RemoteProtocolError:
            pass  # Uvicorn trả 500 hoặc đóng stream khi exception không được bắt

    # DEF-07: Export CSV không escape tiền tố '=' chống Formula Injection (BR-27 / NF-17)
    r_ncc_inj = c.post(
        f"{API_BASE}/nha-cung-cap",
        headers=auth_hdr(t["admin"]),
        json={"ten": "=CMD('calc')", "mst": "0399887766"},
    )
    assert r_ncc_inj.status_code == 201
    c.post(
        f"{API_BASE}/hoa-don",
        headers=auth_hdr(t["ketoan"]),
        json={
            "so_hoa_don": "HD-2026-DEF07", "nha_cung_cap_id": r_ncc_inj.json()["id"], "po_id": po105["id"],
            "ngay_lap": "2026-10-18", "vat": 0, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888",
            "dong": [{"ma_sku_ncc": "AC-BOLAT-02", "so_luong": 1, "don_gia": 100000}],
        },
    ).raise_for_status()
    csv_txt = c.get(f"{API_BASE}/bao-cao/hoa-don.csv", headers=auth_hdr(t["ketoan"])).content.decode("utf-8-sig")
    assert "=CMD('calc')" in csv_txt and "'=CMD('calc')" not in csv_txt

    # DEF-05: PO hàng hóa chưa có GRN nào -> engine trả MISMATCH thay vì PARTIAL (BR-15)
    pos_all = c.get(f"{API_BASE}/po", headers=auth_hdr(t["muahang"])).json()
    ncc_id_105 = pos_all[0]["nha_cung_cap_id"]
    r_po_nogrn = c.post(
        f"{API_BASE}/po",
        headers=auth_hdr(t["muahang"]),
        json={
            "so_po": "PO-2026-DEF05", "nha_cung_cap_id": ncc_id_105, "ngay_dat": "2026-10-01",
            "loai_po": "HANG_HOA", "dong": [{"ma_sku": "SKU-BO02", "so_luong_dat": 10, "don_gia": 1000000}],
        },
    )
    assert r_po_nogrn.status_code == 201
    r_hd_nogrn = c.post(
        f"{API_BASE}/hoa-don",
        headers=auth_hdr(t["ketoan"]),
        json={
            "so_hoa_don": "HD-2026-DEF05", "nha_cung_cap_id": ncc_id_105, "po_id": r_po_nogrn.json()["id"],
            "ngay_lap": "2026-10-05", "vat": 1000000, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888",
            "dong": [{"ma_sku_ncc": "AC-BOLAT-02", "so_luong": 10, "don_gia": 1000000}],
        },
    )
    assert r_hd_nogrn.status_code == 201
    rm_nogrn = c.post(f"{API_BASE}/hoa-don/{r_hd_nogrn.json()['id']}/doi-soat", headers=auth_hdr(t["ketoan"])).json()
    assert rm_nogrn["ket_qua"] == "MISMATCH"

    # DEF-06: Thiếu API PUT/DELETE cho /hoa-don/{id} và /po/{id} -> 405 Method Not Allowed
    assert c.delete(f"{API_BASE}/hoa-don/{r_hd_nogrn.json()['id']}", headers=auth_hdr(t["ketoan"])).status_code == 405
    assert c.put(f"{API_BASE}/po/{r_po_nogrn.json()['id']}", headers=auth_hdr(t["muahang"]), json={}).status_code == 405
