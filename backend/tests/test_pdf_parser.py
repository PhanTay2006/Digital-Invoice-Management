from decimal import Decimal as D
from app.infrastructure.pdf_parser import (
    trich_hoa_don,
    trich_phieu_kho,
    trich_po,
    nhan_dien_loai_chung_tu,
    _sap_xep_ket_qua_ocr_theo_dong,
    _lam_sach_anh_hoa_don,
    so,
    ngay,
)

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


def test_nhan_dien_loai_chung_tu_va_ocr_line_grouping():
    assert nhan_dien_loai_chung_tu(HD) == "INVOICE"
    assert nhan_dien_loai_chung_tu(PK) == "GRN"
    # Giả lập kết quả bounding box của PaddleOCR trên 1 dòng bảng hàng hóa
    ocr_mock = [
        [[[10, 100], [60, 100], [60, 120], [10, 120]], ("ABC-01", 0.99)],
        [[[150, 102], [190, 102], [190, 120], [150, 120]], ("100", 0.98)],
        [[[220, 101], [300, 101], [300, 120], [220, 120]], ("1.050.000", 0.99)],
        [[[320, 100], [420, 100], [420, 120], [320, 120]], ("105.000.000", 0.99)],
    ]
    line = _sap_xep_ket_qua_ocr_theo_dong(ocr_mock)
    assert line == "ABC-01 100 1.050.000 105.000.000"


HD_BAN_HANG = """HÓA ĐƠN BÁN HÀNG
Mẫu số - Ký hiệu: 2C26TYY
Số: 00002118
Ngày 28 tháng 08 năm 2026
Mã của Cơ quan thuế: 000B0B39978EE64C7F8349D4A83245702E
Đơn vị bán: CÔNG TY TNHH ĐÀO TẠO THIÊN ƯNG
Mã số thuế: 0 1 1 1 2 1 4 0 2 1
Người mua: Bùi Ngọc Thiên
Mã số thuế: 0 1 0 6 9 0 8 1 5 8
STT Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền
1 2 3 4 5 6 = 4 x 5
1 Khóa học quyết toán thuế TNDN Khóa 1 500.000 500.000
2 Khóa học kế toán tổng hợp trọn gói Khóa 1 3.200.000 3.200.000
3 Khóa học cách sử dụng phần mềm HTKK Khóa 1 50.000 50.000
Tổng cộng tiền thanh toán: 3.750.000
"""


def test_hoa_don_ban_hang_thuc_te():
    r = trich_hoa_don(HD_BAN_HANG)
    assert r["so_hoa_don"] == "00002118"
    assert r["ngay_lap"] == "2026-08-28"
    assert r["ma_cqt"] == "000B0B39978EE64C7F8349D4A83245702E"
    assert r["ten_ncc"] == "CÔNG TY TNHH ĐÀO TẠO THIÊN ƯNG"
    assert r["mst"] == "0111214021"
    assert r["vat"] == D(0)
    assert r["tong_thanh_toan"] == D(3750000)
    assert len(r["dong"]) == 3
    assert r["dong"][0]["ten_san_pham"] == "Khóa học quyết toán thuế TNDN"
    assert r["dong"][0]["so_luong"] == D(1) and r["dong"][0]["don_gia"] == D(500000)
    assert r["dong"][1]["don_gia"] == D(3200000)
    assert r["dong"][2]["thanh_tien"] == D(50000)


HD_MISA_SONG_NGU = """HÓA ĐƠN GIÁ TRỊ GIA TĂNG
Ngày (Date) 17 tháng (Month) 07 năm (Year) 2026
Mẫu số: 1   Ký hiệu: K26TYR   Số (No.): 00000010
CÔNG TY CP MISA
Mã số thuế (Tax code): 0101243150-999
Địa chỉ: Tầng 9, Hà Nội
Người mua (Buyer): Công ty TNHH Khách Hàng
Mã số thuế: 0109999999
STT Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền Thuế suất
1 Phần mềm kế toán MISA Gói 1 500.000 500.000 10%
Tiền thuế GTGT (VAT amount): 50.000
Tổng cộng tiền thanh toán: 550.000
"""

HD_KHONG_DAU = """HOA DON GIA TRI GIA TANG
So hoa don: 00005555
Ngay lap: 2026-09-12
Don vi tinh: VND
Don vi: Cong ty Sao Viet
Ma so thue: 0319876543
Ten san pham DVT So luong Don gia Thanh tien
May in laser HP Cai 2 3.000.000 6.000.000
Cong tien hang: 6.000.000
Tong cong: 6.600.000
"""


