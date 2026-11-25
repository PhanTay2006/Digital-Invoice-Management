# Kịch bản Trình diễn (Demo) & Đối chứng Bộ Mẫu Đúng / Sai

**Môn học:** Công nghệ Phần mềm (ĐH Tôn Đức Thắng)  
**Đề tài:** Hệ thống Quản lý Hóa đơn Điện tử & Đối soát 3 Chiều Tự động (`PO – GRN – Invoice`)  
**Thành viên trình bày kiểm thử:** Phạm Văn Giàu (MSSV `52400184` — QA / Test Lead)  
**Bộ dữ liệu đối chứng:** `qa/pdf-samples/` (**24 tệp PDF** chia thành 4 nhóm đúng/sai)

---

## Phần 1: Chuẩn bị & Khởi động hệ thống trước khi trình bày

### 1.1. Khởi động Backend + Database + Frontend
Mở terminal tại thư mục gốc dự án `Digital-Invoice-Management`:
```bash
docker compose up -d --build
npm install
npm run dev
```
Sau đó mở trình duyệt truy cập:
- **Giao diện Web (Frontend):** `http://localhost:5173`
- **Tài liệu API (Swagger UI):** `http://localhost:8000/docs`

### 1.2. Đặt lại dữ liệu Demo sạch trước khi thuyết trình
Mỗi khi cần reset dữ liệu giao dịch về trạng thái chuẩn trước buổi demo:
```bash
# Chạy qua container Backend (khuyến nghị)
docker compose exec api python /srv/qa/scripts/seed_demo_data.py --reset --fix-seed-buyer

# Hoặc chạy trực tiếp bằng Python trên máy
python3 qa/scripts/seed_demo_data.py --reset --fix-seed-buyer
```

### 1.3. Bảng 6 Tài khoản Demo (Mật khẩu chung: `Matkhau@123`)
| Tài khoản | Vai trò (`vai_tro`) | Màn hình dùng để demo |
| :--- | :--- | :--- |
| `thukho` | Thủ kho (`THU_KHO`) | Vào **Phiếu nhập kho (GRN)** để tải lên các mẫu phiếu kho Đúng/Sai |
| `ketoan` | Kế toán AP (`KE_TOAN_AP`) | Vào **Hóa đơn**, **Đối soát 3 chiều**, **Tranh chấp & Ngoại lệ**, **Báo cáo** |
| `quanly` | Quản lý / KTT (`QUAN_LY`) | Vào **Tranh chấp & Ngoại lệ** để Duyệt/Từ chối lệch lớn, xem **Tổng quan** |
| `muahang` | Mua hàng (`MUA_HANG`) | Vào **Đơn đặt hàng (PO)** xem danh sách `PO-2026-101..105` & **Nhà cung cấp** |
| `admin` | Quản trị (`QUAN_TRI`) | Vào **Quản trị & Phân quyền** xem **Audit Log bất biến**, **Thông tin công ty** |
| `tester` | Toàn quyền (`TOAN_QUYEN`) | Demo xuyên suốt toàn bộ quy trình mà không cần chuyển đổi tài khoản |

### 1.4. Dữ liệu nền đã nạp sẵn trong DB (`PO-2026-101` đến `PO-2026-105`)
- **Đơn vị mua hàng (`/company`):** `CÔNG TY CỔ PHẦN BÁNH VIỆT NAM` — MST: **`0108666888`**
- **Cấu hình dung sai mặc định:** Dung sai đơn giá **`2%`**, Ngưỡng lệch lớn **`5%`** hoặc **`5.000.000 ₫`**, Hạn mức duyệt **`10.000.000 ₫`**.
- **5 Đơn đặt hàng (PO) độc lập cho từng kịch bản:**
  1. `PO-2026-101` (NCC Á Châu, Hàng hóa): 200 Bao Bột mì (`350.000 ₫`) + 30 Hộp Bơ lạt (`1.000.000 ₫`) = `100.000.000 ₫` *(chưa có GRN)*.
  2. `PO-2026-102` (NCC Nam Việt, Hàng hóa): 1.000 Cái Hộp giấy (`100.000 ₫`) = `100.000.000 ₫` *(chưa có GRN)*.
  3. `PO-2026-103` (NCC Á Châu, Hàng hóa, **có đặt cọc `20.000.000 ₫`**): 100 Hộp Bơ lạt (`1.000.000 ₫`) — *đã có sẵn `GRN-2026-103` đủ 100*.
  4. `PO-2026-104` (NCC Đông Dương, **Dịch vụ `DICH_VU`**): 1 Gói Bảo trì lò nướng (`50.000.000 ₫`) — *không cần GRN*.
  5. `PO-2026-105` (NCC Á Châu, Hàng hóa): 100 Hộp Bơ lạt (`1.000.000 ₫`) — *đã có sẵn `GRN-2026-105` đủ 100*.

