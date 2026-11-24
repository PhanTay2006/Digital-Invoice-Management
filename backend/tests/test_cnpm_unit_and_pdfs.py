"""Cấp độ 1: Unit Testing chuẩn CNPM (Boundary Value Analysis, Equivalence Partitioning & 24 mẫu PDF)."""
from decimal import Decimal as D
from pathlib import Path
import pytest
from fastapi import HTTPException

from app.domain.company import DEFAULT_COMPANY_INFO, chuan_hoa_mst, chuan_hoa_ten_cong_ty, doi_chieu_cong_ty
from app.domain.matching import Cau_hinh, doi_soat
from app.infrastructure.pdf_parser import doc_tai_lieu, nhan_dien_loai_chung_tu, trich_hoa_don, trich_phieu_kho

PDF_ROOT = Path(r"f:\University\source\cnpm\Bo_Mau_Chung_Tu_Demo_Co_Kim_Anh")
CFG = Cau_hinh(D("2"), D("5"), D("5000000"), D("10000000"))
PO_HH = {"nha_cung_cap_id": 1, "loai_po": "HANG_HOA", "tien_coc": D("0")}
DPO = {10: {"so_luong_dat": D("100"), "don_gia": D("1000000")}}
KHO_DU = {10: D("100")}


def _mk_hd(don_gia=1000000, sl=100, coc=0, vat=None, tong_tt=None, ncc=1, dong_po_id=10, ten_mua="CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", mst_mua="0108666888"):
    tt = D(sl) * D(don_gia)
    vat_v = (tt * D("0.1")) if vat is None else D(vat)
    t_tt = (tt + vat_v - D(coc)) if tong_tt is None else D(tong_tt)
    hd = {
        "nha_cung_cap_id": ncc,
        "tong_truoc_vat": tt,
        "vat": vat_v,
        "tien_coc_tru": D(coc),
        "tong_thanh_toan": t_tt,
        "ten_nguoi_mua": ten_mua,
        "mst_nguoi_mua": mst_mua,
    }
    dong = [{"dong_po_id": dong_po_id, "so_luong": D(sl), "don_gia": D(don_gia), "thanh_tien": tt}]
    return hd, dong


