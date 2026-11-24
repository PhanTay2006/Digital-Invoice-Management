# KỊCH BẢN TRÌNH DIỄN & ĐỐI CHỨNG MẪU ĐÚNG / SAI CHO CÔ KIM ANH XEM

**Môn:** Công nghệ Phần mềm (ĐH Tôn Đức Thắng)  
**Đề tài:** Hệ thống Quản lý Hóa đơn Điện tử & Đối soát 3 Chiều Tự động (`PO – GRN – Invoice`)  
**Thành viên trình bày kiểm thử:** Phạm Văn Giàu ( MSSV `52400184` — QA / Test Lead)  
**Bộ dữ liệu đối chứng:** `f:\University\source\cnpm\Bo_Mau_Chung_Tu_Demo_Co_Kim_Anh\` (**24 tệp PDF**)

---

## PHẦN 1: CHUẨN BỊ & KHỞI ĐỘNG HỆ THỐNG TRƯỚC KHI TRÌNH BÀY

### 1.1. Bật nhanh Backend + Database + Frontend (nếu chưa chạy)
Mở terminal PowerShell tại `f:\University\source\cnpm\Digital-Invoice-Management`:
```powershell
docker compose up -d
npm run dev
```
Sau đó mở trình duyệt Chrome truy cập:
- **Giao diện Web (Frontend):** `http://localhost:5173`
- **Tài liệu API (Swagger UI):** `http://localhost:8000/docs`

### 1.2. Lệnh 1 giây đưa Database về trạng thái sạch đẹp chuẩn bị Demo
Mỗi lần muốn demo lại từ đầu trước Cô (hoặc sau khi test nháp), chạy lệnh sau:
```powershell
& "C:\Users\LAZYORC\.gemini\antigravity\brain\684136d3-19e2-4499-a3bd-2bec7e67fe04\scratch\qa_venv\Scripts\python.exe" "f:\University\source\cnpm\Bo_Mau_Chung_Tu_Demo_Co_Kim_Anh\scripts\seed_demo_co_kim_anh.py" --reset --fix-seed-buyer
```

### 1.3. Bảng 6 Tài khoản Demo (Mật khẩu chung: `Matkhau@123`)
| Tài khoản | Vai trò (`vai_tro`) | Màn hình dùng để demo |
| :--- | :--- | :--- |
| `thukho` | Thủ kho (`THU_KHO`) | Vào **Phiếu nhập kho (GRN)** để tải lên các mẫu phiếu kho Đúng/Sai |
| `ketoan` | Kế toán AP (`KE_TOAN_AP`) | Vào **Hóa đơn B2B**, **Đối soát 3 chiều**, **Tranh chấp & Ngoại lệ**, **Báo cáo** |
| `quanly` | Quản lý / KTT (`QUAN_LY`) | Vào **Tranh chấp & Ngoại lệ** để Duyệt/Từ chối lệch lớn, xem **Tổng quan** |
| `muahang` | Mua hàng (`MUA_HANG`) | Vào **Đơn đặt hàng (PO)** xem danh sách `PO-2026-101..105` & **Nhà cung cấp** |
| `admin` | Quản trị (`QUAN_TRI`) | Vào **Quản trị & Phân quyền** xem **Audit Log bất biến**, **Thông tin công ty** |
| `tester` | Toàn quyền (`TOAN_QUYEN`) | Nếu muốn demo liên tục 1 mạch không cần đăng xuất qua lại |

### 1.4. Dữ liệu nền đã nạp sẵn trong DB (`PO-2026-101` đến `PO-2026-105`)
- **Công ty Bên mua (chuẩn pháp lý `/company`):** `CÔNG TY CỔ PHẦN BÁNH VIỆT NAM` — MST: **`0108666888`**
- **Cấu hình dung sai mặc định:** Dung sai đơn giá **`2%`**, Ngưỡng lệch lớn **`5%`** hoặc **`5.000.000 ₫`**, Hạn mức duyệt **`10.000.000 ₫`**.
- **5 Đơn đặt hàng (PO) độc lập cho từng kịch bản:**
  1. `PO-2026-101` (NCC Á Châu, Hàng hóa): 200 Bao Bột mì (`350.000đ`) + 30 Hộp Bơ lạt (`1.000.000đ`) = `100.000.000đ` *(chưa có GRN)*.
  2. `PO-2026-102` (NCC Nam Việt, Hàng hóa): 1.000 Cái Hộp giấy (`100.000đ`) = `100.000.000đ` *(chưa có GRN)*.
  3. `PO-2026-103` (NCC Á Châu, Hàng hóa, **có đặt cọc `20.000.000đ`**): 100 Hộp Bơ lạt (`1.000.000đ`) — *đã có sẵn `GRN-2026-103` đủ 100*.
  4. `PO-2026-104` (NCC Đông Dương, **Dịch vụ `DICH_VU`**): 1 Gói Bảo trì lò nướng (`50.000.000đ`) — *không cần GRN*.
  5. `PO-2026-105` (NCC Á Châu, Hàng hóa): 100 Hộp Bơ lạt (`1.000.000đ`) — *đã có sẵn `GRN-2026-105` đủ 100*.

