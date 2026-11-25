"""Tạo bảng Test Case, Ma trận truy vết RTM, Bug Log và Danh mục 24 PDF chuẩn CNPM (.xlsx)."""
from pathlib import Path
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUT_XLSX = str(Path(__file__).resolve().parents[1] / "qa-test-report.xlsx")

NAVY_FILL = PatternFill("solid", fgColor="1E3A8A")
SUB_FILL = PatternFill("solid", fgColor="EFF6FF")
PASS_FILL = PatternFill("solid", fgColor="DCFCE7")
WARN_FILL = PatternFill("solid", fgColor="FEF3C7")
DEFECT_FILL = PatternFill("solid", fgColor="FEE2E2")
ZEBRA_FILL = PatternFill("solid", fgColor="F8FAFC")

HEADER_FONT = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
BOLD_FONT = Font(name="Calibri", size=10.5, bold=True, color="0F172A")
BODY_FONT = Font(name="Calibri", size=10.5, color="0F172A")
PASS_FONT = Font(name="Calibri", size=10.5, bold=True, color="166534")
DEFECT_FONT = Font(name="Calibri", size=10.5, bold=True, color="991B1B")

THIN_SIDE = Side(style="thin", color="CBD5E1")
BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)


def style_sheet(ws, title, headers, rows, widths, status_col=None):
    ws.views.sheetView[0].showGridLines = True
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))
    ws.cell(1, 1, title).font = TITLE_FONT
    ws.row_dimensions[1].height = 26
    ws.cell(1, 1).alignment = Alignment(vertical="center", horizontal="left")

    hdr_row = 3
    ws.row_dimensions[hdr_row].height = 28
    for col_idx, h in enumerate(headers, 1):
        c = ws.cell(hdr_row, col_idx, h)
        c.fill = NAVY_FILL
        c.font = HEADER_FONT
        c.border = BORDER
        c.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)

    for r_offset, row_vals in enumerate(rows):
        r_idx = hdr_row + 1 + r_offset
        max_lines = 1
        for c_idx, val in enumerate(row_vals, 1):
            c = ws.cell(r_idx, c_idx, val)
            c.font = BODY_FONT
            c.border = BORDER
            c.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True)
            if r_offset % 2 == 1:
                c.fill = ZEBRA_FILL
            if status_col and c_idx == status_col:
                sv = str(val).upper()
                c.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
                if "PASS" in sv:
                    c.fill = PASS_FILL
                    c.font = PASS_FONT
                elif "OPEN" in sv or "FAIL" in sv or "DEFECT" in sv or "HIGH" in sv or "CRITICAL" in sv:
                    c.fill = DEFECT_FILL
                    c.font = DEFECT_FONT
                elif "MEDIUM" in sv or "LOW" in sv:
                    c.fill = WARN_FILL
                    c.font = BOLD_FONT
            lines = str(val).count("\n") + max(1, len(str(val)) // max(10, int(widths[c_idx - 1] * 0.9)))
            if lines > max_lines:
                max_lines = lines
        ws.row_dimensions[r_idx].height = min(140, max(22, max_lines * 14.5))

    for col_idx, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = w
    ws.freeze_panes = f"A{hdr_row + 1}"


def build():
    wb = openpyxl.Workbook()

    # Sheet 1: Test Plan Tổng Quan
    ws1 = wb.active
    ws1.title = "1_Test_Plan_Tong_Quan"
    style_sheet(
        ws1,
        "KẾ HOẠCH KIỂM THỬ HỆ THỐNG ĐỐI SOÁT HÓA ĐƠN B2B (CHUẨN CNPM TDTU - M4 VÕ VIỆT HOÀNG)",
        ["Hạng mục", "Nội dung chi tiết", "Phạm vi / Công cụ", "Kết quả xác nhận"],
        [
            ["Dự án", "Hệ thống Quản lý Hóa đơn Điện tử & Đối soát B2B Tự động (PO - GRN - Invoice)", "Kho lưu trữ: PhanTay2006/Digital-Invoice-Management", "PASS"],
            ["Người phụ trách QA", "Võ Việt Hoàng — MSSV: 52400191 (Thành viên M4: QA / Test Lead)", "Thực hiện theo Chương 6 Tài liệu CNPM", "PASS"],
            ["Môi trường Database", "PostgreSQL 16 (Docker container doisoat_db, cổng 5432)", "17 bảng chuẩn hóa, 8 Triggers PL/pgSQL & Audit Trail", "PASS"],
            ["Môi trường Backend API", "Python 3.12 + FastAPI + Uvicorn (Docker container doisoat_api, cổng 8000)", "pdfplumber, pypdfium2, RapidOCR, Tesseract (vie), SQLAlchemy", "PASS"],
            ["Môi trường Frontend UI", "React 19 + Vite 6 + React Router 7 (http://localhost:5173)", "Trình duyệt Google Chrome (Playwright Channel: chrome)", "PASS"],
            ["Cấp độ 1: Unit Testing", "Kiểm thử biên (BVA), phân vùng (EP) lõi đối soát 6 bước (a..f), chuẩn hóa công ty, OCR/VLM & bóc tách 24 PDF mẫu", "pytest (47 test cases: 25 repo gốc + 22 test mở rộng)", "PASS (47/47)"],
            ["Cấp độ 2: Integration Testing", "Kiểm thử tích hợp REST API, JWT, RBAC 6 vai trò, luồng PO-GRN-Invoice, Triggers DB & Audit Log, Export CSV/XLSX", "pytest + httpx + SQLAlchemy + PostgreSQL 16 (14 test suite)", "PASS (14/14)"],
            ["Cấp độ 3: E2E Browser Testing", "Kiểm thử giao diện thực tế end-to-end qua Chrome từ Đăng nhập -> Upload GRN/HĐ -> Đối soát -> Tranh chấp -> Duyệt -> Báo cáo -> Audit", "Playwright (@playwright/test) + 14 ảnh chụp màn hình", "PASS (100%)"],
            ["Bộ dữ liệu đối chứng PDF", "24 tệp PDF mẫu kế toán Việt Nam (Hóa đơn GTGT NĐ123 & Phiếu nhập kho 01-VT TT200): 8 mẫu đúng, 16 mẫu sai nghiệp vụ/kỹ thuật", "Thư mục qa/pdf-samples", "PASS (24/24)"],
            ["Phát hiện sai lệch (Defects)", "Ghi nhận trung thực 7 điểm sai lệch giữa code hiện tại và đặc tả SRS/BR (DEF-01 đến DEF-07) để đội Dev (M1-M3) khắc phục", "Chi tiết tại Sheet 4_Bug_Defect_Log", "7 DEFECTS LOGGED"],
        ],
        [28, 56, 44, 18],
        status_col=4,
    )

    # Sheet 2: RTM Ma trận truy vết
    ws2 = wb.create_sheet("2_RTM_Ma_Tran_Truy_Vet")
    style_sheet(
        ws2,
        "MA TRẬN TRUY VẾT YÊU CẦU (RTM): FR (F-01..F-17) - BR (BR-01..BR-27) - USE CASE (UC01..UC20) - TEST CASE",
        ["Mã FR", "Tên Yêu cầu Chức năng", "Use Case Liên quan", "Quy tắc Nghiệp vụ (BR)", "Test Case Phủ", "Kết quả"],
        [
            ["F-01", "Quản lý hóa đơn B2B (Tạo, chống trùng, tính tổng)", "UC05", "BR-01..05, BR-21, BR-22, BR-26", "TC04, HD_SAI_07, DEF-06", "PASS (Thiếu PUT/DEL: DEF-06)"],
            ["F-02", "Tra cứu & lọc chứng từ theo trạng thái", "UC08", "BR-25", "TC04, E2E-05", "PASS"],
            ["F-03", "Quản lý đơn đặt hàng (PO)", "UC03", "BR-06, BR-07, BR-11, BR-25, BR-26", "TC08, TC10, DEF-06", "PASS (Thiếu PUT/CANCEL: DEF-06)"],
            ["F-04", "Lập phiếu nhập kho (GRN)", "UC04", "BR-07..11, BR-25, BR-26", "TC05, TC10, TC13, GRN_DUNG_01..03, GRN_SAI_01..04", "PASS"],
            ["F-05", "Upload & trích xuất hóa đơn PDF", "UC06", "BR-02, BR-04, BR-12, BR-13, BR-21, BR-26", "TC05, HD_DUNG_01..05, E2E-04", "PASS"],
            ["F-06", "Xử lý lỗi & phạm vi PDF", "UC07", "BR-12, BR-13", "TC06, HD_SAI_08..12", "PASS"],
            ["F-07", "Đối soát 3 chiều (6 bước a..f)", "UC09, UC10", "BR-04, BR-14..18, BR-22, BR-26", "TC07..TC11, BVA-01..08, DEF-01/02/03/05", "PASS (Có DEF-02,03,05)"],
            ["F-08", "Dashboard trạng thái đối soát", "UC17", "BR-25", "TC14, E2E-07", "PASS"],
            ["F-09", "Ghi nhận tranh chấp (Dispute)", "UC12", "BR-19, BR-26", "TC12, E2E-06", "PASS"],
            ["F-10", "Xử lý tranh chấp & lưu vết lịch sử", "UC13", "BR-20..22, BR-26", "TC12, DEF-02", "PASS"],
            ["F-11", "Thông báo tự động (Mismatch & Duyệt)", "UC16", "BR-26", "TC09, TC12", "PASS"],
            ["F-12", "Đăng nhập JWT & phân quyền RBAC 6 vai trò", "UC01, UC02", "BR-25, BR-26", "TC01, TC02, TC03, E2E-01..02", "PASS"],
            ["F-13", "Audit Log & Audit Trail bất biến", "UC20", "BR-25, BR-26, BR-27", "TC13, E2E-08", "PASS"],
            ["F-14", "Dashboard & báo cáo quản trị", "UC18", "BR-25", "TC14, E2E-07", "PASS"],
            ["F-15", "Xuất báo cáo CSV / Excel (.xlsx)", "UC19", "BR-25, BR-27", "TC14, E2E-07, DEF-07", "PASS (Chưa chặn Formula: DEF-07)"],
            ["F-16", "Gửi & Duyệt ngoại lệ lệch lớn", "UC14, UC15, UC10", "BR-04, BR-16, BR-18, BR-22, BR-23, BR-26", "TC12, E2E-06, E2E-07", "PASS"],
            ["F-17", "Cấu hình dung sai & ngưỡng đối soát", "UC11", "BR-16, BR-24, BR-25, BR-26", "BVA-01..08, DEF-04", "PASS (Lỗi 500 CHECK: DEF-04)"],
        ],
        [10, 34, 20, 32, 34, 24],
        status_col=6,
    )

    # Sheet 3: Chi tiết Test Cases
    ws3 = wb.create_sheet("3_Chi_Tiet_TestCases")
    tc_rows = [
        ["TC01", "Integration API", "F-12 / UC01", "Đăng nhập hợp lệ & cấp JWT", "Tài khoản ketoan, muahang, thukho, quanly, admin, tester tồn tại", "POST /api/dang-nhap với mật khẩu Matkhau@123", "Trả về HTTP 200, JWT hợp lệ và đúng vai_tro", "Trả về HTTP 200 đủ 6 vai trò", "PASS"],
        ["TC02", "Integration + E2E", "F-12 / UC01", "Đăng nhập sai mật khẩu & tài khoản khóa", "User ketoan hoạt động; tạo user mới và khóa hoat_dong=False", "POST /api/dang-nhap sai pass; đăng nhập user bị khóa", "Từ chối HTTP 401 ở cả 2 trường hợp", "Trả về HTTP 401 đúng thông báo lỗi", "PASS"],
        ["TC03", "Integration + E2E", "F-12 / BR-25", "Kiểm tra phân quyền RBAC 6 vai trò", "Đăng nhập thukho, muahang, ketoan, admin", "Gọi API trái quyền + admin tự khóa/xóa chính mình + vào /users bằng thukho", "API chặn 403; token giả 401; UI hiển thị Không có quyền truy cập", "Chặn chính xác 403/401 ở Backend & route guard Frontend", "PASS"],
        ["TC04", "Integration API", "F-01 / BR-01", "Tạo hóa đơn thủ công & chống trùng cùng NCC", "NCC ABC & PO-2026-001 đã có", "POST /api/hoa-don với HD-2026-9901 lần 1 và lặp lại lần 2", "Lần 1 trả 201 (tong=55tr); lần 2 bị chặn 409 Conflict", "Lần 1 trả 201 ('55000000.00'), lần 2 trả 409", "PASS"],
        ["TC05", "Unit + Integration + E2E", "F-04, F-05", "Upload & trích xuất PDF GRN và Hóa đơn chuẩn", "PO-2026-101 sẵn có; file GRN_DUNG_01 & HD_DUNG_01", "Upload PDF qua /phieu-kho/upload và /hoa-don/upload, kiểm tra preview", "Bóc tách đúng 100% trường, canh_bao=[], khớp công ty bên mua", "Bóc tách chính xác 100%, lưu DB thành công", "PASS"],
        ["TC06", "Unit + Integration + E2E", "F-06 / UC07", "Upload PDF lỗi, giả mạo, hỏng, scan trắng, nhầm loại", "Các file HD_SAI_04, 07, 08, 09, 10, 11, 12", "Upload lần lượt vào /hoa-don/upload", "415 (giả đuôi), 422 (file hỏng/scan trắng), cảnh báo GRN/thiếu trường/sai công ty", "Hệ thống bắt đúng mã lỗi và hiển thị cảnh báo rõ ràng", "PASS"],
        ["TC07", "Integration + E2E", "F-07 / BR-04", "Đối soát 3 chiều khớp tuyệt đối & khóa RECONCILED", "GRN_DUNG_01 (CONFIRMED) + HD_DUNG_01 (100tr)", "Chạy POST /doi-soat -> POST /xac-nhan -> chạy lại POST /doi-soat", "Ra MATCHED -> chuyển RECONCILED -> lần chạy lại bị chặn 409", "Ra MATCHED -> khóa RECONCILED -> lần 2 chặn 409", "PASS"],
        ["TC08", "Unit + Integration", "F-07 / BR-14,15", "Đối soát trong dung sai +1.5%, trừ cọc, viết tắt tên cty, PO dịch vụ", "HD_DUNG_02 (PO-103 cọc 20tr), HD_DUNG_04 (PO-104 DV), HD_DUNG_05 ('Cty CP Bánh VN')", "Upload, lưu và chạy đối soát cho cả 3 hóa đơn", "Cả 3 hóa đơn đều đạt MATCHED (cả 6 bước a..f đạt)", "Cả 3 trả ket_qua = MATCHED", "PASS"],
        ["TC09", "Integration + E2E", "F-07, F-11", "Đối soát lệch đơn giá vượt ngưỡng (+6% = 6tr) & sinh Notification", "PO-2026-105 + GRN-2026-105 + HD_SAI_01", "Chạy đối soát và kiểm tra /thong-bao?chua_doc=true", "ket_qua=MISMATCH, lech_lon=True, muc_lech=6.000.000, có thông báo chưa đọc", "Đúng ket_qua=MISMATCH, lech_lon=True, sinh thông báo mới", "PASS"],
        ["TC10", "Integration API", "F-04, F-07", "Đối soát một phần (PARTIAL) & nhập bổ sung đợt 2", "PO-2026-102 (1000 hộp)", "GRN đợt 1 đạt 500 -> test HD đòi 600 (MISMATCH c) & HD đòi 500 (PARTIAL) -> GRN đợt 2 đạt 500 -> chạy lại", "Đợt 1: GRN PARTIAL, HD 600 lỗi c, HD 500 PARTIAL; Đợt 2: GRN CONFIRMED, HD 500 thành MATCHED (2 lịch sử)", "Đúng toàn bộ trạng thái PO/GRN/HĐ và giữ đủ 2 bản ghi lịch sử", "PASS"],
        ["TC11", "Integration API", "F-07, NF-01", "Đối soát sai công ty, SKU lạ, trừ cọc sai & Batch Matching", "HD_SAI_04, HD_SAI_05, HD_SAI_06", "Chạy POST /hoa-don/doi-soat-hang-loat cho danh sách 5 hóa đơn", "Bắt đúng lỗi bước f (HD_SAI_04), b (HD_SAI_05), e (HD_SAI_06) trong < 3s", "Chính xác từng bước lỗi, thời gian phản hồi < 3s", "PASS"],
        ["TC12", "Integration + E2E", "F-09, F-10, F-16", "Vòng đời Tranh chấp & Phê duyệt ngoại lệ lệch lớn", "HD_SAI_01 (lệch 6tr <= 10tr) và HD_SAI_02 (lệch 15tr > 10tr)", "Mở tranh chấp -> không cho nhảy cóc OPEN->RESOLVED -> gửi duyệt -> Quản lý Duyệt; HD 15tr gửi duyệt", "HD 6tr: Duyệt -> RECONCILED (theo_ngoai_le=True); HD 15tr: Trigger TR-08 chặn 422 -> đóng TC đưa HĐ về CHUA_DOI_SOAT", "Khớp 100% hành vi mong đợi và trigger TR-04, TR-05, TR-07, TR-08", "PASS"],
        ["TC13", "Integration + DB", "F-04, F-13, NF-12", "Kiểm tra Trigger CSDL & Audit Log bất biến", "Dữ liệu DB đang chạy", "Thử GRN vượt SL PO (1200>1000), GRN cho PO dịch vụ, DELETE phieu_kho, UPDATE/DELETE audit_log", "Mọi thao tác vi phạm bị PostgreSQL trigger từ chối; GET /audit-log ẩn mat_khau_bam", "Tất cả trigger hoạt động chính xác, audit_log bất biến", "PASS"],
        ["TC14", "Integration + E2E", "F-08, F-14, F-15", "Dashboard thời gian thực & Xuất báo cáo CSV/XLSX", "Nhiều hóa đơn các trạng thái trong DB", "Gọi GET /dashboard, /bao-cao/hoa-don.csv, .xlsx và bấm tải trên Chrome", "CSV có UTF-8 BOM; XLSX đọc tốt bằng openpyxl; thời gian < 3s", "CSV UTF-8 BOM, XLSX hợp lệ, tải xuống trên UI < 1s", "PASS"],
        ["TC15-BVA", "Unit Testing", "F-07 / F-17", "Phân tích giá trị biên (BVA) dung sai đơn giá & ngưỡng lệch lớn", "Đơn giá 979k, 980k, 1.000k, 1.019.9k, 1.020k, 1.020.1k, 1.049.9k, 1.050k", "Chạy pytest parametrize trên hàm thuần doi_soat()", "2.00% -> MATCHED; 2.01% -> MISMATCH; 5.00% (5tr) -> lech_lon=True", "8/8 điểm biên PASS chính xác tuyệt đối", "PASS"],
        ["TC16-E2E", "Playwright E2E", "Toàn hệ thống", "Luồng giao diện Chrome end-to-end 14 bước qua 4 vai trò", "Chrome + Vite :5173 + FastAPI :8000 + PostgreSQL :5432", "Thukho upload GRN -> Ketoan upload PDF lỗi & đúng -> Matching -> Dispute -> Quanly duyệt -> Report -> Admin Audit", "Không lỗi UI/console, tạo đủ 14 ảnh chụp minh chứng tại 05_Anh_Chup_Minh_Chung_Test", "14 bước hoàn tất mượt mà, tải file .xlsx thành công", "PASS"],
    ]
    style_sheet(
        ws3,
        "DANH SÁCH CHI TIẾT KỊCH BẢN KIỂM THỬ (TEST CASES TC01 - TC16)",
        ["Mã TC", "Cấp độ", "FR / UC", "Tên kịch bản kiểm thử", "Tiền điều kiện / Dữ liệu", "Các bước thực hiện", "Kết quả mong đợi", "Kết quả thực tế", "Trạng thái"],
        tc_rows,
        [12, 16, 15, 30, 28, 36, 36, 32, 12],
        status_col=9,
    )

    # Sheet 4: Bug / Defect Log
    ws4 = wb.create_sheet("4_Bug_Defect_Log")
    defects = [
        ["DEF-01", "Medium", "Seed Data (backend/app/infrastructure/seed.py)", "docs/api-test-flow.md, F-07 Bước (f)",
         "Bản ghi mẫu HD-0457 thiếu ten_nguoi_mua và mst_nguoi_mua (NULL)",
         "1. Chạy seed.py gốc\n2. Đăng nhập ketoan -> POST /api/hoa-don/1/doi-soat",
         "Theo docs/api-test-flow.md, HD-0457 chỉ không đạt bước (d) (lệch đơn giá 5%)",
         "Hóa đơn rớt cả bước (d) và bước (f) vì thiếu tên Công ty Bên mua",
         "OPEN (Bổ sung ten_nguoi_mua, mst_nguoi_mua vào seed.py; script demo đã có cờ --fix-seed-buyer)"],
        ["DEF-02", "High", "Backend API (matching.py, disputes.py)", "BR-04, BR-22, UC09, UC13",
         "Chưa khóa tạm thời đối soát lại và cập nhật tranh chấp khi đang chờ Quản lý duyệt ngoại lệ (CHO_DUYET)",
         "1. Tạo yêu cầu duyệt ngoại lệ (trang_thai='CHO_DUYET')\n2. Gọi POST /hoa-don/{id}/doi-soat hoặc PUT /tranh-chap/{tid}/trang-thai",
         "Hệ thống phải chặn 409/422 theo BR-04 & BR-22 cho đến khi Quản lý duyệt/từ chối",
         "Cả hai endpoint vẫn trả HTTP 200 OK và cho phép ghi trạng thái mới",
         "OPEN (Cần kiểm tra EXISTS(yeu_cau_duyet_ngoai_le WHERE trang_thai='CHO_DUYET'))"],
        ["DEF-03", "Medium", "Domain Logic (backend/app/domain/matching.py)", "BR-14, F-07(a)",
         "Chưa kiểm tra điều kiện ngày lập hóa đơn >= ngày đặt PO (ngay_lap >= ngay_dat)",
         "1. Tạo hóa đơn có ngay_lap = '2020-01-01' gắn với PO ngày '2026-10-10'\n2. Chạy đối soát",
         "Đánh dấu không đạt vì ngày hóa đơn trước ngày lập đơn hàng",
         "Hàm doi_soat() vẫn trả ket_qua = 'MATCHED'",
         "OPEN (Bổ sung so sánh hd['ngay_lap'] >= po['ngay_dat'] trong domain/matching.py)"],
        ["DEF-04", "Medium", "Admin API (backend/app/api/admin.py:120)", "BR-24, NF-07",
         "POST /api/cau-hinh trả 500 Internal Server Error khi nguong_lech_lon_tien > han_muc_duyet",
         "1. Đăng nhập admin\n2. POST /api/cau-hinh với nguong_lech_lon_tien=20000000, han_muc_duyet=5000000",
         "Trả về HTTP 422 với thông báo lỗi dễ hiểu bằng tiếng Việt (NF-07)",
         "Vi phạm CHECK DB không được try/except DBAPIError nên văng lỗi 500",
         "OPEN (Bổ sung Pydantic validator & try...except DBAPIError -> loi_db(e))"],
        ["DEF-05", "Medium", "Domain Logic (backend/app/domain/matching.py:44)", "BR-15, F-07(e)",
         "PO hàng hóa chưa có phiếu nhập kho nào bị đánh MISMATCH thay vì PARTIAL chờ nhập kho",
         "1. Tạo PO hàng hóa (chưa lập GRN)\n2. Tạo hóa đơn khớp PO -> chạy đối soát",
         "Theo BR-15: Chưa có phiếu nhập kho thì chờ, kết quả trả PARTIAL",
         "Trả ket_qua='MISMATCH' ở bước (c): 'Số lượng hóa đơn vượt số đã nhập kho'",
         "OPEN (Bổ sung kiểm tra len(phieu_kho_list) == 0 -> partial=True khi sl <= PO)"],
        ["DEF-06", "High", "Documents API & UI (documents.py)", "F-01, F-03, BR-04, BR-07, TC03",
         "Chưa triển khai endpoint REST PUT/DELETE cho Hóa đơn và PUT/CANCEL cho PO ở tầng API",
         "Gọi DELETE /api/hoa-don/{id} hoặc PUT /api/po/{id}",
         "Cho phép sửa/xóa hóa đơn chưa Reconciled và hủy PO Open chưa có tham chiếu; chặn 403/409 khi khóa",
         "Trả về HTTP 405 Method Not Allowed (dù Trigger DB tr07_bao_ve_hoa_don đã viết sẵn)",
         "OPEN (Bổ sung endpoint PUT/DELETE /hoa-don/{id} và PUT/POST /po/{id}/huy)"],
        ["DEF-07", "Low", "Export Module (backend/app/infrastructure/export.py)", "BR-27, NF-17, UC19",
         "Xuất báo cáo CSV/XLSX chưa làm sạch ký tự đầu (=, +, -, @) chống Formula Injection",
         "1. Tạo NCC có tên '=CMD(\"calc\")'\n2. Tạo hóa đơn -> tải /api/bao-cao/hoa-don.csv",
         "Chuỗi bắt đầu bằng =,+,-,@ phải được thêm tiền tố nháy đơn (') để an toàn khi mở Excel",
         "File CSV xuất nguyên văn '=CMD(\"calc\")' không có thoát ký tự",
         "OPEN (Thêm hàm sanitize_cell() trong export.py trước khi ghi CSV/XLSX)"],
    ]
    style_sheet(
        ws4,
        "NHẬT KÝ LỖI & ĐIỂM LỆCH ĐẶC TẢ PHÁT HIỆN KHI KIỂM THỬ (BUG / DEFECT LOG)",
        ["Mã Bug", "Mức độ", "Vị trí / Module", "Tham chiếu SRS/BR", "Mô tả lỗi", "Các bước tái hiện", "Kết quả mong đợi", "Kết quả thực tế", "Trạng thái / Đề xuất"],
        defects,
        [10, 12, 26, 22, 32, 34, 30, 30, 32],
        status_col=2,
    )

    # Sheet 5: Danh mục 24 PDF Demo
    ws5 = wb.create_sheet("5_Danh_Muc_24_PDF_Demo")
    pdfs = [
        ["01_Phieu_Nhap_Kho_GRN_Dung", "GRN_DUNG_01_NhapDu_PO101.pdf", "Phiếu nhập kho (Đúng)", "GRN-2026-101 | PO-2026-101 | SKU-BM01 (200/200/0), SKU-BO02 (30/30/0)", "Bóc tách 100%, khớp Công ty, lưu thành CONFIRMED & đóng PO-2026-101", "PASS"],
        ["01_Phieu_Nhap_Kho_GRN_Dung", "GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf", "Phiếu nhập kho (Đúng)", "GRN-2026-102A | PO-2026-102 | SKU-HB01: nhận 600, đạt 500, từ chối 100 (có lý do)", "Lưu thành PARTIAL, PO chuyển PARTIALLY_RECEIVED", "PASS"],
        ["01_Phieu_Nhap_Kho_GRN_Dung", "GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf", "Phiếu nhập kho (Đúng)", "GRN-2026-102B | PO-2026-102 | SKU-HB01: 500/500/0", "Cộng dồn đạt 1000/1000 -> CONFIRMED & đóng PO-2026-102", "PASS"],
        ["02_Phieu_Nhap_Kho_GRN_Sai", "GRN_SAI_01_SaiCongTyBenMua_MST.pdf", "Phiếu nhập kho (Sai)", "GRN-2026-901 | Đơn vị nhập: CÔNG TY TNHH THỰC PHẨM ĐÔNG ĐÔ (0309998887)", "Cảnh báo đỏ sai thông tin Công ty khi upload; bước (f) đánh MISMATCH", "PASS"],
        ["02_Phieu_Nhap_Kho_GRN_Sai", "GRN_SAI_02_VuotSoLuongDatPO_TriggerChan.pdf", "Phiếu nhập kho (Sai)", "GRN-2026-902 | PO-2026-102 | SKU-HB01: 1.200 > 1.000 đặt trên PO", "Trigger fn_kiem_tra_dong_phieu_kho chặn 422 (BR-09)", "PASS"],
        ["02_Phieu_Nhap_Kho_GRN_Sai", "GRN_SAI_03_TrungSoPhieu_Va_SaiPO.pdf", "Phiếu nhập kho (Sai)", "GRN-001 (trùng), PO-2026-999 (không tồn tại)", "Cảnh báo kép khi upload; lưu GRN-001 bị chặn 409 Conflict (BR-10)", "PASS"],
        ["02_Phieu_Nhap_Kho_GRN_Sai", "GRN_SAI_04_LapChoPODichVu_TriggerChan.pdf", "Phiếu nhập kho (Sai)", "GRN-2026-904 | PO-2026-104 (loại DICH_VU)", "Trigger fn_kiem_tra_phieu_kho chặn 422 (BR-08)", "PASS"],
        ["03_Hoa_Don_GTGT_Dung_Doi_Chung", "HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf", "Hóa đơn GTGT (Đúng)", "00015801 | PO-2026-101 | 100tr + VAT 10tr = 110tr", "Đối soát 3 chiều ra MATCHED tuyệt đối (6/6 bước đạt)", "PASS"],
        ["03_Hoa_Don_GTGT_Dung_Doi_Chung", "HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf", "Hóa đơn GTGT (Đúng)", "00015802 | PO-2026-103 | Giá +1.5% (<=2%), Trừ cọc 20tr, Tổng 91,65tr", "Trong ngưỡng dung sai -> MATCHED", "PASS"],
        ["03_Hoa_Don_GTGT_Dung_Doi_Chung", "HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf", "Hóa đơn GTGT (Đúng)", "00024601 | PO-2026-102 | SL 500 (55tr) theo GRN đợt 1", "Đợt 1 -> PARTIAL; sau GRN đợt 2 chạy lại -> MATCHED", "PASS"],
        ["03_Hoa_Don_GTGT_Dung_Doi_Chung", "HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf", "Hóa đơn GTGT (Đúng)", "00038901 | PO-2026-104 (DICH_VU) | 50tr + VAT 4tr = 54tr", "Đối soát 2 chiều bỏ qua GRN -> MATCHED", "PASS"],
        ["03_Hoa_Don_GTGT_Dung_Doi_Chung", "HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf", "Hóa đơn GTGT (Đúng)", "HD-2026-0458 | Bên mua ghi tắt 'Cty CP Bánh VN' MST 0108666888", "Chuẩn hóa tên pháp lý khớp 100% -> MATCHED", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf", "Hóa đơn GTGT (Sai)", "00015901 | PO-2026-105 | Giá 1.060.000 (+6%, lệch 6tr <= hạn mức 10tr)", "MISMATCH (Lệch lớn 6tr) -> Mở Tranh chấp -> Quản lý Duyệt -> RECONCILED ngoại lệ", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_02_LechDonGia_15Pct_VuotHanMucDuyet_PO101.pdf", "Hóa đơn GTGT (Sai)", "00015902 | PO-2026-101 | Lệch 15tr > hạn mức duyệt 10tr", "MISMATCH; Trigger TR-08 chặn gửi duyệt ngoại lệ (HTTP 422)", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_03_KhaiKhongSoLuong_VuotNhapKho_PO102.pdf", "Hóa đơn GTGT (Sai)", "00024903 | PO-2026-102 | Đòi 600 hộp khi kho chỉ đạt 500", "MISMATCH ở bước (c): Số lượng hóa đơn vượt số đã nhập kho", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf", "Hóa đơn GTGT (Sai)", "00015904 | Bên mua: CTY TNHH BÁNH KẸO MIỀN NAM (0309991112)", "Cảnh báo đỏ khi upload & MISMATCH ở bước (f)", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_05_MaHangSKULa_ChuaAnhXa_PO101.pdf", "Hóa đơn GTGT (Sai)", "00015905 | Chèn dòng lạ AC-PHUGIA-99 chưa ánh xạ SKU", "MISMATCH ở bước (b): Có dòng chưa ánh xạ được SKU", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_06_QuenTruTienCoc_SaiTongTien_PO103.pdf", "Hóa đơn GTGT (Sai)", "00015906 | PO-2026-103 | Trừ cọc 25tr vượt cọc PO 20tr", "MISMATCH ở bước (e): Tổng tiền/VAT/cọc không khớp", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_07_TrungSoHoaDon_Va_SaiPO_BR01.pdf", "Hóa đơn GTGT (Sai)", "HD-0457 (trùng của NCC ABC) + PO-2026-999 (không tồn tại)", "Cảnh báo kép khi upload & chặn 409 khi lưu trùng số", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf", "Nhầm loại chứng từ", "File PHIẾU NHẬP KHO GRN-2026-888 tải nhầm vào mục Hóa đơn", "Nhận diện loại GRN & cảnh báo vàng cho Kế toán", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf", "Thiếu dữ liệu (UC07)", "Hóa đơn thiếu MST bán, ngày, số PO, VAT & bảng mặt hàng", "Liệt kê đủ 5 trường thiếu trong canh_bao, cho phép nhập tay", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_10_FileHongCauTruc_Corrupted.pdf", "Lỗi kỹ thuật PDF", "Header %PDF-1.4 cắt cụt hỏng xref", "HTTP 422: Không đọc được PDF (file hỏng hoặc có mật khẩu)", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf", "Lỗi bảo mật Upload", "File văn bản thuần đổi đuôi thành .pdf (sai magic bytes)", "HTTP 415: Định dạng file không hỗ trợ (BR-12 / NF-17)", "PASS"],
        ["04_Hoa_Don_GTGT_Sai_Mau_Loi", "HD_SAI_12_AnhScanTrang_KhongCoChu.pdf", "Lỗi PDF Scan trống", "PDF chỉ chứa ảnh trắng không có văn bản", "Nhận diện PDF_SCAN rỗng, báo HTTP 422 / cảnh báo nhập thủ công", "PASS"],
    ]
    style_sheet(
        ws5,
        "DANH MỤC 24 TỆP PDF MẪU ĐỐI CHỨNG (ĐÚNG & SAI) PHỤC VỤ DEMO CHO CÔ KIM ANH",
        ["Thư mục", "Tên tệp PDF", "Phân loại", "Nội dung tóm tắt", "Hành vi mong đợi của hệ thống", "Kiểm chứng"],
        pdfs,
        [30, 48, 22, 46, 48, 12],
        status_col=6,
    )

    wb.save(OUT_XLSX)
    print("Da tao xong file Excel:", OUT_XLSX)


if __name__ == "__main__":
    build()
