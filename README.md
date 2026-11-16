# Digital Invoice Management & Automated B2B Reconciliation
> **Hệ thống Quản lý Hóa đơn Điện tử & Đối soát 3 Chiều Tự động (PO – GRN – Invoice)**  
> Đề tài Công nghệ Phần mềm — Phân hệ Bên Mua (Accounts Payable - AP Automation)

---

## 📌 1. Giới thiệu & Phạm vi đề tài

Hệ thống hỗ trợ doanh nghiệp bên mua tự động hóa toàn bộ chu trình xử lý chứng từ và đối soát thanh toán B2B:
- **Đơn đặt hàng (Purchase Order - PO):** Cam kết mua hàng, số lượng đặt, đơn giá thỏa thuận và điều khoản cọc/thanh toán.
- **Phiếu nhập kho (Goods Receipt Note - GRN):** Ghi nhận số lượng hàng thực nhận, số đạt chất lượng và hàng lỗi trả lại theo từng đợt giao.
- **Hóa đơn điện tử B2B (Invoice):** Nhập thủ công hoặc tải lên PDF (PDF điện tử / PDF scan ảnh), tự động bóc tách dữ liệu bằng `pdfplumber` kết hợp `PaddleOCR`.
- **Đối soát 3 chiều tự động (3-Way Matching):** So khớp Hóa đơn ↔ PO ↔ GRN theo 5 bước kiểm tra chặt chẽ kèm thuật toán dung sai (%) đơn giá, thuế VAT và trừ cọc.
- **Xử lý tranh chấp & Phê duyệt ngoại lệ:** Quy trình quản lý tranh chấp (`OPEN` → `IN_PROGRESS` → `RESOLVED`) và phân quyền Quản lý duyệt các hóa đơn lệch lớn theo hạn mức.
- **Lưu vết kiểm toán bất biến (Audit Trail):** Ghi nhật ký tự động ở tầng CSDL bằng Trigger PL/pgSQL, bảo vệ tính toàn vẹn dữ liệu tài chính.

---

## 🛠️ 2. Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Vai trò |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, React Router 7 | Giao diện Single Page Application (SPA) 100% Tiếng Việt, Responsive |
| **Backend** | Python 3.11+, FastAPI, Uvicorn | RESTful API, xác thực bảo mật JWT, kiểm tra phân quyền RBAC |
| **Database** | PostgreSQL 16 | Đảm bảo ACID, lưu chi tiết đối soát `JSONB`, Trigger ghi `audit_log` |
| **Xử lý tài liệu** | `pdfplumber`, `PaddleOCR`, `openpyxl` | Bóc tách tự động PDF điện tử, PDF scan/ảnh, Word (.docx) và Excel (.xlsx) |
| **Bảo mật** | Bcrypt + Salt, PyJWT (HS256) | Mã hóa mật khẩu một chiều, Token có thời hạn 8 giờ |
| **Container** | Docker, Docker Compose | Đóng gói môi trường Database & Backend đồng nhất |

---

## 🚀 3. Hướng dẫn cài đặt & Khởi chạy hệ thống

### Yêu cầu môi trường
- **Docker & Docker Compose** đã được cài đặt trên máy.
- **Node.js** (phiên bản 18+ khuyến nghị) và **npm**.

---

### Bước 1: Khởi động Database & Backend API (Docker)

Mở Terminal tại thư mục gốc của dự án (`Digital-Invoice-Management`) và chạy:

```bash
sudo docker compose up -d --build
```

Lệnh này sẽ:
1. Khởi tạo container PostgreSQL 16 ở cổng `5432`, tự động nạp toàn bộ 15 bảng và các Trigger nghiệp vụ từ file `backend/schema.sql`.
2. Build và khởi chạy container FastAPI Backend ở cổng `8000`.

---

### Bước 2: Nạp dữ liệu mẫu ban đầu (Seed Data)

Chạy lệnh sau để khởi tạo sẵn các tài khoản phân quyền và bộ chứng từ mẫu (`PO-2026-001`, `GRN-001`, `HD-0457`):

```bash
sudo docker compose exec api python -m app.infrastructure.seed
```

> Màn hình báo: `Xong. Đăng nhập: tester (toàn quyền) hoặc admin|muahang|thukho|ketoan|quanly, mật khẩu Matkhau@123` là hoàn tất.