---

## Phần 2: 6 Kịch bản Demo đối chứng Đúng vs. Sai (~7 phút)

### Kịch bản 1: Kiểm tra Phân quyền RBAC & Nhập kho (GRN Đúng vs GRN Sai)
1. Tại màn hình Đăng nhập, thử nhập sai mật khẩu → Hệ thống từ chối (`401 Unauthorized`).
2. Đăng nhập **`thukho`** (`Matkhau@123`):
   - **Thử truy cập trái phép (RBAC):** Truy cập `http://localhost:5173/users` → Hệ thống chặn ngay và báo *"Không có quyền truy cập"*.
3. Quay lại **Phiếu nhập kho (GRN)** → Bấm **`⇪ Tải Phiếu kho lên`**:
   - **Mẫu SAI 1 (`qa/pdf-samples/02-grn-invalid/GRN_SAI_01_SaiCongTyBenMua_MST.pdf`):** Đọc ra `CÔNG TY TNHH THỰC PHẨM ĐÔNG ĐÔ (MST: 0309998887)` và gắn nhãn đỏ **`✕ Sai thông tin công ty`** ngay khi xem trước.
   - **Mẫu SAI 2 (`qa/pdf-samples/02-grn-invalid/GRN_SAI_02_VuotSoLuongDatPO_TriggerChan.pdf`):** Số lượng `1.200` vượt quá `1.000` đặt trên `PO-2026-102` → Trigger `BR-09` trong PostgreSQL từ chối (`422`).
   - **Mẫu SAI 3 (`qa/pdf-samples/02-grn-invalid/GRN_SAI_04_LapChoPODichVu_TriggerChan.pdf`):** Lập cho PO dịch vụ (`PO-2026-104`) → Trigger `BR-08` chặn không cho lập phiếu kho.
   - **Mẫu ĐÚNG (`qa/pdf-samples/01-grn-valid/GRN_DUNG_01_NhapDu_PO101.pdf`):** Đọc chính xác `GRN-2026-101`, `PO-2026-101`, khớp hồ sơ công ty, 2 loại sản phẩm (`SKU-BM01: 200`, `SKU-BO02: 30`) → Lưu thành công với trạng thái **`Đủ hàng`**.

### Kịch bản 2: Upload Hóa đơn — Bắt lỗi File giả mạo, Nhầm loại chứng từ & Sai Công ty
Đăng nhập **`ketoan`** → vào **Hóa đơn** → bấm **`⇪ Tải Hóa đơn lên`**:
1. **`qa/pdf-samples/04-invoice-invalid/HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf`** *(file văn bản đổi đuôi `.pdf`)* → Báo lỗi đỏ chặn ngay (`415`).
2. **`qa/pdf-samples/04-invoice-invalid/HD_SAI_10_FileHongCauTruc_Corrupted.pdf`** → Báo lỗi an toàn (`422: Không đọc được PDF`).
3. **`qa/pdf-samples/04-invoice-invalid/HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf`** → Cảnh báo vàng nhận diện nhầm loại chứng từ `GRN`.
4. **`qa/pdf-samples/04-invoice-invalid/HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf`** → Liệt kê các trường thiếu để Kế toán chuyển sang nhập thủ công.
5. **`qa/pdf-samples/04-invoice-invalid/HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf`** → Gắn nhãn đỏ **`✕ Sai đơn vị mua hàng`** vì MST bên mua khác `0108666888`.