---

## PHẦN 2: 6 KỊCH BẢN DEMO ĐỐI CHỨNG ĐÚNG VS SAI CHO CÔ KIM ANH XEM (KHOẢNG 7 PHÚT)

### Kịch bản 1: Kiểm tra Phân quyền RBAC & Nhập kho (GRN Đúng vs GRN Sai) — ~1,5 phút
1. Tại màn hình Đăng nhập, thử gõ mật khẩu sai → Hệ thống từ chối (`401 Unauthorized`).
2. Đăng nhập **`thukho`** (`Matkhau@123`):
   - **Thử truy cập trái phép (RBAC):** Trên thanh địa chỉ gõ `http://localhost:5173/users` → Hệ thống chặn ngay lập tức và hiện thông báo *"Không có quyền truy cập"*.
3. Quay lại **Phiếu nhập kho (GRN)** → Bấm **`⇪ Tải Phiếu kho lên`**:
   - **Mẫu SAI 1 (`02_Phieu_Nhap_Kho_GRN_Sai/GRN_SAI_01_SaiCongTyBenMua_MST.pdf`):** Cho Cô thấy cột phải tự đọc ra `CÔNG TY TNHH THỰC PHẨM ĐÔNG ĐÔ (MST: 0309998887)` và gắn thẻ đỏ **`✕ Sai thông tin công ty`** ngay khi xem trước!
   - **Mẫu SAI 2 (`02_Phieu_Nhap_Kho_GRN_Sai/GRN_SAI_02_VuotSoLuongDatPO_TriggerChan.pdf`):** Đọc ra `1.200` vượt quá `1.000` đặt trên `PO-2026-102` → bấm **`Kiểm tra & Lưu Phiếu kho →`** và bấm **`Xác nhận & Lưu Phiếu nhập kho vào DB`** → Trigger `BR-09` trong PostgreSQL từ chối (`422`).
   - **Mẫu SAI 3 (`02_Phieu_Nhap_Kho_GRN_Sai/GRN_SAI_04_LapChoPODichVu_TriggerChan.pdf`):** Nếu thử chọn/lập cho PO dịch vụ (`PO-2026-104`) → Trigger `BR-08` chặn không cho lập phiếu kho (`PO dịch vụ không lập phiếu nhập kho`).
   - **Mẫu ĐÚNG (`01_Phieu_Nhap_Kho_GRN_Dung/GRN_DUNG_01_NhapDu_PO101.pdf`):** Đọc chính xác `GRN-2026-101`, `PO-2026-101`, **`✓ Khớp hồ sơ công ty`**, 2 dòng hàng (`SKU-BM01: 200`, `SKU-BO02: 30`) → Lưu thành công với trạng thái **`Đủ hàng (CONFIRMED)`**!

