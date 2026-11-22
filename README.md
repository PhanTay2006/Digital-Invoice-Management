# Digital Invoice Management & Automated B2B Reconciliation

> **Hệ thống Quản lý Hóa đơn Điện tử & Đối soát 3 Chiều Tự động (`PO – GRN – Invoice`)**  
> Đề tài Công nghệ Phần mềm — Phân hệ Bên Mua (Accounts Payable / AP Automation)

---

## Mục lục

1. [Giới thiệu & Tính năng chính](#1-giới-thiệu--tính-năng-chính)
2. [Kiến trúc hệ thống: Client–Server (3-Tier) vs. MVC](#2-kiến-trúc-hệ-thống-clientserver-3-tier-vs-mvc)
3. [Công nghệ sử dụng (Tech Stack)](#3-công-nghệ-sử-dụng-tech-stack)
4. [Cấu trúc thư mục dự án](#4-cấu-trúc-thư-mục-dự-án)
5. [Phân quyền (RBAC) & Tài khoản kiểm thử](#5-phân-quyền-rbac--tài-khoản-kiểm-thử)
6. [Hướng dẫn cài đặt & Khởi chạy chương trình](#6-hướng-dẫn-cài-đặt--khởi-chạy-chương-trình)
7. [Tổng quan RESTful API chính](#7-tổng-quan-restful-api-chính)
8. [Kiểm thử, Kiểm tra CSDL & Bảo trì](#8-kiểm-thử-kiểm-tra-csdl--bảo-trì)

---

## 1. Giới thiệu & Tính năng chính

Hệ thống giúp doanh nghiệp bên mua số hóa và tự động hóa toàn bộ quy trình kiểm tra chứng từ đầu vào và thanh toán B2B:

- **Nhà cung cấp & Ánh xạ SKU (`nha_cung_cap`, `anh_xa_sku`):** Quản lý danh mục nhà cung cấp (tên, mã số thuế) và bảng quy đổi mã hàng nhà cung cấp sang mã SKU nội bộ.
- **Đơn đặt hàng (Purchase Order — `PO`):** Lập và theo dõi PO hàng hóa (`HANG_HOA`) hoặc dịch vụ (`DICH_VU`), đơn giá cam kết và tiền đặt cọc.
- **Phiếu nhập kho (Goods Receipt Note — `GRN`):** Ghi nhận nhập kho theo nhiều đợt gắn với PO, theo dõi số lượng thực nhận, số đạt chất lượng (`so_dat`) và số từ chối.
- **Hóa đơn điện tử B2B (`Invoice`):** Nhập liệu thủ công hoặc tải lên PDF/Ảnh (PDF điện tử, PDF scan, JPG, PNG); tự động bóc tách dữ liệu qua pipeline **`pdfplumber` + `pypdfium2` + `RapidOCR` / `Tesseract (vie)` + Multi-VLM (Google Gemini / tùy chọn Qwen VLM)** kèm bộ nhớ đệm (cache) và hậu kiểm số học.
- **Hồ sơ pháp lý Doanh nghiệp (`/company`):** Quản lý thông tin pháp lý công ty bên mua chuẩn Luật Doanh nghiệp 2020 & Nghị định 123/2020/NĐ-CP (bảng `thong_tin_cong_ty`, mặc định `CÔNG TY CỔ PHẦN BÁNH VIỆT NAM`, MST `0108666888`), làm chuẩn đối chiếu trên hóa đơn và phiếu kho.
- **Đối soát 3 chiều tự động (6 bước `a` → `f`):**
  - **Bước `(a)`:** Kiểm tra Nhà cung cấp trên Hóa đơn khớp với Nhà cung cấp của PO.
  - **Bước `(b)`:** Kiểm tra mọi dòng hàng trên Hóa đơn đều ánh xạ được SKU sang dòng PO tương ứng.
  - **Bước `(c)`:** Đối chiếu Số lượng (không dung sai; PO hàng hóa so với tổng số đạt lũy kế trên GRN; tự động phân loại `PARTIAL` nếu hàng chưa giao đủ nhưng hóa đơn hợp lệ).
  - **Bước `(d)`:** Đối chiếu Đơn giá trong ngưỡng dung sai phần trăm cấu hình (`dung_sai_don_gia_pct`).
  - **Bước `(e)`:** Đối chiếu công thức Tổng tiền trước VAT, thuế VAT, Tiền cọc trừ và Tổng thanh toán.
  - **Bước `(f)`:** Đối chiếu chặt **Tên công ty & MST bên mua** trên Hóa đơn (bắt buộc) và Phiếu nhập kho liên kết PO với Hồ sơ **Thông tin công ty**.
- **Tranh chấp & Phê duyệt ngoại lệ:** Mở và theo dõi hồ sơ tranh chấp (`OPEN` → `IN_PROGRESS` → `RESOLVED`), gửi yêu cầu và phê duyệt/từ chối ngoại lệ theo hạn mức (`QUAN_LY` / `TOAN_QUYEN`).
- **Báo cáo & Audit Trail bất biến:** Thống kê Dashboard, xuất báo cáo `.csv` / `.xlsx` (`openpyxl`), và lưu vết kiểm toán tự động ở tầng CSDL qua các Trigger PL/pgSQL.

---

## 2. Kiến trúc hệ thống: Client–Server (3-Tier) vs. MVC

### Mô hình áp dụng: **Client–Server tách biệt (Decoupled SPA + RESTful API)** theo **Kiến trúc 3 tầng (3-Tier Architecture)**

Hệ thống **không sử dụng mô hình MVC truyền thống** (nơi server render HTML trực tiếp như Django/Spring MVC/PHP thuần), mà tách hoàn toàn **Client (Frontend SPA)** và **Server (Backend API)** thành hai ứng dụng độc lập giao tiếp qua giao thức **HTTP/REST (JSON) + JWT Bearer Token**:

```mermaid
flowchart LR
    U["Người dùng (Trình duyệt)"] --> FE

    subgraph CLIENT["Tầng 1: Client — Presentation Tier (React 19 SPA :5173)"]
        FE["Feature Pages & Components (src/features/*)"]
        AUTH_FE["AuthContext & RBAC Guard (src/routes/, src/constants/permissions.js)"]
        API_SVC["API Client Service (src/services/api.js — JSON + JWT)"]
        FE --> AUTH_FE --> API_SVC
    end

    API_SVC -- "HTTP / REST JSON + Authorization: Bearer JWT" --> API

    subgraph SERVER["Tầng 2: Server — Application & Business Tier (FastAPI :8000)"]
        API["API / Controller Layer (backend/app/api/* — Router, JWT, RBAC)"]
        DOMAIN["Domain Layer (backend/app/domain/ — matching.py, company.py)"]
        INFRA["Infrastructure Layer (pdf_parser.py, vlm_extractor.py, export.py)"]
        CORE["Core Layer (common.py — SQLAlchemy Pool, Session app.user_id)"]
        API --> DOMAIN
        API --> INFRA
        API --> CORE
        INFRA --> CORE
    end

    CORE -- "SQLAlchemy + psycopg" --> DB

    subgraph DATA["Tầng 3: Database — Data Tier (PostgreSQL 16 :5432)"]
        DB["17 Bảng ACID + Cột JSONB + 8 Triggers nghiệp vụ & Audit Log (backend/schema.sql)"]
    end

    INFRA -. "API tùy chọn" .-> VLM["Gemini API / Qwen VLM"]
```

### Phân vai chi tiết giữa 3 tầng

1. **Tầng Client — Presentation Tier (`src/`):**
   - Tổ chức theo kiến trúc **Feature-Based Architecture** (`src/features/{dashboard,invoices,purchase-orders,goods-receipts,matching,exceptions,suppliers,reports,company,users}`).
   - Tự quản lý routing SPA bằng `react-router-dom` v7, lưu phiên đăng nhập JWT, kiểm tra quyền truy cập route theo vai trò ở `src/constants/permissions.js`, và hiển thị dữ liệu từ API.
2. **Tầng Server — Application & Business Tier (`backend/app/`):**
   - Tổ chức theo **Layered Architecture (4 lớp)**:
     - `api/`: Tiếp nhận HTTP request, validate input, xác thực JWT và kiểm tra vai trò qua `Depends(can_vai_tro(...))`.
     - `domain/`: Chứa logic nghiệp vụ thuần túy (`doi_soat` trong `matching.py`, `doi_chieu_cong_ty` trong `company.py`), không phụ thuộc trực tiếp vào kết nối DB để dễ unit test.
     - `infrastructure/`: Tương tác hệ thống ngoài và xử lý file (`pdf_parser.py`, `vlm_extractor.py`, `export.py`, `init_db.py`, `seed.py`).
     - `core/`: Quản lý `SQLAlchemy Engine`, giải mã JWT, truyền `app.user_id` vào PostgreSQL transaction để Trigger ghi nhận người thao tác, và chuẩn hóa lỗi CSDL (`loi_db`).
3. **Tầng Database — Data Tier (`backend/schema.sql`):**
   - Lưu trữ bền vững trên **PostgreSQL 16** với **17 bảng**, kiểu `JSONB` lưu chi tiết các bước đối soát, cùng các **PL/pgSQL Triggers** tự động kiểm tra ràng buộc số lượng kho, cập nhật trạng thái PO, khóa sửa hóa đơn sau xác nhận, bảo vệ nhật ký và ghi `audit_log`.

### Đối chiếu tương quan với mô hình MVC truyền thống

| Thành phần trong MVC | Tương đương trong hệ thống hiện tại | Vị trí trong mã nguồn |
| :--- | :--- | :--- |
| **View** | Giao diện **Client React SPA** (render phía trình duyệt bằng JavaScript) | `src/features/**/pages/`, `src/components/`, `src/layouts/` |
| **Controller** | Các **FastAPI Routers** (nhận request HTTP, kiểm tra RBAC, điều phối gọi Domain/DB) | `backend/app/api/*.py`, `backend/app/core/common.py` |
| **Model** | **Domain Logic thuần** + **Schema & Triggers PostgreSQL** | `backend/app/domain/*.py`, `backend/schema.sql` |

**Lý do chọn Client–Server (SPA + REST API) thay vì MVC render phía server:**
- Tách bạch hoàn toàn giao diện và nghiệp vụ: Backend dễ mở rộng cho các client khác (web, mobile, tích hợp ERP) mà không phải viết lại logic.
- Hàm đối soát ở lớp `domain/` tách rời tầng HTTP và DB giúp kiểm thử tự động nhanh và tin cậy.
- Chống nghẽn tài nguyên khi xử lý tác vụ nặng (render PDF, chạy OCR/VLM đa luồng, xuất Excel) mà giao diện vẫn phản hồi mượt.

---

## 3. Công nghệ sử dụng (Tech Stack)

| Nhóm | Công nghệ / Thư viện | Phiên bản / Chi tiết | Vai trò trong hệ thống |
| :--- | :--- | :--- | :--- |
| **Frontend** | **React**, **React Router DOM**, **Vite** | React `^19.0.0`, Router `^7.0.0`, Vite `^6.0.0` | Xây dựng giao diện SPA Tiếng Việt, định tuyến và phân quyền phía client |
| **Backend API** | **Python**, **FastAPI**, **Uvicorn** | Python `3.12` (Docker), ASGI | Cung cấp RESTful API hiệu năng cao, sinh OpenAPI / Swagger UI tự động |
| **Truy cập CSDL** | **SQLAlchemy**, **psycopg** | `sqlalchemy>=2`, `psycopg[binary]` | Quản lý connection pool và thực thi truy vấn PostgreSQL an toàn |
| **Cơ sở dữ liệu** | **PostgreSQL** | `postgres:16-alpine` (17 bảng) | Lưu trữ giao dịch ACID, `JSONB`, ràng buộc `CHECK/UNIQUE` và Trigger PL/pgSQL |
| **Đọc PDF & Xử lý ảnh** | **pdfplumber**, **pypdfium2**, **Pillow**, **NumPy** | — | Đọc text/bảng PDF điện tử, raster hóa trang PDF sang ảnh và tiền xử lý ảnh |
| **OCR Offline** | **RapidOCR (`rapidocr-onnxruntime`)**, **PyTesseract** | Tesseract + `tesseract-ocr-vie` (`tessdata_best`) | Nhận dạng chữ Tiếng Việt cho PDF scan và ảnh chụp hóa đơn khi không dùng AI cloud |
| **AI VLM (Tùy chọn)** | **Google GenAI SDK (`google-genai`)**, **Qwen VLM** | `google-genai>=3.2.0`; Gemini / DashScope / OpenRouter / Ollama | Trích xuất cấu trúc hóa đơn/phiếu kho từ ảnh có bố cục phức tạp kèm hậu kiểm số học |
| **Báo cáo & Upload** | **openpyxl**, **python-multipart** | — | Xuất báo cáo Excel (`.xlsx`), CSV UTF-8 BOM và nhận upload file `multipart/form-data` |
| **Bảo mật** | **PyJWT**, **bcrypt** | JWT `HS256` (hạn 8 giờ), Bcrypt + Salt | Băm mật khẩu an toàn, xác thực stateless JWT và phân quyền RBAC 6 vai trò |
| **Kiểm thử & Hạ tầng** | **pytest**, **Docker**, **Docker Compose** | — | Chạy unit tests nghiệp vụ/OCR và đóng gói đồng bộ môi trường DB + API |

---

## 4. Cấu trúc thư mục dự án

```text
Digital-Invoice-Management/
├── docker-compose.yml              # Khởi chạy PostgreSQL 16 (db) + FastAPI (api)
├── .env.example                    # Biến môi trường mẫu (Frontend + Gemini/Qwen VLM)
├── package.json                    # Cấu hình React 19 + Vite 6 + React Router 7
├── vite.config.js
├── docs/
│   └── api-test-flow.md            # Kịch bản kiểm thử luồng API & nghiệp vụ
├── backend/
│   ├── Dockerfile                  # Image Python 3.12 + Tesseract Tiếng Việt + pip deps
│   ├── requirements.txt            # Danh sách thư viện Python Backend
│   ├── .env.example                # Biến môi trường mẫu khi chạy Backend local
│   ├── schema.sql                  # 17 bảng PostgreSQL, khóa ngoại, triggers & audit log
│   ├── uploads/                    # Lưu file chứng từ PDF/ảnh upload (gitignored)
│   ├── tests/
│   │   ├── test_matching.py        # Test lõi đối soát 3 chiều
│   │   ├── test_company_matching.py# Test đối chiếu tên & MST công ty
│   │   ├── test_pdf_parser.py      # Test parser PDF/OCR & tách trường
│   │   └── test_vlm_extractor.py   # Test trích xuất Multi-VLM & hậu kiểm
│   └── app/
│       ├── main.py                 # Khởi tạo FastAPI app, CORS, auto-migration cột/bảng
│       ├── core/
│       │   └── common.py           # Engine SQLAlchemy, JWT auth, RBAC, audit app.user_id
│       ├── api/                    # Lớp Controller / REST Endpoints (/api/*)
│       │   ├── auth.py             # Đăng nhập & cấp JWT
│       │   ├── documents.py        # NCC, Ánh xạ SKU, PO, Phiếu kho, Hóa đơn
│       │   ├── upload.py           # Upload & OCR/VLM PDF/Ảnh cho Invoice, GRN, PO
│       │   ├── matching.py         # Đối soát đơn lẻ/hàng loạt, xác nhận, duyệt ngoại lệ
│       │   ├── disputes.py         # Tranh chấp & thông báo
│       │   ├── reports.py          # Dashboard, xuất CSV & Excel (.xlsx)
│       │   └── admin.py            # Người dùng, cấu hình dung sai, Thông tin công ty, Audit log
│       ├── domain/                 # Lớp nghiệp vụ thuần (Pure Domain Logic)
│       │   ├── matching.py         # Lõi đối soát 6 bước (a → f)
│       │   └── company.py          # Chuẩn hóa & đối chiếu pháp lý công ty bên mua
│       └── infrastructure/         # Lớp hạ tầng
│           ├── pdf_parser.py       # Pipeline pdfplumber + RapidOCR/Tesseract + tách bảng
│           ├── vlm_extractor.py    # Điều phối Gemini/Qwen VLM + cache + hậu kiểm số học
│           ├── export.py           # Xuất báo cáo CSV / Excel
│           ├── init_db.py          # Nạp backend/schema.sql khi chạy ngoài Docker
│           └── seed.py             # Tạo dữ liệu mẫu & 6 tài khoản kiểm thử
└── src/
    ├── main.jsx & App.jsx          # Entry point React SPA
    ├── index.css                   # Design system B2B (góc vuông đồng bộ, responsive)
    ├── constants/permissions.js    # Bảng phân quyền route theo vai trò
    ├── contexts/AuthContext.jsx    # Quản lý trạng thái đăng nhập & JWT
    ├── routes/AppRoutes.jsx        # Bảo vệ route theo RBAC
    ├── layouts/MainLayout.jsx      # Khung Sidebar + Topbar + vùng nội dung chính
    ├── components/                 # Sidebar, Topbar, Modal upload, CurrencyInput, Logo
    ├── services/api.js             # HTTP client gọi API Backend
    ├── utils/                      # Định dạng tiền/ngày, audit format, validation
    └── features/                   # Các module giao diện theo nghiệp vụ
        ├── dashboard/
        ├── purchase-orders/
        ├── goods-receipts/
        ├── invoices/
        ├── matching/
        ├── exceptions/
        ├── suppliers/
        ├── reports/
        ├── company/                # Trang Hồ sơ Thông tin công ty (/company)
        └── users/                  # Đăng nhập, Quản trị người dùng, Cấu hình, Audit Log
```

---

## 5. Phân quyền (RBAC) & Tài khoản kiểm thử

Hệ thống áp dụng kiểm tra phân quyền **2 lớp** (ẩn/chặn route ở Frontend trong `src/constants/permissions.js` và kiểm tra vai trò qua `can_vai_tro` ở từng API Backend).

Sau khi chạy lệnh `seed`, hệ thống tạo sẵn **6 tài khoản mẫu** dùng chung mật khẩu **`Matkhau@123`**:

| Tên đăng nhập | Vai trò (`vai_tro`) | Route mặc định | Phạm vi truy cập & Nghiệp vụ chính |
| :--- | :--- | :--- | :--- |
| **`tester`** | `TOAN_QUYEN` | `/dashboard` | **Toàn quyền kiểm thử:** truy cập mọi trang, thực hiện toàn bộ luồng từ tạo PO → GRN → Hóa đơn → Đối soát → Duyệt ngoại lệ → Quản trị. |
| `muahang` | `MUA_HANG` | `/purchase-orders` | Quản lý Nhà cung cấp & ánh xạ SKU, tạo/xem Đơn đặt hàng (PO), xem Phiếu nhập kho, xem Thông tin công ty. |
| `thukho` | `THU_KHO` | `/goods-receipts` | Lập và xem Phiếu nhập kho (GRN), xem Đơn đặt hàng (PO) tham chiếu, xem Thông tin công ty. |
| `ketoan` | `KE_TOAN_AP` | `/dashboard` | Nhập/Upload Hóa đơn, chạy Đối soát 3 chiều, mở & xử lý Tranh chấp, gửi yêu cầu duyệt ngoại lệ, xem Báo cáo, xem Thông tin công ty. |
| `quanly` | `QUAN_LY` | `/dashboard` | Xem Dashboard, chứng từ, đối soát, Báo cáo, xem Thông tin công ty; **Phê duyệt / Từ chối** các yêu cầu ngoại lệ. |
| `admin` | `QUAN_TRI` | `/dashboard` | Quản lý Người dùng, cấu hình dung sai/ngưỡng lệch, tra cứu Audit Log, xem Báo cáo/NCC và **chỉnh sửa Thông tin công ty** (`/company`). |

---

## 6. Hướng dẫn cài đặt & Khởi chạy chương trình

### Yêu cầu môi trường

- **Docker** và **Docker Compose** (khuyến nghị để chạy PostgreSQL + FastAPI API).
- **Node.js 18+** và **npm** (để chạy giao diện Vite + React).
- *(Tùy chọn, nếu chạy Backend trực tiếp không qua Docker)*: Python 3.11+, PostgreSQL 16, gói `tesseract-ocr` và `tesseract-ocr-vie`.

### Bước 1: Clone dự án & Tạo file cấu hình `.env`

```bash
git clone https://github.com/PhanTay2006/Digital-Invoice-Management.git
cd Digital-Invoice-Management
cp .env.example .env
```

Các biến cấu hình chính trong `.env`:

| Biến môi trường | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api` | URL gốc để Frontend gọi Backend API |
| `GEMINI_API_KEY` | *(trống)* | **Tùy chọn.** Nếu có API key Gemini sẽ bật trích xuất AI VLM cho hóa đơn/phiếu kho dạng ảnh hoặc scan phức tạp. Nếu để trống, hệ thống vẫn chạy OCR offline bình thường bằng `pdfplumber` + `RapidOCR` / `Tesseract`. |
| `GEMINI_VLM_MODELS` | `gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-4-hydrogen` | Danh sách model Gemini thử tuần tự khi trích xuất |
| `VLM_PROVIDER` | `auto` | Chế độ chọn VLM (`auto` / `gemini` / `qwen`) |
| `VLM_ENSEMBLE` | `false` | Bật/tắt đối chiếu chéo nhiều mô hình VLM |
| `QWEN_API_BASE`, `QWEN_API_KEY`, `QWEN_VLM_MODEL`, `OLLAMA_BASE_URL` | *(trống)* | Cấu hình tùy chọn cho Qwen VLM (DashScope, OpenRouter hoặc Ollama local) |

---

### Cách 1 (Khuyến nghị): Chạy Database & Backend bằng Docker + Frontend bằng Vite

**1. Khởi động PostgreSQL 16 và Backend FastAPI:**

```bash
docker compose up -d --build
```

> Lưu ý: Trên Linux, nếu user hiện tại chưa được thêm vào nhóm `docker`, hãy thêm `sudo` trước các lệnh `docker compose`.

Lệnh này tự động:
- Khởi tạo container `doisoat_db` (`PostgreSQL 16`, DB `doisoat`, user `app`, pass `app`, port `5432`) và nạp toàn bộ cấu trúc 17 bảng cùng Triggers từ `backend/schema.sql`.
- Build image Python 3.12 kèm Tesseract Tiếng Việt và khởi chạy container `doisoat_api` (`Uvicorn` hot-reload tại port `8000`).

**2. Nạp dữ liệu mẫu ban đầu (tạo 6 tài khoản & bộ chứng từ mẫu `PO-2026-001`, `GRN-001`, `HD-0457`):**

```bash
docker compose exec api python -m app.infrastructure.seed
```

Kết quả mong đợi trên terminal:
`Xong. Đăng nhập: tester (toàn quyền) hoặc admin|muahang|thukho|ketoan|quanly, mật khẩu Matkhau@123`

**3. Cài đặt thư viện & Khởi chạy Giao diện Frontend:**

```bash
npm install
npm run dev
```

---

### Cách 2: Chạy thủ công không dùng Docker (Local Python + PostgreSQL)

1. Tạo database PostgreSQL tên `doisoat` (user `app`, mật khẩu `app`).
2. Tạo file cấu hình backend từ mẫu và chỉnh sửa `DATABASE_URL` nếu cần:
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Cài đặt thư viện Python và nạp schema / dữ liệu mẫu (khuyến nghị dùng virtualenv; nếu chạy OCR Tesseract trên Ubuntu/Debian cần cài thêm `sudo apt install tesseract-ocr tesseract-ocr-vie`):
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

   export DATABASE_URL="postgresql+psycopg://app:app@localhost:5432/doisoat"
   export JWT_SECRET="chuoi-bi-mat-bat-ky"

   python -m app.infrastructure.init_db
   python -m app.infrastructure.seed
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. Ở một terminal khác tại thư mục gốc dự án, cài đặt và chạy Frontend:
   ```bash
   npm install
   npm run dev
   ```

---

### Các địa chỉ truy cập sau khi khởi chạy

| Dịch vụ | Đường dẫn (URL) | Ghi chú |
| :--- | :--- | :--- |
| **Giao diện Web (Frontend)** | `http://localhost:5173` | Ứng dụng React SPA |
| **Swagger UI (API Docs)** | `http://localhost:8000/docs` | Kiểm thử trực tiếp tất cả RESTful API |
| **ReDoc** | `http://localhost:8000/redoc` | Tài liệu API chi tiết |
| **PostgreSQL** | `localhost:5432` | DB: `doisoat` \| User: `app` \| Password: `app` |

---

## 7. Tổng quan RESTful API chính

Tất cả endpoint được gắn tiền tố `/api` (chi tiết kịch bản test xem thêm tại [docs/api-test-flow.md](docs/api-test-flow.md)):

| Nhóm chức năng | Endpoint tiêu biểu | Vai trò chính được phép |
| :--- | :--- | :--- |
| **Xác thực** | `POST /api/dang-nhap` | Công khai (cấp JWT Bearer) |
| **Nhà cung cấp & SKU** | `GET/POST /api/nha-cung-cap`, `GET/POST /api/anh-xa-sku` | `MUA_HANG`, `KE_TOAN_AP`, `QUAN_LY`, `QUAN_TRI`, `TOAN_QUYEN` |
| **Đơn đặt hàng (PO)** | `GET/POST /api/po`, `GET /api/po/{pid}`, `POST /api/po/upload` | Tạo/Upload: `MUA_HANG`; Xem: `MUA_HANG`, `THU_KHO`, `KE_TOAN_AP`, `QUAN_LY` |
| **Phiếu nhập kho (GRN)** | `GET/POST /api/phieu-kho`, `GET /api/phieu-kho/{kid}`, `POST /api/phieu-kho/upload` | Lập/Upload: `THU_KHO`; Xem: `MUA_HANG`, `THU_KHO`, `KE_TOAN_AP`, `QUAN_LY` |
| **Hóa đơn & Tệp đính kèm** | `GET/POST /api/hoa-don`, `GET /api/hoa-don/{hid}`, `POST /api/hoa-don/upload`, `GET /api/hoa-don/{hid}/file` | Tạo/Upload: `KE_TOAN_AP`; Xem/tải file: `KE_TOAN_AP`, `QUAN_LY`, `QUAN_TRI` (`+ TOAN_QUYEN`) |
| **Đối soát 3 chiều** | `POST /api/hoa-don/{hid}/doi-soat`, `POST /api/hoa-don/doi-soat-hang-loat`, `POST /api/hoa-don/{hid}/xac-nhan` | Chạy đối soát & xác nhận: `KE_TOAN_AP` (`+ TOAN_QUYEN`) |
| **Tranh chấp & Duyệt ngoại lệ** | `GET/POST /api/tranh-chap`, `PUT /api/tranh-chap/{tid}/trang-thai`, `POST /api/tranh-chap/{tid}/yeu-cau-duyet`, `GET /api/yeu-cau-duyet`, `PUT /api/yeu-cau-duyet/{yid}` | Mở/xử lý/gửi duyệt: `KE_TOAN_AP`; Xem: `KE_TOAN_AP`, `QUAN_LY`, `QUAN_TRI`; Duyệt/Từ chối ngoại lệ: `QUAN_LY` (`+ TOAN_QUYEN`) |
| **Báo cáo & Dashboard** | `GET /api/dashboard`, `GET /api/bao-cao/hoa-don.csv`, `GET /api/bao-cao/hoa-don.xlsx` | `KE_TOAN_AP`, `QUAN_LY`, `QUAN_TRI`, `TOAN_QUYEN` |
| **Công ty & Quản trị** | `GET/PUT /api/cong-ty`, `GET/POST/PUT/DELETE /api/nguoi-dung`, `GET/POST /api/cau-hinh*`, `GET /api/audit-log` | Xem công ty: tất cả tài khoản đăng nhập; Sửa công ty & Quản trị: `QUAN_TRI`, `TOAN_QUYEN` |

---

## 8. Kiểm thử, Kiểm tra CSDL & Bảo trì

### Chạy kiểm thử tự động (Tests & Build)

```bash
# Chạy toàn bộ unit tests Backend (4 suite: matching, company_matching, pdf_parser, vlm_extractor)
docker compose exec api pytest

# Hoặc chạy local khi đã cài virtualenv ở máy:
pytest backend/tests

# Kiểm tra build production của Frontend
npm run build
```

### Kiểm tra nhanh dữ liệu trong PostgreSQL

```bash
# Xem danh sách Đơn đặt hàng (PO)
docker compose exec db psql -U app -d doisoat -c "SELECT id, so_po, loai_po, tong_tien, trang_thai FROM don_hang_po;"

# Xem danh sách Hóa đơn B2B
docker compose exec db psql -U app -d doisoat -c "SELECT id, so_hoa_don, ten_nguoi_mua, mst_nguoi_mua, tong_thanh_toan, trang_thai FROM hoa_don;"

# Xem Thông tin pháp lý công ty đang cấu hình
docker compose exec db psql -U app -d doisoat -c "SELECT id, ten_cong_ty, mst, ma_cqt_quan_ly FROM thong_tin_cong_ty;"

# Xem 10 dòng nhật ký kiểm toán gần nhất do Trigger ghi lại
docker compose exec db psql -U app -d doisoat -c "SELECT id, thoi_gian, hanh_dong, doi_tuong, doi_tuong_id FROM audit_log ORDER BY id DESC LIMIT 10;"
```

### Các lệnh vận hành & bảo trì thường dùng

```bash
# Khởi động lại Backend API sau khi sửa code hoặc cập nhật .env
docker compose restart api

# Tạm dừng hệ thống (giữ nguyên dữ liệu trong volume pgdata)
docker compose stop

# Bật lại hệ thống sau khi tạm dừng (kèm chạy lại npm run dev cho Frontend)
docker compose start

# Xóa toàn bộ dữ liệu DB để khởi tạo sạch lại từ đầu và nạp lại dữ liệu mẫu
docker compose down -v
docker compose up -d --build
docker compose exec api python -m app.infrastructure.seed
```