### Kịch bản 3: Đối chứng các Hóa đơn ĐÚNG (Khớp tuyệt đối, Trong dung sai + Trừ cọc, PO Dịch vụ, Tên viết tắt)
Vẫn ở tài khoản `ketoan`:
1. Tải & lưu **`qa/pdf-samples/03-invoice-valid/HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf`** (`00015801`, `110.000.000 ₫`).
2. Tải & lưu **`qa/pdf-samples/03-invoice-valid/HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf`** (`00015802`, đơn giá tăng `+1,5% ≤ 2%` và trừ đúng tiền cọc `20.000.000 ₫`).
3. Tải & lưu **`qa/pdf-samples/03-invoice-valid/HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf`** (`00038901`, `PO-2026-104` dịch vụ đối soát 2 chiều).
4. Tải & lưu **`qa/pdf-samples/03-invoice-valid/HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf`** (`HD-2026-0458`, hóa đơn ghi tắt `"Cty CP Bánh VN"` vẫn khớp chuẩn hóa).
5. Sang **Đối soát 3 chiều** → Bấm **`⇄ Chạy đối soát`** trên 4 hóa đơn trên → Tất cả đạt **`Khớp (MATCHED)`** 6/6 bước! Bấm **`✓ Hoàn tất đối soát`** cho `00015801` → Chuyển sang **`Đã đối soát (RECONCILED)`** và khóa cứng.

### Kịch bản 4: Giao hàng & Nhập kho nhiều đợt (`PARTIAL` → `MISMATCH` khai khống → `MATCHED`)
1. Bằng `thukho`: Upload & lưu **`qa/pdf-samples/01-grn-valid/GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf`** (nhận 600, **đạt 500**, từ chối 100) → Trạng thái **`Nhập một phần (PARTIAL)`**.
2. Bằng `ketoan`:
   - Upload & lưu **`qa/pdf-samples/04-invoice-invalid/HD_SAI_03_KhaiKhongSoLuong_VuotNhapKho_PO102.pdf`** (đòi 600 hộp) → Đối soát báo **`Lệch (MISMATCH)`** ở bước `(c)`.
   - Upload & lưu **`qa/pdf-samples/03-invoice-valid/HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf`** (đòi đúng 500 hộp đạt) → Đối soát ra **`Khớp một phần (PARTIAL)`**.
3. Bằng `thukho`: Upload & lưu **`qa/pdf-samples/01-grn-valid/GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf`** (nhập nốt 500 đạt) → `PO-2026-102` đóng (`CLOSED`).
4. Bằng `ketoan`: Chạy lại đối soát trên `00024601` → Tự động chuyển sang **`Khớp (MATCHED)`** và lưu 2 lần đối soát độc lập trong lịch sử.

### Kịch bản 5: Xử lý Sai lệch Lớn, Tranh chấp & Duyệt Ngoại lệ giữa Kế toán ↔ Quản lý
1. Bằng `ketoan`: Upload & lưu **`qa/pdf-samples/04-invoice-invalid/HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf`** (`00015901`, đơn giá tăng `+6%` → lệch `6.000.000 ₫`).
2. Sang **Đối soát 3 chiều** → Bấm **`⇄ Chạy đối soát`** → Hệ thống báo **`Lệch`** kèm cảnh báo **`⚠️ Đánh dấu LỆCH LỚN — Tổng tiền lệch: 6.000.000 ₫`**.
3. Sang **Tranh chấp & Ngoại lệ**: Mở hồ sơ tranh chấp (`OPEN`) và bấm **`Gửi duyệt ngoại lệ`** *(nếu dùng mẫu `HD_SAI_02` lệch `15.000.000 ₫` > hạn mức `10.000.000 ₫`, Trigger `TR-08` sẽ chặn `422`)*.
4. Đăng nhập **`quanly`** → Vào **Tranh chấp & Ngoại lệ** → Nhập ghi chú phê duyệt bắt buộc → Bấm **`✓ Duyệt`** → Hóa đơn chuyển sang **`Đã đối soát (Ngoại lệ)` (`RECONCILED`)**, tranh chấp chuyển sang **`Đã xử lý (RESOLVED)`**.