### Kịch bản 2: Upload Hóa đơn — Bắt lỗi File giả mạo, Nhầm loại chứng từ & Sai Công ty — ~1 phút
Đăng xuất `thukho`, đăng nhập **`ketoan`** → vào **Hóa đơn B2B** → bấm **`⇪ Tải Hóa đơn lên`**:
1. Chọn **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf`** *(file chữ đổi đuôi `.pdf`)* → Báo lỗi đỏ chặn ngay (`415: Định dạng file không hỗ trợ`).
2. Chọn **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_10_FileHongCauTruc_Corrupted.pdf`** → Báo lỗi an toàn (`422: Không đọc được PDF`).
3. Chọn **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf`** → Hệ thống trích xuất xong nhưng cảnh báo vàng ngay dòng đầu: *"Tài liệu có dấu hiệu là GRN, vui lòng kiểm tra kỹ trước khi xác nhận"*.
4. Chọn **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf`** → Liệt kê đủ 5 trường thiếu (`mst`, `so_po`, `ngay_lap`, `vat`, `Không đọc được dòng hàng`) để Kế toán chuyển sang nhập tay theo `UC07`.
5. Chọn **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf`** → Gắn nhãn đỏ **`✕ Sai đơn vị mua hàng`** vì MST bên mua là `0309991112` khác `0108666888`.

### Kịch bản 3: Đối chứng Cặp Hóa đơn ĐÚNG (Khớp tuyệt đối, Trong dung sai + Trừ cọc, PO Dịch vụ, Tên viết tắt) — ~1,5 phút
Vẫn ở tài khoản `ketoan`:
1. Tải & lưu **`03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf`** (`00015801`, `110.000.000đ`).
2. Tải & lưu **`03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf`** (`00015802`, đơn giá tăng `+1,5% ≤ 2%` và trừ đúng tiền cọc `20.000.000đ`).
3. Tải & lưu **`03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf`** (`00038901`, `PO-2026-104` dịch vụ không có GRN).
4. Tải & lưu **`03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf`** (`HD-2026-0458`, hóa đơn ghi tắt `"Cty CP Bánh VN"` vẫn khớp chuẩn hóa).
5. Sang **Đối soát 3 chiều** → Bấm **`⇄ Chạy đối soát`** trên 4 hóa đơn trên → Tất cả đạt **`Khớp (MATCHED)`** 6/6 bước! Bấm **`✓ Hoàn tất đối soát`** cho `00015801` → Chuyển thành **`Đã đối soát (RECONCILED)`** và tự động khóa nút chạy lại!

### Kịch bản 4: Giao hàng & Nhập kho nhiều đợt (`PARTIAL` → `MISMATCH` khai khống → `MATCHED`) — ~1 phút
1. Bằng `thukho`: Upload & lưu **`01_Phieu_Nhap_Kho_GRN_Dung/GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf`** (nhận 600, **đạt 500**, từ chối 100 hộp bị móp) → Trạng thái **`Nhập một phần (PARTIAL)`**.
2. Bằng `ketoan`:
   - Upload & lưu **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_03_KhaiKhongSoLuong_VuotNhapKho_PO102.pdf`** (đòi tiền 600 hộp) → Đối soát báo **`Lệch (MISMATCH)`** ngay bước (c): *"Số lượng hóa đơn vượt số đã nhập kho"*.
   - Upload & lưu **`03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf`** (đòi đúng 500 hộp đã đạt) → Đối soát ra **`Khớp một phần (PARTIAL)`** do PO-102 đặt 1.000 hộp mới nhận 500.
3. Bằng `thukho`: Upload & lưu **`01_Phieu_Nhap_Kho_GRN_Dung/GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf`** (nhập nốt 500 đạt) → `PO-2026-102` đóng (`CLOSED`).
4. Bằng `ketoan`: Bấm chạy lại đối soát trên `00024601` → Tự động chuyển thành **`Khớp (MATCHED)`** và lưu thành 2 lần đối soát riêng biệt trong lịch sử (`BR-17`).

### Kịch bản 5: Xử lý Sai lệch Lớn, Tranh chấp & Duyệt Ngoại lệ giữa Kế toán ↔ Quản lý — ~1,5 phút
1. Bằng `ketoan`: Upload & lưu **`04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf`** (`00015901`, đơn giá tăng `+6%` → lệch `6.000.000đ`).
2. Sang **Đối soát 3 chiều** → Bấm **`⇄ Chạy đối soát`** → Hệ thống báo **`Lệch`** kèm khung cảnh báo **`⚠️ Đánh dấu LỆCH LỚN — Tổng tiền lệch: 6.000.000 ₫`** và tự động đẩy thông báo chuông 🔔 trên Topbar.
3. Sang **Tranh chấp & Ngoại lệ**:
   - Mở hồ sơ tranh chấp cho `00015901` (`OPEN`), nhập lý do xin duyệt ngoại lệ và bấm **`Gửi duyệt ngoại lệ`** *(nếu dùng mẫu `HD_SAI_02` lệch `15.000.000đ` > hạn mức `10.000.000đ`, Trigger `TR-08` sẽ chặn `422` không cho gửi duyệt!)*.
