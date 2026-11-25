from decimal import Decimal as D
from app.domain.company import (
    DEFAULT_COMPANY_INFO,
    chuan_hoa_ten_cong_ty,
    chuan_hoa_mst,
    doi_chieu_cong_ty,
)
from app.domain.matching import Cau_hinh, doi_soat
from app.infrastructure.pdf_parser import trich_hoa_don, trich_phieu_kho
from app.infrastructure import vlm_extractor


def test_chuan_hoa_ten_va_doi_chieu_cong_ty():
    assert chuan_hoa_ten_cong_ty("CÔNG TY CỔ PHẦN BÁNH VIỆT NAM") == "CONG TY CO PHAN BANH VIET NAM"
    assert chuan_hoa_ten_cong_ty("Cty CP Bánh VN") == "CONG TY CO PHAN BANH VIET NAM"
    assert chuan_hoa_mst("0 1 0 8 6 6 6 8 8 8") == "0108666888"

    r_ok = doi_chieu_cong_ty("CTY CP Bánh Việt Nam", "0 1 0 8 6 6 6 8 8 8", DEFAULT_COMPANY_INFO)
    assert r_ok["trang_thai"] == "KHOP"
    assert r_ok["dat"] is True

    r_en = doi_chieu_cong_ty("Vietnam Bakery Joint Stock Company", "0108666888", DEFAULT_COMPANY_INFO)
    assert r_en["trang_thai"] == "KHOP"
    assert r_en["dat"] is True

    r_sai_mst = doi_chieu_cong_ty("CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "0319999999", DEFAULT_COMPANY_INFO)
    assert r_sai_mst["trang_thai"] == "KHONG_KHOP"
    assert r_sai_mst["dat"] is False
    assert r_sai_mst["mst_khop"] is False

    r_sai_ten = doi_chieu_cong_ty("CÔNG TY TNHH KHÁC", "0108666888", DEFAULT_COMPANY_INFO)
    assert r_sai_ten["trang_thai"] == "KHONG_KHOP"
    assert r_sai_ten["dat"] is False
    assert r_sai_ten["ten_khop"] is False

    r_thieu = doi_chieu_cong_ty(None, None, DEFAULT_COMPANY_INFO)
    assert r_thieu["trang_thai"] == "CHUA_NHAN_DIEN"
    assert r_thieu["dat"] is True


def test_doi_soat_kiem_tra_buoc_f_cong_ty():
    cfg = Cau_hinh(D(2), D(5), D(5_000_000), D(10_000_000))
    po = {"nha_cung_cap_id": 1, "loai_po": "HANG_HOA", "tien_coc": D(0)}
    dpo = {10: {"so_luong_dat": D(10), "don_gia": D(1_000_000)}}
    kho = {10: D(10)}
    dong_hd = [{"dong_po_id": 10, "so_luong": D(10), "don_gia": D(1_000_000), "thanh_tien": D(10_000_000)}]
    hd_base = {
        "nha_cung_cap_id": 1,
        "tong_truoc_vat": D(10_000_000),
        "vat": D(1_000_000),
        "tien_coc_tru": D(0),
        "tong_thanh_toan": D(11_000_000),
    }

    r_khop = doi_soat(
        {**hd_base, "ten_nguoi_mua": "Cty CP Bánh VN", "mst_nguoi_mua": "0108666888"},
        dong_hd, po, dpo, kho, cfg, cong_ty=DEFAULT_COMPANY_INFO,
    )
    assert r_khop["ket_qua"] == "MATCHED"
    buoc_f = [b for b in r_khop["chi_tiet_buoc"] if b["ma_buoc"] == "f"][0]
    assert buoc_f["dat"] is True

    r_thieu_ten = doi_soat(
        {**hd_base, "ten_nguoi_mua": None, "mst_nguoi_mua": None},
        dong_hd, po, dpo, kho, cfg, cong_ty=DEFAULT_COMPANY_INFO,
    )
    assert r_thieu_ten["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_thieu_ten["chi_tiet_buoc"] if not b["dat"]] == ["f"]

    r_lech = doi_soat(
        {**hd_base, "ten_nguoi_mua": "Công ty Cổ phần Bánh Việt Nam", "mst_nguoi_mua": "0300000001"},
        dong_hd, po, dpo, kho, cfg, cong_ty=DEFAULT_COMPANY_INFO,
    )
    assert r_lech["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_lech["chi_tiet_buoc"] if not b["dat"]] == ["f"]

    # Khi người dùng đổi tên công ty trong Hồ sơ Thông tin công ty -> đối soát tự động so theo tên mới
    cty_doi_ten = {**DEFAULT_COMPANY_INFO, "ten_cong_ty": "CÔNG TY CỔ PHẦN BÁNH MÌ VIỆT NAM", "ten_viet_tat": None}
    r_ten_cu_fail = doi_soat(
        {**hd_base, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888"},
        dong_hd, po, dpo, kho, cfg, cong_ty=cty_doi_ten,
    )
    assert r_ten_cu_fail["ket_qua"] == "MISMATCH"
    r_ten_moi_ok = doi_soat(
        {**hd_base, "ten_nguoi_mua": "Cty CP Bánh Mì VN", "mst_nguoi_mua": "0108666888"},
        dong_hd, po, dpo, kho, cfg, cong_ty=cty_doi_ten,
    )
    assert r_ten_moi_ok["ket_qua"] == "MATCHED"

    # Nếu Phiếu nhập kho liên kết PO có tên đơn vị khác công ty mình -> bước f báo MISMATCH
    r_grn_lech = doi_soat(
        {**hd_base, "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM", "mst_nguoi_mua": "0108666888"},
        dong_hd, po, dpo, kho, cfg, cong_ty=DEFAULT_COMPANY_INFO,
        phieu_kho_list=[{"so_phieu": "GRN-999", "ten_don_vi": "CÔNG TY TNHH KHÁC", "mst_don_vi": "0300000999"}],
    )
    assert r_grn_lech["ket_qua"] == "MISMATCH"
    assert [b["ma_buoc"] for b in r_grn_lech["chi_tiet_buoc"] if not b["dat"]] == ["f"]


def test_trich_ben_mua_hoa_don_va_phieu_kho_va_vlm():
    hd_txt = """HÓA ĐƠN GIÁ TRỊ GIA TĂNG
    Số hóa đơn: 00008899
    Ngày 20 tháng 11 năm 2026
    Đơn vị bán: CÔNG TY TNHH NGUYÊN LIỆU BỘT MÌ
    Mã số thuế: 0312345678
    Họ tên người mua hàng: Nguyễn Thị Lan
    Tên đơn vị: CÔNG TY CỔ PHẦN BÁNH VIỆT NAM
    Mã số thuế: 0 1 0 8 6 6 6 8 8 8
    Địa chỉ: A41, KDC Kim Sơn, Phường Tân Hưng, TP. Hồ Chí Minh
    STT Tên hàng hóa ĐVT SL Đơn giá Thành tiền
    1 Bột mì cao cấp Kg 10 100.000 1.000.000
    Tổng cộng tiền thanh toán: 1.000.000
    """
    r_hd = trich_hoa_don(hd_txt)
    assert r_hd["mst"] == "0312345678"
    assert r_hd["ten_nguoi_mua"] == "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM"
    assert r_hd["mst_nguoi_mua"] == "0108666888"

    grn_txt = """CÔNG TY CỔ PHẦN BÁNH VIỆT NAM
    MST: 0108666888
    PHIẾU NHẬP KHO
    Số phiếu: GRN-2026-01
    Số PO: PO-2026-01
    Ngày nhập: 20/11/2026
    SKU-01 Bột mì 10 10 0
    """
    r_grn = trich_phieu_kho(grn_txt)
    assert r_grn["ten_nguoi_mua"] == "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM"
    assert r_grn["mst_nguoi_mua"] == "0108666888"

    r_vlm = vlm_extractor.chuan_hoa_ket_qua_hoa_don_vlm({
        "so_hoa_don": "00008899",
        "ngay_lap": "2026-11-20",
        "ten_ncc": "CÔNG TY TNHH NGUYÊN LIỆU BỘT MÌ",
        "mst": "0312345678",
        "ten_nguoi_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM",
        "mst_nguoi_mua": "0108666888",
        "so_po": "PO-2026-01",
        "vat": 0,
        "tong_thanh_toan": 1000000,
        "dong": [{"ten_san_pham": "Bột mì", "so_luong": 10, "don_gia": 100000, "thanh_tien": 1000000}],
    })
    assert r_vlm["ten_nguoi_mua"] == "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM"
    assert r_vlm["mst_nguoi_mua"] == "0108666888"
    assert doi_chieu_cong_ty(r_vlm["ten_nguoi_mua"], r_vlm["mst_nguoi_mua"], DEFAULT_COMPANY_INFO)["dat"] is True