# ---------------------------------------------------------------------------
# 1. KIỂM THỬ BIÊN DUNG SAI & THUẬT TOÁN 3-WAY MATCHING (6 BƯỚC a -> f)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("don_gia,expected_kq,expected_lech_lon", [
    (1_000_000, "MATCHED", False),    # Đúng tuyệt đối 0%
    (1_019_900, "MATCHED", False),    # Cận biên trong dung sai +1.99% <= 2%
    (1_020_000, "MATCHED", False),    # Đúng biên trên +2.00% <= 2%
    (1_020_100, "MISMATCH", False),   # Vượt biên nhẹ +2.01% (> 2% nhưng < ngưỡng lệch lớn 5% & < 5tr)
    (1_049_900, "MISMATCH", False),   # Cận dưới ngưỡng lệch lớn (+4.99%, lệch 4.99tr < 5tr)
    (1_050_000, "MISMATCH", True),    # Đúng biên ngưỡng lệch lớn (+5.00% và đúng 5.000.000 đ)
    (980_000, "MATCHED", False),      # Biên âm trong dung sai -2.00%
    (979_000, "MISMATCH", False),     # Biên âm vượt dung sai -2.10%
])
def test_bva_bien_dung_sai_don_gia(don_gia, expected_kq, expected_lech_lon):
    hd, dong = _mk_hd(don_gia=don_gia)
    r = doi_soat(hd, dong, PO_HH, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r["ket_qua"] == expected_kq
    assert r["lech_lon"] is expected_lech_lon


def test_buoc_a_khac_nha_cung_cap():
    hd, dong = _mk_hd(ncc=99)
    r = doi_soat(hd, dong, PO_HH, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r["chi_tiet_buoc"] if not b["dat"]] == ["a"]


def test_buoc_b_dong_chua_anh_xa_sku():
    hd, dong = _mk_hd(dong_po_id=None)
    r = doi_soat(hd, dong, PO_HH, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r["ket_qua"] == "MISMATCH"
    assert "b" in [b["ma_buoc"] for b in r["chi_tiet_buoc"] if not b["dat"]]


def test_buoc_c_so_luong_khong_dung_sai_va_partial():
    # Vượt PO
    hd, dong = _mk_hd(sl=101)
    r_vuot_po = doi_soat(hd, dong, PO_HH, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r_vuot_po["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_vuot_po["chi_tiet_buoc"] if not b["dat"]] == ["c"]

    # Vượt số đã nhập kho (PO=100, GRN=50, HD=60)
    hd2, dong2 = _mk_hd(sl=60)
    r_vuot_kho = doi_soat(hd2, dong2, PO_HH, DPO, {10: D("50")}, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r_vuot_kho["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_vuot_kho["chi_tiet_buoc"] if not b["dat"]] == ["c"]

    # Giao một phần hợp lệ (PO=100, GRN=50, HD=50) -> PARTIAL
    hd3, dong3 = _mk_hd(sl=50)
    r_partial = doi_soat(hd3, dong3, PO_HH, DPO, {10: D("50")}, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r_partial["ket_qua"] == "PARTIAL"


def test_buoc_e_tien_coc_va_cong_thuc_tong_tien():
    po_coc = {**PO_HH, "tien_coc": D("20000000")}
    # Trừ đúng cọc 20tr
    hd_ok, dong_ok = _mk_hd(don_gia=1_015_000, sl=100, coc=20_000_000)
    r_ok = doi_soat(hd_ok, dong_ok, po_coc, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r_ok["ket_qua"] == "MATCHED"

    # Trừ cọc 25tr > cọc PO 20tr -> MISMATCH ở bước e
    hd_err, dong_err = _mk_hd(don_gia=1_000_000, sl=100, coc=25_000_000)
    r_err = doi_soat(hd_err, dong_err, po_coc, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r_err["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_err["chi_tiet_buoc"] if not b["dat"]] == ["e"]


def test_buoc_f_chuan_hoa_ten_cong_ty_va_grn():
    assert chuan_hoa_ten_cong_ty("Cty CP Bánh VN") == "CONG TY CO PHAN BANH VIET NAM"
    assert chuan_hoa_mst("0108.666.888") == "0108666888"
    hd, dong = _mk_hd(ten_mua="Cty CP Bánh VN", mst_mua="0108666888")
    r = doi_soat(hd, dong, PO_HH, DPO, KHO_DU, CFG, cong_ty=DEFAULT_COMPANY_INFO)
    assert r["ket_qua"] == "MATCHED"

    # GRN sai công ty -> rớt bước f dù hóa đơn đúng
    r_grn = doi_soat(
        hd, dong, PO_HH, DPO, KHO_DU, CFG,
        cong_ty=DEFAULT_COMPANY_INFO,
        phieu_kho_list=[{"so_phieu": "GRN-99", "ten_don_vi": "CÔNG TY KHÁC", "mst_don_vi": "0309998887"}],
    )
    assert r_grn["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_grn["chi_tiet_buoc"] if not b["dat"]] == ["f"]


# ---------------------------------------------------------------------------
# 2. KIỂM THỬ TRÍCH XUẤT ĐẦY ĐỦ 24 FILE PDF MẪU CHO CÔ KIM ANH XEM
# ---------------------------------------------------------------------------

def test_toan_bo_24_pdf_mau_ton_tai():
    all_pdfs = sorted(PDF_ROOT.glob("0*/*.pdf"))
    assert len(all_pdfs) == 24


def test_parse_3_phieu_nhap_kho_dung():
    d = PDF_ROOT / "01_Phieu_Nhap_Kho_GRN_Dung"
    f1 = d / "GRN_DUNG_01_NhapDu_PO101.pdf"
    r1 = trich_phieu_kho(doc_tai_lieu(f1.read_bytes(), f1.name, cho_phep_ocr=False)["van_ban"])
    assert r1["so_phieu"] == "GRN-2026-101"
    assert r1["so_po"] == "PO-2026-101"
    assert r1["ngay_nhap"] == "2026-10-06"
    assert r1["ten_nguoi_mua"] == "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM"
    assert r1["mst_nguoi_mua"] == "0108666888"
    assert r1["canh_bao"] == []
    assert len(r1["dong"]) == 2
    assert r1["dong"][0]["ma_sku"] == "SKU-BM01" and r1["dong"][0]["so_dat"] == D("200")
    assert r1["dong"][1]["ma_sku"] == "SKU-BO02" and r1["dong"][1]["so_dat"] == D("30")

    f2 = d / "GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf"
    r2 = trich_phieu_kho(doc_tai_lieu(f2.read_bytes(), f2.name, cho_phep_ocr=False)["van_ban"])
    assert r2["so_phieu"] == "GRN-2026-102A"
    assert r2["dong"][0]["so_nhan"] == D("600")
    assert r2["dong"][0]["so_dat"] == D("500")
    assert r2["dong"][0]["so_tu_choi"] == D("100")
    assert "móp méo" in (r2["dong"][0]["ly_do"] or "")

    f3 = d / "GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf"
    r3 = trich_phieu_kho(doc_tai_lieu(f3.read_bytes(), f3.name, cho_phep_ocr=False)["van_ban"])
    assert r3["so_phieu"] == "GRN-2026-102B"
    assert r3["dong"][0]["so_dat"] == D("500")
    assert r3["canh_bao"] == []


def test_parse_4_phieu_nhap_kho_sai():
    d = PDF_ROOT / "02_Phieu_Nhap_Kho_GRN_Sai"
    r1 = trich_phieu_kho(doc_tai_lieu((d / "GRN_SAI_01_SaiCongTyBenMua_MST.pdf").read_bytes(), "g1.pdf", cho_phep_ocr=False)["van_ban"])
    assert doi_chieu_cong_ty(r1["ten_nguoi_mua"], r1["mst_nguoi_mua"], DEFAULT_COMPANY_INFO)["dat"] is False

    r2 = trich_phieu_kho(doc_tai_lieu((d / "GRN_SAI_02_VuotSoLuongDatPO_TriggerChan.pdf").read_bytes(), "g2.pdf", cho_phep_ocr=False)["van_ban"])
    assert r2["dong"][0]["so_dat"] == D("1200")

    r3 = trich_phieu_kho(doc_tai_lieu((d / "GRN_SAI_03_TrungSoPhieu_Va_SaiPO.pdf").read_bytes(), "g3.pdf", cho_phep_ocr=False)["van_ban"])
    assert r3["so_phieu"] == "GRN-001" and r3["so_po"] == "PO-2026-999"

    r4 = trich_phieu_kho(doc_tai_lieu((d / "GRN_SAI_04_LapChoPODichVu_TriggerChan.pdf").read_bytes(), "g4.pdf", cho_phep_ocr=False)["van_ban"])
    assert r4["so_po"] == "PO-2026-104"


@pytest.mark.parametrize("fname,exp_hd,exp_po,exp_tong,exp_coc", [
    ("HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf", "00015801", "PO-2026-101", D("110000000"), D("0")),
    ("HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf", "00015802", "PO-2026-103", D("91650000"), D("20000000")),
    ("HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf", "00024601", "PO-2026-102", D("55000000"), D("0")),
    ("HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf", "00038901", "PO-2026-104", D("54000000"), D("0")),
    ("HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf", "HD-2026-0458", "PO-2026-001", D("110000000"), D("0")),
])
def test_parse_5_hoa_don_dung(fname, exp_hd, exp_po, exp_tong, exp_coc):
    f = PDF_ROOT / "03_Hoa_Don_GTGT_Dung_Doi_Chung" / fname
    meta = doc_tai_lieu(f.read_bytes(), f.name, cho_phep_ocr=False)
    assert meta["loai_file"] == "PDF_DIEN_TU"
    assert nhan_dien_loai_chung_tu(meta["van_ban"]) == "INVOICE"
    r = trich_hoa_don(meta["van_ban"])
    assert r["so_hoa_don"] == exp_hd
    assert r["so_po"] == exp_po
    assert r["tong_thanh_toan"] == exp_tong
    assert r["tien_coc_tru"] == exp_coc
    assert r["canh_bao"] == []
    assert doi_chieu_cong_ty(r["ten_nguoi_mua"], r["mst_nguoi_mua"], DEFAULT_COMPANY_INFO)["dat"] is True


def test_parse_12_hoa_don_sai_va_loi_ky_thuat():
    d = PDF_ROOT / "04_Hoa_Don_GTGT_Sai_Mau_Loi"

    # Nhầm GRN vào hóa đơn
    m8 = doc_tai_lieu((d / "HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf").read_bytes(), "f8.pdf", cho_phep_ocr=False)
    assert nhan_dien_loai_chung_tu(m8["van_ban"]) == "GRN"

    # Thiếu trường bắt buộc
    m9 = doc_tai_lieu((d / "HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf").read_bytes(), "f9.pdf", cho_phep_ocr=False)
    r9 = trich_hoa_don(m9["van_ban"])
    assert len(r9["canh_bao"]) >= 5
    assert r9["dong"] == []

    # File hỏng cấu trúc -> 422
    with pytest.raises(HTTPException) as exc10:
        doc_tai_lieu((d / "HD_SAI_10_FileHongCauTruc_Corrupted.pdf").read_bytes(), "corrupt.pdf", cho_phep_ocr=False)
    assert exc10.value.status_code == 422

    # File giả mạo đuôi .pdf -> 415
    with pytest.raises(HTTPException) as exc11:
        doc_tai_lieu((d / "HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf").read_bytes(), "fake.pdf", cho_phep_ocr=False)
    assert exc11.value.status_code == 415

    # File ảnh scan trắng -> PDF_SCAN, 0 text
    m12 = doc_tai_lieu((d / "HD_SAI_12_AnhScanTrang_KhongCoChu.pdf").read_bytes(), "blank.pdf", cho_phep_ocr=False)
    assert m12["loai_file"] == "PDF_SCAN"
    assert m12["van_ban"].strip() == ""
