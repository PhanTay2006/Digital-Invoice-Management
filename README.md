# Digital Invoice Management & Automated B2B Reconciliation

Hệ thống Quản lý Hóa đơn Điện tử và Đối soát B2B Tự động (3-Way Matching: PO - GRN - Invoice).

## Phạm vi chức năng chính

- **Quản lý danh mục:** Nhà cung cấp (NCC), bảng ánh xạ mã hàng (`anh_xa_sku` nội bộ ↔ đối tác).
- **Quản lý mua hàng & kho:** Đơn đặt hàng (`PO`), Phiếu nhập kho (`GRN`) theo từng đợt giao nhận.
- **Quản lý hóa đơn B2B:** Nhập liệu và tự động bóc tách dữ liệu từ file PDF (`pdfplumber`).
- **Đối soát 3 chiều tự động (3-Way Matching):** So khớp Hóa đơn – PO – GRN theo dung sai (%) và ngưỡng lệch lớn.
- **Xử lý tranh chấp & Phê duyệt ngoại lệ:** Quản lý hồ sơ tranh chấp (`OPEN` → `IN_PROGRESS` → `RESOLVED`) và trình duyệt ngoại lệ lệch lớn theo hạn mức.
- **Báo cáo & Kiểm toán (Audit Trail):** Dashboard thống kê, xuất CSV/Excel và lưu vết Audit Log bất biến ở tầng CSDL bằng Trigger.

## Technology Stack

- **Frontend:** React 19, Vite 6, React Router 7
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2, Psycopg 3, PyJWT, Bcrypt, Pdfplumber, Openpyxl
- **Database:** PostgreSQL 16 (ACID Transactions, JSONB, PL/pgSQL Triggers)

---

## Hướng dẫn khởi tạo Database & Chạy dự án

### Cách 1: Khởi chạy bằng Docker Compose (Khuyên dùng)

Máy đã có sẵn Docker, bạn chỉ cần chạy:

```bash
# 1. Khởi động PostgreSQL (tự động nạp backend/schema.sql) và Backend API
docker compose up -d

# 2. Nạp dữ liệu mẫu (5 tài khoản ứng với 5 Actor + bộ chứng từ mẫu HD-0457)
docker compose exec api python -m app.infrastructure.seed
```

> **Lưu ý trên Linux:** Nếu gặp lỗi `permission denied while trying to connect to the docker API`, hãy chạy kèm `sudo docker compose up -d` hoặc thêm user vào nhóm docker (`sudo usermod -aG docker $USER && newgrp docker`).

### Cách 2: Chạy Backend trực tiếp trên máy (kết nối vào container `db` hoặc PostgreSQL local)

```bash
# 1. Chỉ bật container PostgreSQL ở cổng 5432
docker compose up -d db

# 2. Khởi tạo bảng & dữ liệu mẫu từ môi trường Python
cd backend
python -m app.infrastructure.init_db
python -m app.infrastructure.seed

# 3. Chạy FastAPI server tại http://localhost:8000 (Swagger UI: http://localhost:8000/docs)
uvicorn app.main:app --reload --port 8000
```

### Khởi chạy Frontend (Vite + React)

```bash
npm install
npm run dev
```

### Tài khoản mặc định (sau khi chạy `seed.py`)

Mật khẩu chung cho cả 5 tài khoản: `Matkhau@123`

| Tên đăng nhập | Vai trò trong hệ thống | Quyền hạn chính |
| :--- | :--- | :--- |
| `admin` | `QUAN_TRI` (Quản trị hệ thống) | Quản lý tài khoản, cấu hình dung sai, xem Audit Log |
| `muahang` | `MUA_HANG` (Nhân viên mua hàng) | Tạo và quản lý NCC, ánh xạ SKU, đơn đặt hàng (PO) |
| `thukho` | `THU_KHO` (Thủ kho) | Lập và upload phiếu nhập kho (GRN) |
| `ketoan` | `KE_TOAN_AP` (Kế toán AP) | Quản lý hóa đơn, chạy đối soát 3 chiều, xử lý tranh chấp |
| `quanly` | `QUAN_LY` (Kế toán trưởng) | Phê duyệt ngoại lệ lệch lớn, xem báo cáo & dashboard |