def test_hoa_don_da_dang_cong_ty():
    r1 = trich_hoa_don(HD_MISA_SONG_NGU)
    assert r1["so_hoa_don"] == "00000010"
    assert r1["ten_ncc"] == "CÔNG TY CP MISA"
    assert r1["mst"] == "0101243150-999"
    assert r1["ngay_lap"] == "2026-07-17"
    assert r1["vat"] == D(50000)
    assert r1["tong_thanh_toan"] == D(550000)
    assert len(r1["dong"]) == 1
    assert r1["dong"][0]["ten_san_pham"] == "Phần mềm kế toán MISA"
    assert r1["dong"][0]["so_luong"] == D(1) and r1["dong"][0]["don_gia"] == D(500000)

    r2 = trich_hoa_don(HD_KHONG_DAU)
    assert r2["so_hoa_don"] == "00005555"
    assert r2["ngay_lap"] == "2026-09-12"
    assert r2["ten_ncc"] == "Cong ty Sao Viet"
    assert r2["mst"] == "0319876543"
    assert r2["vat"] == D(600000)
    assert r2["tong_thanh_toan"] == D(6600000)
    assert len(r2["dong"]) == 1
    assert r2["dong"][0]["ten_san_pham"] == "May in laser HP"
    assert r2["dong"][0]["so_luong"] == D(2) and r2["dong"][0]["thanh_tien"] == D(6000000)


def test_ocr_grouping_va_lam_sach_anh():
    from PIL import Image

    # 1. Box chữ cao 60px (tỉ lệ ảnh ~200-300 DPI) lệch y_top 20px nhưng vẫn cùng một dòng
    boxes_cqt = [
        [[[100, 100], [500, 100], [500, 160], [100, 160]], ("Mã của Cơ quan thuế:", 0.95)],
        [[[520, 120], [1100, 120], [1100, 180], [520, 180]], ("000B0B39978EE64C7F8349D4A83245702E", 0.98)],
    ]
    line_cqt = _sap_xep_ket_qua_ocr_theo_dong(boxes_cqt)
    assert line_cqt == "Mã của Cơ quan thuế: 000B0B39978EE64C7F8349D4A83245702E"

    # 2. Tẩy watermark đỏ và giữ chữ xanh đậm trên ảnh RGB 1400x200
    img = Image.new("RGB", (1400, 200), (255, 255, 255))
    for x in range(100, 140):
        for y in range(50, 90):
            img.putpixel((x, y), (20, 20, 80))   # Chữ xanh đậm
            img.putpixel((x + 200, y), (200, 30, 40))  # Watermark đỏ
    cleaned = _lam_sach_anh_hoa_don(img)
    assert cleaned.size == (1400, 200)
    assert max(cleaned.getpixel((120, 70))) < 120  # Chữ xanh đậm được giữ lại
    assert cleaned.getpixel((320, 70)) == (255, 255, 255)  # Watermark đỏ bị tẩy trắng

    # Ảnh nhỏ được phóng mượt lên chiều rộng 1800px
    small = Image.new("RGB", (700, 500), (255, 255, 255))
    assert _lam_sach_anh_hoa_don(small).size[0] == 1800

    # 3. Đọc đúng số tiền tổng khi có ký tự viền bảng '|'
    r_pipe = trich_hoa_don("HÓA ĐƠN BÁN HÀNG\nSố: 00002118\nTổng cộng tiền thanh toán: | 3.750.000\n")
    assert r_pipe["tong_thanh_toan"] == D(3750000) and r_pipe["vat"] == D(0)


def test_mst_chi_lay_duoi_ten_ncc_khong_lay_nguoi_mua():
    # Trường hợp 1: có nhiễu 10 số ở trên + MST đúng dưới tên Đơn vị bán + MST người mua bên dưới
    hd_hai_mst = """HÓA ĐƠN BÁN HÀNG
    Mã chứng từ nội bộ: 9999999999
    Đơn vị bán: CÔNG TY TNHH A
    Mã số thuế: 0111214021
    Địa chỉ: Hà Nội
    Người mua: Công ty Khách Hàng
    Mã số thuế: 0106908158
    """
    assert trich_hoa_don(hd_hai_mst)["mst"] == "0111214021"

    # Trường hợp 2: thiếu MST đơn vị bán, chỉ có MST dưới Người mua -> tuyệt đối không lấy nhầm
    hd_chi_mst_mua = """HÓA ĐƠN BÁN HÀNG
    Đơn vị bán: CÔNG TY TNHH A
    Địa chỉ: Hà Nội
    Người mua: Công ty Khách Hàng
    Mã số thuế: 0106908158
    """
    assert trich_hoa_don(hd_chi_mst_mua)["mst"] is None