### Kịch bản 6: Tổng quan Dashboard, Xuất Báo cáo Excel & Audit Trail Bất biến
1. Bằng `quanly`: Mở **Tổng quan** xem biểu đồ tức thời; mở **Báo cáo & Thống kê** → Bấm **`↓ Xuất file Excel (.xlsx)`**.
2. Bằng `admin`: Mở **Quản trị & Phân quyền** → Xem **Audit Log** ghi nhận đầy đủ `INSERT / UPDATE / UPLOAD`, ẩn `mat_khau_bam`, và được bảo vệ bởi Trigger `tr_bao_ve_audit_log`.

---

## Phần 3: Gợi ý Trả lời Vấn đáp cho Vai trò Tester (M4)
1. **Hỏi: Nhóm kiểm thử ở những mức độ nào?**  
   *Trả lời:* Đủ 3 cấp độ chuẩn CNPM (Chương 6): (1) **Unit Test** bằng `pytest` (`backend/tests/test_01..test_05`) kiểm tra giá trị biên dung sai `2,00% / 2,01%`, chuẩn hóa tên công ty và trích xuất 24 file PDF; (2) **Integration Test** (`backend/tests/test_06_api_integration.py`) kiểm tra API + JWT/RBAC + 8 Trigger PL/pgSQL trong PostgreSQL 16; (3) **E2E Test** (`e2e/reconciliation-workflow.spec.js`) tự động hóa trình duyệt bằng Playwright qua 14 bước liên hoàn của 4 vai trò.
2. **Hỏi: Vì sao trong bảng hàng hóa của PDF mẫu không ghi thêm các từ khóa như "phiếu nhập kho" vào hóa đơn?**  
   *Trả lời:* Khi kiểm thử hộp trắng (`pdf_parser.py`), nhóm phát hiện hàm `nhan_dien_loai_chung_tu` ưu tiên kiểm tra cụm từ khóa GRN trước Hóa đơn, đồng thời `trich_hoa_don` & `trich_phieu_kho` phân dòng theo tọa độ Y của `pdfplumber`. Từ đó nhóm thiết kế chuẩn 24 mẫu chứng từ trong `qa/pdf-samples/` vừa đúng quy chuẩn kế toán (NĐ 123 & TT 200), vừa kiểm chứng chính xác ranh giới parser của hệ thống (bao gồm cả file `HD_SAI_08` cố tình nạp GRN vào mục Hóa đơn để chứng minh hệ thống cảnh báo đúng).
3. **Hỏi: Trong quá trình test em phát hiện những lỗi (Defect) thực tế nào của hệ thống?**  
   *Trả lời:* Nhóm ghi nhận trung thực **7 điểm sai lệch (`DEF-01` đến `DEF-07`)** trong báo cáo kiểm thử và Sheet `4_Bug_Defect_Log` (được kiểm chứng tự động tại `test_defects_01_to_07_tai_hien_thuc_nghiem` trong `test_06_api_integration.py`), tiêu biểu như: dữ liệu gốc `HD-0457` khi chưa bật cờ `--fix-seed-buyer` thiếu tên/MST bên mua (`DEF-01`), chưa khóa tạm thời đối soát lại khi đang chờ Quản lý duyệt ngoại lệ `CHO_DUYET` (`DEF-02`), chưa kiểm tra điều kiện `ngay_lap >= ngay_dat` (`DEF-03`), `POST /cau-hinh` trả 500 khi vi phạm CHECK hạn mức (`DEF-04`), PO chưa có GRN trả `MISMATCH` thay vì `PARTIAL` (`DEF-05`), thiếu endpoint `PUT/DELETE` cho hóa đơn/PO (`DEF-06`), và `export.py` chưa escape ký tự đầu chống Formula Injection (`DEF-07`).