---

### Bước 3: Khởi chạy Giao diện Frontend (React + Vite)

Cũng tại thư mục gốc, cài đặt thư viện và khởi động server giao diện:

```bash
# Cài đặt thư viện (chỉ cần chạy lần đầu)
npm install

# Khởi chạy server phát triển
npm run dev
```

---

## 🌐 4. Các địa chỉ truy cập ứng dụng

| Dịch vụ | Đường dẫn (URL) | Mô tả |
| :--- | :--- | :--- |
| **Giao diện Web (Frontend)** | `http://localhost:5173` | Hệ thống quản lý và đối soát B2B Tiếng Việt |
| **Tài liệu API (Swagger UI)** | `http://localhost:8000/docs` | Kiểm thử trực quan toàn bộ RESTful API |
| **Cơ sở dữ liệu (PostgreSQL)** | `localhost:5432` | Database: `doisoat` \| User: `app` \| Pass: `app` |

---

## 👥 5. Danh sách tài khoản kiểm thử phân quyền

Tất cả tài khoản đều dùng chung mật khẩu: **`Matkhau@123`**

| Tên đăng nhập | Vai trò hiển thị | Quyền hạn nghiệp vụ chính |
| :--- | :--- | :--- |
| **`tester`** | **Toàn quyền Kiểm thử (All-in-One)** | Thao tác được **tất cả mọi chức năng** (Tạo PO, Lập phiếu kho, Nhập/Upload HĐ, Chạy đối soát, Mở tranh chấp, Tự duyệt ngoại lệ, Quản trị) mà không cần đổi tài khoản. |
| `muahang` | Nhân viên mua hàng (`MUA_HANG`) | Quản lý Nhà cung cấp, bảng ánh xạ SKU, tạo và theo dõi Đơn đặt hàng (PO). |
| `thukho` | Thủ kho (`THU_KHO`) | Lập phiếu nhập kho (GRN) theo PO hàng hóa, ghi số lượng thực nhận / số đạt. |
| `ketoan` | Kế toán AP (`KE_TOAN_AP`) | Nhập / Upload PDF hóa đơn, chạy đối soát 3 chiều, mở hồ sơ tranh chấp, gửi yêu cầu duyệt ngoại lệ. |
| `quanly` | Quản lý / Kế toán trưởng (`QUAN_LY`) | Xem Dashboard chỉ số, phê duyệt hoặc từ chối các yêu cầu ngoại lệ lệch lớn. |
| `admin` | Quản trị hệ thống (`QUAN_TRI`) | Quản lý người dùng, thiết lập tham số dung sai / ngưỡng lệch, tra cứu nhật ký Audit Log. |

---

## 🔍 6. Hướng dẫn kiểm tra dữ liệu trực tiếp trong Database

Bạn có thể kiểm tra dữ liệu đã lưu trong PostgreSQL bằng các lệnh sau:

```bash
# Xem danh sách Đơn đặt hàng (PO)
sudo docker compose exec db psql -U app -d doisoat -c "SELECT id, so_po, loai_po, tong_tien, trang_thai FROM don_hang_po;"

# Xem danh sách Hóa đơn B2B
sudo docker compose exec db psql -U app -d doisoat -c "SELECT id, so_hoa_don, tong_thanh_toan, trang_thai, theo_ngoai_le FROM hoa_don;"

# Xem nhật ký kiểm toán bất biến do Trigger tự động ghi lại
sudo docker compose exec db psql -U app -d doisoat -c "SELECT id, thoi_gian, hanh_dong, doi_tuong, doi_tuong_id FROM audit_log ORDER BY id DESC LIMIT 10;"
```

---

## ⚙️ 7. Các lệnh bảo trì thường dùng

- **Khởi động lại Backend API sau khi sửa code:**
  ```bash
  sudo docker compose restart api
  ```
- **Tạm dừng hệ thống (giữ nguyên dữ liệu):**
  ```bash
  sudo docker compose stop
  ```
- **Bật lại sau khi tạm dừng:**
  ```bash
  sudo docker compose start
  # và chạy: npm run dev
  ```
- **Xóa sạch Database để khởi tạo lại từ đầu:**
  ```bash
  sudo docker compose down -v
  sudo docker compose up -d
  sudo docker compose exec api python -m app.infrastructure.seed
  ```