4. Đăng xuất `ketoan` → Đăng nhập **`quanly`** → Vào **Tranh chấp & Ngoại lệ**:
   - Nhập ghi chú phê duyệt bắt buộc → Bấm **`✓ Duyệt`** → Hóa đơn `00015901` tự động chuyển **`Đã đối soát (Ngoại lệ)` (`RECONCILED`)**, hồ sơ tranh chấp đóng sang **`Đã xử lý (RESOLVED)`**!

### Kịch bản 6: Tổng quan Dashboard, Xuất Báo cáo Excel & Audit Trail Bất biến — ~30 giây
1. Vẫn bằng `quanly`:
   - Mở **Tổng quan** → Biểu đồ tỷ lệ & số liệu cập nhật tức thời.
   - Mở **Báo cáo & Thống kê** → Bấm **`↓ Xuất file Excel (.xlsx)`** để mở minh họa file báo cáo tiếng Việt.
2. Đăng nhập **`admin`** → Vào **Quản trị & Phân quyền**:
   - Xem bảng **Audit Log**: hiện rõ từng thao tác `INSERT / UPDATE / UPLOAD`, ai làm lúc mấy giờ, giá trị cũ → giá trị mới (ẩn hoàn toàn `mat_khau_bam`, bảng `audit_log` được Trigger `tr_bao_ve_audit_log` bảo vệ không thể sửa/xóa).

---

## PHẦN 3: GỢI Ý TRẢ LỜI VẤN ĐÁP CHO VAI TRÒ TESTER (M4)
1. **Hỏi: Nhóm kiểm thử ở những mức độ nào?**  
   *Trả lời:* Đủ 3 cấp độ chuẩn CNPM (Chương 6): (1) **Unit Test** bằng `pytest` kiểm tra giá trị biên dung sai `2,00% / 2,01%`, chuẩn hóa tên công ty và trích xuất 24 file PDF; (2) **Integration Test** kiểm tra API + JWT/RBAC + 8 Trigger PL/pgSQL trong PostgreSQL 16; (3) **E2E Test** tự động hóa Chrome bằng Playwright qua 14 bước liên hoàn của 4 vai trò.
2. **Hỏi: Vì sao trong bảng hàng hóa của PDF mẫu không ghi thêm các từ khóa như "phiếu nhập kho" vào hóa đơn?**  
   *Trả lời:* Khi kiểm thử hộp trắng (`pdf_parser.py`), em phát hiện hàm `nhan_dien_loai_chung_tu` ưu tiên kiểm tra cụm từ khóa GRN trước Hóa đơn, đồng thời `trich_hoa_don` & `trich_phieu_kho` phân dòng theo tọa độ Y của `pdfplumber`. Từ đó em thiết kế chuẩn 24 mẫu chứng từ vừa đúng quy chuẩn kế toán (NĐ 123 & TT 200), vừa kiểm chứng chính xác ranh giới parser của hệ thống (bao gồm cả file `HD_SAI_08` cố tình nạp GRN vào mục Hóa đơn để chứng minh hệ thống cảnh báo đúng).
3. **Hỏi: Trong quá trình test em phát hiện những lỗi (Defect) thực tế nào của hệ thống?**  
   *Trả lời:* Em ghi nhận trung thực **7 điểm sai lệch (`DEF-01` đến `DEF-07`)** trong `Bao_Cao_Kiem_Thu_CNPM_M4_VoVietHoang.md` và Sheet `4_Bug_Defect_Log`, tiêu biểu như: `seed.py` thiếu tên/MST bên mua ở `HD-0457` (`DEF-01`), chưa khóa tạm thời đối soát lại khi đang chờ Quản lý duyệt ngoại lệ `CHO_DUYET` (`DEF-02`), chưa kiểm tra điều kiện `ngay_lap >= ngay_dat` (`DEF-03`), `POST /cau-hinh` văng 500 khi vi phạm CHECK hạn mức (`DEF-04`), PO chưa có GRN trả `MISMATCH` thay vì `PARTIAL` (`DEF-05`), thiếu endpoint `PUT/DELETE` cho hóa đơn/PO (`DEF-06`), và `export.py` chưa escape ký tự đầu chống Formula Injection (`DEF-07`).
