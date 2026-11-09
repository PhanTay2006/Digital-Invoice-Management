from decimal import Decimal as D
from app.infrastructure.pdf_parser import trich_hoa_don, trich_phieu_kho, so, ngay

HD = """HÓA ĐƠN GTGT
Số hóa đơn: HD-0457
Ngày lập: 10/10/2026
Mã số thuế: 0312345678
Số PO: PO-2026-001
STT Mã hàng Mô tả Số lượng Đơn giá Thành tiền
ABC-01 Thiết bị 5G 100 1.050.000 105.000.000
Cộng tiền hàng 105.000.000
Thuế GTGT: 10.500.000
Trừ cọc: 0
"""
PK = """PHIẾU NHẬP KHO
Số phiếu: GRN-001
Số PO: PO-2026-001
Ngày nhập: 05/10/2026
SKU-01 Thiết bị 100 98 2 Vỡ khi vận chuyển
"""

def test_so_va_ngay():
    assert so("1.050.000") == D(1050000) and so("1.050.000,50") == D("1050000.50") and ngay("5/10/2026") == "2026-10-05"

def test_hoa_don():
    r = trich_hoa_don(HD)
    assert r["so_hoa_don"] == "HD-0457" and r["mst"] == "0312345678" and r["ngay_lap"] == "2026-10-10" and r["vat"] == D(10500000)
    assert r["dong"] == [{"ma_sku_ncc": "ABC-01", "so_luong": D(100), "don_gia": D(1050000), "thanh_tien": D(105000000)}] and r["canh_bao"] == []

def test_phieu_kho():
    r = trich_phieu_kho(PK)
    assert r["so_phieu"] == "GRN-001" and r["ngay_nhap"] == "2026-10-05"
    assert r["dong"][0]["so_dat"] == D(98) and r["dong"][0]["ly_do"] == "Vỡ khi vận chuyển"

def test_thieu_truong_co_canh_bao():
    assert len(trich_hoa_don("Số hóa đơn: X-1")["canh_bao"]) >= 4
