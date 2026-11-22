-- =============================================================================
-- SCHEMA CƠ SỞ DỮ LIỆU: HỆ THỐNG QUẢN LÝ HÓA ĐƠN ĐIỆN TỬ & ĐỐI SOÁT B2B TỰ ĐỘNG
-- Hệ quản trị CSDL: PostgreSQL 15+
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. BẢNG NGƯỜI DÙNG & PHÂN QUYỀN (F-12, NF-08, NF-10)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nguoi_dung (
    id              SERIAL PRIMARY KEY,
    ten_dang_nhap   VARCHAR(100) NOT NULL UNIQUE,
    mat_khau_bam    TEXT NOT NULL,
    ho_ten          VARCHAR(200) NOT NULL,
    vai_tro         VARCHAR(30) NOT NULL CHECK (
        vai_tro IN ('MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI', 'TOAN_QUYEN')
    ),
    hoat_dong       BOOLEAN NOT NULL DEFAULT TRUE,
    ngay_tao        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 1b. BẢNG HỒ SƠ PHÁP LÝ CÔNG TY BÊN MUA (Chuẩn Luật DN 2020 & NĐ 123/TT 78)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_tin_cong_ty (
    id                      SERIAL PRIMARY KEY,
    ten_cong_ty             VARCHAR(255) NOT NULL,
    ten_tieng_anh           VARCHAR(255),
    ten_viet_tat            VARCHAR(100),
    loai_hinh_dn            VARCHAR(100),
    mst                     VARCHAR(14) NOT NULL,
    ma_cqt_quan_ly          VARCHAR(50),
    co_quan_thue_quan_ly    VARCHAR(255),
    dia_chi                 TEXT NOT NULL,
    nguoi_dai_dien          VARCHAR(200),
    chuc_vu_dai_dien        VARCHAR(120),
    so_giay_phep_dkkd       VARCHAR(100),
    ngay_cap_dkkd           DATE,
    noi_cap_dkkd            VARCHAR(255),
    so_tai_khoan            VARCHAR(100),
    ngan_hang               VARCHAR(255),
    dien_thoai              VARCHAR(50),
    email                   VARCHAR(150),
    website                 VARCHAR(200),
    ngay_cap_nhat           TIMESTAMPTZ NOT NULL DEFAULT now(),
    nguoi_cap_nhat_id       INT REFERENCES nguoi_dung(id)
);

INSERT INTO thong_tin_cong_ty (
    ten_cong_ty, ten_tieng_anh, ten_viet_tat, loai_hinh_dn,
    mst, ma_cqt_quan_ly, co_quan_thue_quan_ly, dia_chi,
    nguoi_dai_dien, chuc_vu_dai_dien, so_giay_phep_dkkd, ngay_cap_dkkd, noi_cap_dkkd,
    so_tai_khoan, ngan_hang, dien_thoai, email, website
)
SELECT
    'CÔNG TY CỔ PHẦN BÁNH VIỆT NAM',
    'VIETNAM BAKERY JOINT STOCK COMPANY',
    'BANH VN JSC',
    'Công ty cổ phần',
    '0108666888',
    '70115',
    'Thuế TP. Hồ Chí Minh - Thuế cơ sở 7 (Khu vực Phường Tân Hưng)',
    'A41, Khu dân cư Kim Sơn, Phường Tân Hưng, Thành phố Hồ Chí Minh',
    'Nguyễn Minh Hoàng',
    'Tổng Giám đốc',
    '0108666888',
    DATE '2022-05-15',
    'Phòng Đăng ký kinh doanh - Sở Tài chính TP. Hồ Chí Minh',
    '0071001234568',
    'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN TP. Hồ Chí Minh',
    '(028) 3876 6888',
    'ketoan@banhvietnam.vn',
    'https://banhvietnam.vn'
WHERE NOT EXISTS (SELECT 1 FROM thong_tin_cong_ty);

-- -----------------------------------------------------------------------------
-- 2. BẢNG CẤU HÌNH DUNG SAI & NGƯỠNG ĐỐI SOÁT (F-17, BR-24)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cau_hinh_doi_soat (
    id                      SERIAL PRIMARY KEY,
    dung_sai_don_gia_pct    NUMERIC(6, 2) NOT NULL CHECK (dung_sai_don_gia_pct >= 0 AND dung_sai_don_gia_pct <= 100),
    nguong_lech_lon_pct     NUMERIC(6, 2) NOT NULL CHECK (nguong_lech_lon_pct >= 0 AND nguong_lech_lon_pct <= 100),
    nguong_lech_lon_tien    NUMERIC(18, 2) NOT NULL CHECK (nguong_lech_lon_tien >= 0),
    han_muc_duyet           NUMERIC(18, 2) NOT NULL CHECK (han_muc_duyet >= 0 AND nguong_lech_lon_tien <= han_muc_duyet),
    hieu_luc_tu             TIMESTAMPTZ NOT NULL DEFAULT now(),
    nguoi_cau_hinh_id       INT REFERENCES nguoi_dung(id)
);

-- -----------------------------------------------------------------------------
-- 3. BẢNG NHÀ CUNG CẤP & ÁNH XẠ SKU (F-01, F-03)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nha_cung_cap (
    id          SERIAL PRIMARY KEY,
    ten         VARCHAR(255) NOT NULL,
    mst         VARCHAR(14) NOT NULL UNIQUE,
    dia_chi     TEXT,
    ngay_tao    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anh_xa_sku (
    id              SERIAL PRIMARY KEY,
    nha_cung_cap_id INT NOT NULL REFERENCES nha_cung_cap(id) ON DELETE CASCADE,
    ma_sku_ncc      VARCHAR(100) NOT NULL,
    ma_sku_noi_bo   VARCHAR(100) NOT NULL,
    ten_san_pham    VARCHAR(255),
    UNIQUE (nha_cung_cap_id, ma_sku_ncc)
);

-- -----------------------------------------------------------------------------
-- 4. BẢNG ĐƠN ĐẶT HÀNG - PO & DÒNG HÀNG PO (F-03, BR-06, BR-07)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS don_hang_po (
    id              SERIAL PRIMARY KEY,
    so_po           VARCHAR(100) NOT NULL UNIQUE,
    nha_cung_cap_id INT NOT NULL REFERENCES nha_cung_cap(id),
    ngay_dat        DATE NOT NULL,
    loai_po         VARCHAR(30) NOT NULL DEFAULT 'HANG_HOA' CHECK (loai_po IN ('HANG_HOA', 'DICH_VU')),
    dieu_khoan_tt   VARCHAR(255),
    tien_coc        NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (tien_coc >= 0),
    tong_tien       NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (tong_tien >= 0 AND tien_coc <= tong_tien),
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (
        trang_thai IN ('OPEN', 'PARTIALLY_RECEIVED', 'CLOSED', 'CANCELLED')
    ),
    nguoi_tao_id    INT REFERENCES nguoi_dung(id),
    ngay_tao        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dong_po (
    id              SERIAL PRIMARY KEY,
    po_id           INT NOT NULL REFERENCES don_hang_po(id) ON DELETE CASCADE,
    ma_sku          VARCHAR(100) NOT NULL,
    mo_ta           TEXT,
    so_luong_dat    NUMERIC(18, 2) NOT NULL CHECK (so_luong_dat > 0),
    don_gia         NUMERIC(18, 2) NOT NULL CHECK (don_gia >= 0),
    UNIQUE (po_id, ma_sku)
);

-- -----------------------------------------------------------------------------
-- 5. BẢNG PHIẾU NHẬP KHO - GRN & DÒNG PHIẾU KHO (F-04, BR-08..BR-11)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phieu_kho (
    id              SERIAL PRIMARY KEY,
    so_phieu        VARCHAR(100) NOT NULL UNIQUE,
    po_id           INT NOT NULL REFERENCES don_hang_po(id),
    ngay_nhap       DATE NOT NULL,
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'PARTIAL' CHECK (trang_thai IN ('PARTIAL', 'CONFIRMED')),
    file_pdf        VARCHAR(255),
    ten_don_vi      VARCHAR(255),
    mst_don_vi      VARCHAR(20),
    nguoi_lap_id    INT REFERENCES nguoi_dung(id),
    ngay_tao        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dong_phieu_kho (
    id              SERIAL PRIMARY KEY,
    phieu_kho_id    INT NOT NULL REFERENCES phieu_kho(id) ON DELETE CASCADE,
    dong_po_id      INT NOT NULL REFERENCES dong_po(id),
    so_nhan         NUMERIC(18, 2) NOT NULL CHECK (so_nhan >= 0),
    so_dat          NUMERIC(18, 2) NOT NULL CHECK (so_dat >= 0 AND so_dat <= so_nhan),
    so_tu_choi      NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (so_tu_choi >= 0),
    ly_do           TEXT
);

-- -----------------------------------------------------------------------------
-- 6. BẢNG HÓA ĐƠN B2B & DÒNG HÓA ĐƠN (F-01, F-05, BR-01..BR-05)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hoa_don (
    id              SERIAL PRIMARY KEY,
    so_hoa_don      VARCHAR(100) NOT NULL,
    nha_cung_cap_id INT NOT NULL REFERENCES nha_cung_cap(id),
    po_id           INT NOT NULL REFERENCES don_hang_po(id),
    ngay_lap        DATE NOT NULL,
    tong_truoc_vat  NUMERIC(18, 2) NOT NULL CHECK (tong_truoc_vat >= 0),
    vat             NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (vat >= 0),
    tien_coc_tru    NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (tien_coc_tru >= 0),
    tong_thanh_toan NUMERIC(18, 2) NOT NULL CHECK (tong_thanh_toan >= 0),
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'CHUA_DOI_SOAT' CHECK (
        trang_thai IN ('CHUA_DOI_SOAT', 'MATCHED', 'PARTIAL', 'MISMATCH', 'RECONCILED')
    ),
    theo_ngoai_le   BOOLEAN NOT NULL DEFAULT FALSE,
    file_pdf        VARCHAR(255),
    ma_cqt          VARCHAR(100),
    ten_nguoi_mua   VARCHAR(255),
    mst_nguoi_mua   VARCHAR(20),
    nguoi_tao_id    INT REFERENCES nguoi_dung(id),
    ngay_tao        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (nha_cung_cap_id, so_hoa_don)
);

CREATE TABLE IF NOT EXISTS dong_hoa_don (
    id              SERIAL PRIMARY KEY,
    hoa_don_id      INT NOT NULL REFERENCES hoa_don(id) ON DELETE CASCADE,
    dong_po_id      INT REFERENCES dong_po(id),
    ma_sku_ncc      VARCHAR(100) NOT NULL,
    ten_san_pham    VARCHAR(255),
    so_luong        NUMERIC(18, 2) NOT NULL CHECK (so_luong > 0),
    don_gia         NUMERIC(18, 2) NOT NULL CHECK (don_gia >= 0),
    thanh_tien      NUMERIC(18, 2) NOT NULL CHECK (thanh_tien >= 0)
);

-- -----------------------------------------------------------------------------
-- 7. BẢNG LỊCH SỬ ĐỐI SOÁT 3 CHIỀU (F-07, BR-16, BR-17)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lan_doi_soat (
    id              SERIAL PRIMARY KEY,
    hoa_don_id      INT NOT NULL REFERENCES hoa_don(id) ON DELETE CASCADE,
    cau_hinh_id     INT NOT NULL REFERENCES cau_hinh_doi_soat(id),
    nguoi_chay_id   INT REFERENCES nguoi_dung(id),
    ket_qua         VARCHAR(30) NOT NULL CHECK (ket_qua IN ('MATCHED', 'PARTIAL', 'MISMATCH')),
    lech_lon        BOOLEAN NOT NULL DEFAULT FALSE,
    muc_lech_tien   NUMERIC(18, 2),
    chi_tiet_buoc   JSONB NOT NULL,
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 8. BẢNG TRANH CHẤP & LỊCH SỬ TRANH CHẤP (F-09, F-10, BR-19..BR-21)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tranh_chap (
    id              SERIAL PRIMARY KEY,
    hoa_don_id      INT NOT NULL REFERENCES hoa_don(id),
    phu_trach_id    INT NOT NULL REFERENCES nguoi_dung(id),
    ly_do           TEXT NOT NULL,
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (
        trang_thai IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')
    ),
    ngay_mo         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ngay_dong       TIMESTAMPTZ
);

-- Mỗi hóa đơn chỉ có tối đa 1 hồ sơ tranh chấp đang mở (chưa RESOLVED)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tranh_chap_dang_mo
    ON tranh_chap(hoa_don_id)
    WHERE trang_thai <> 'RESOLVED';

CREATE TABLE IF NOT EXISTS lich_su_tranh_chap (
    id                  SERIAL PRIMARY KEY,
    tranh_chap_id       INT NOT NULL REFERENCES tranh_chap(id) ON DELETE CASCADE,
    nguoi_thuc_hien_id  INT REFERENCES nguoi_dung(id),
    trang_thai_moi      VARCHAR(30) NOT NULL,
    ghi_chu             TEXT,
    thoi_gian           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. BẢNG YÊU CẦU DUYỆT NGOẠI LỆ LỆCH LỚN (F-16, BR-22, BR-23)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yeu_cau_duyet_ngoai_le (
    id              SERIAL PRIMARY KEY,
    hoa_don_id      INT NOT NULL REFERENCES hoa_don(id),
    tranh_chap_id   INT NOT NULL REFERENCES tranh_chap(id),
    lan_doi_soat_id INT NOT NULL REFERENCES lan_doi_soat(id),
    nguoi_gui_id    INT NOT NULL REFERENCES nguoi_dung(id),
    ly_do           TEXT NOT NULL,
    trang_thai      VARCHAR(30) NOT NULL DEFAULT 'CHO_DUYET' CHECK (
        trang_thai IN ('CHO_DUYET', 'DUYET', 'TU_CHOI')
    ),
    nguoi_duyet_id  INT REFERENCES nguoi_dung(id),
    ghi_chu_duyet   TEXT,
    thoi_gian_gui   TIMESTAMPTZ NOT NULL DEFAULT now(),
    thoi_gian_duyet TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_yeu_cau_cho_duyet
    ON yeu_cau_duyet_ngoai_le(hoa_don_id)
    WHERE trang_thai = 'CHO_DUYET';

-- -----------------------------------------------------------------------------
-- 10. BẢNG THÔNG BÁO (F-11)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS thong_bao (
    id              SERIAL PRIMARY KEY,
    nguoi_nhan_id   INT NOT NULL REFERENCES nguoi_dung(id),
    hoa_don_id      INT REFERENCES hoa_don(id),
    loai            VARCHAR(50) NOT NULL,
    noi_dung        TEXT NOT NULL,
    da_doc          BOOLEAN NOT NULL DEFAULT FALSE,
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 11. BẢNG AUDIT LOG BẤT BIẾN (F-13, NF-12, BR-26)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id              BIGSERIAL PRIMARY KEY,
    thoi_gian       TIMESTAMPTZ NOT NULL DEFAULT now(),
    nguoi_dung_id   INT REFERENCES nguoi_dung(id),
    hanh_dong       VARCHAR(50) NOT NULL,
    doi_tuong       VARCHAR(50) NOT NULL,
    doi_tuong_id    INT NOT NULL,
    du_lieu_cu      JSONB,
    du_lieu_moi     JSONB
);

-- Chỉ mục tối ưu truy vấn (NF-04)
CREATE INDEX IF NOT EXISTS idx_hoa_don_trang_thai ON hoa_don(trang_thai);
CREATE INDEX IF NOT EXISTS idx_hoa_don_ngay_lap ON hoa_don(ngay_lap DESC);
CREATE INDEX IF NOT EXISTS idx_hoa_don_po_id ON hoa_don(po_id);
CREATE INDEX IF NOT EXISTS idx_phieu_kho_po_id ON phieu_kho(po_id);
CREATE INDEX IF NOT EXISTS idx_lan_doi_soat_hoa_don ON lan_doi_soat(hoa_don_id, thoi_gian DESC);
CREATE INDEX IF NOT EXISTS idx_thong_bao_nguoi_nhan ON thong_bao(nguoi_nhan_id, da_doc, thoi_gian DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_doi_tuong ON audit_log(doi_tuong, doi_tuong_id, id DESC);

-- =============================================================================
-- CÁC TRIGGER NGHIỆP VỤ & AUDIT TRAIL TẦNG CSDL (NF-12, BR-04..BR-26)
-- =============================================================================

-- TR-01 & TR-02: Kiểm tra phiếu nhập kho (BR-08, BR-09, BR-10, BR-11)
CREATE OR REPLACE FUNCTION fn_kiem_tra_phieu_kho() RETURNS TRIGGER AS $$
DECLARE
    v_loai_po VARCHAR(30);
    v_tt_po   VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Phiếu nhập kho đã xác nhận không được phép xóa (BR-10)';
    END IF;

    SELECT loai_po, trang_thai INTO v_loai_po, v_tt_po
    FROM don_hang_po WHERE id = NEW.po_id;

    IF v_loai_po <> 'HANG_HOA' THEN
        RAISE EXCEPTION 'Chỉ PO hàng hóa mới lập phiếu nhập kho (BR-08)';
    END IF;

    IF TG_OP = 'INSERT' AND v_tt_po IN ('CLOSED', 'CANCELLED') THEN
        RAISE EXCEPTION 'Không thể lập phiếu nhập kho cho PO đã đóng hoặc đã hủy';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_kiem_tra_phieu_kho ON phieu_kho;
CREATE TRIGGER tr_kiem_tra_phieu_kho
    BEFORE INSERT OR DELETE ON phieu_kho
    FOR EACH ROW EXECUTE FUNCTION fn_kiem_tra_phieu_kho();

-- Kiểm tra tổng số đạt lũy kế <= số lượng đặt trên PO (BR-09) và cập nhật trạng thái PO (BR-11)
CREATE OR REPLACE FUNCTION fn_kiem_tra_dong_phieu_kho() RETURNS TRIGGER AS $$
DECLARE
    v_sl_dat    NUMERIC(18, 2);
    v_po_id     INT;
    v_tong_dat  NUMERIC(18, 2);
    v_con_thieu INT;
BEGIN
    SELECT so_luong_dat, po_id INTO v_sl_dat, v_po_id
    FROM dong_po WHERE id = NEW.dong_po_id;

    SELECT COALESCE(SUM(so_dat), 0) INTO v_tong_dat
    FROM dong_phieu_kho
    WHERE dong_po_id = NEW.dong_po_id AND (TG_OP = 'INSERT' OR id <> NEW.id);

    IF v_tong_dat + NEW.so_dat > v_sl_dat THEN
        RAISE EXCEPTION 'Tổng số lượng đạt lũy kế vượt số lượng đặt trên PO (BR-09)';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_kiem_tra_dong_phieu_kho ON dong_phieu_kho;
CREATE TRIGGER tr_kiem_tra_dong_phieu_kho
    BEFORE INSERT OR UPDATE ON dong_phieu_kho
    FOR EACH ROW EXECUTE FUNCTION fn_kiem_tra_dong_phieu_kho();

CREATE OR REPLACE FUNCTION fn_cap_nhat_trang_thai_po() RETURNS TRIGGER AS $$
DECLARE
    v_po_id     INT;
    v_con_thieu INT;
BEGIN
    SELECT po_id INTO v_po_id FROM dong_po WHERE id = NEW.dong_po_id;

    SELECT COUNT(*) INTO v_con_thieu
    FROM dong_po dp
    WHERE dp.po_id = v_po_id
      AND dp.so_luong_dat > COALESCE((
          SELECT SUM(dk.so_dat) FROM dong_phieu_kho dk WHERE dk.dong_po_id = dp.id
      ), 0);

    UPDATE don_hang_po
    SET trang_thai = CASE WHEN v_con_thieu = 0 THEN 'CLOSED' ELSE 'PARTIALLY_RECEIVED' END
    WHERE id = v_po_id AND trang_thai <> 'CANCELLED';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cap_nhat_trang_thai_po ON dong_phieu_kho;
CREATE TRIGGER tr_cap_nhat_trang_thai_po
    AFTER INSERT OR UPDATE ON dong_phieu_kho
    FOR EACH ROW EXECUTE FUNCTION fn_cap_nhat_trang_thai_po();

-- TR-04: Chỉ mở tranh chấp cho hóa đơn MISMATCH hoặc PARTIAL (BR-19)
CREATE OR REPLACE FUNCTION fn_tr04_kiem_tra_mo_tranh_chap() RETURNS TRIGGER AS $$
DECLARE
    v_tt VARCHAR(30);
BEGIN
    SELECT trang_thai INTO v_tt FROM hoa_don WHERE id = NEW.hoa_don_id;
    IF v_tt NOT IN ('MISMATCH', 'PARTIAL') THEN
        RAISE EXCEPTION 'Chỉ tạo tranh chấp từ hóa đơn MISMATCH hoặc PARTIAL (BR-19)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr04_kiem_tra_mo_tranh_chap ON tranh_chap;
CREATE TRIGGER tr04_kiem_tra_mo_tranh_chap
    BEFORE INSERT ON tranh_chap
    FOR EACH ROW EXECUTE FUNCTION fn_tr04_kiem_tra_mo_tranh_chap();

-- TR-05: Xử lý khi cập nhật trạng thái tranh chấp (BR-20, BR-21, BR-22)
CREATE OR REPLACE FUNCTION fn_tr05_cap_nhat_tranh_chap() RETURNS TRIGGER AS $$
DECLARE
    v_tt_hd VARCHAR(30);
BEGIN
    IF NEW.trang_thai = 'RESOLVED' AND OLD.trang_thai <> 'RESOLVED' THEN
        NEW.ngay_dong := now();
        SELECT trang_thai INTO v_tt_hd FROM hoa_don WHERE id = NEW.hoa_don_id;
        -- Nếu không phải Resolved do duyệt ngoại lệ (hóa đơn chưa chuyển RECONCILED), đưa về CHUA_DOI_SOAT
        IF v_tt_hd <> 'RECONCILED' THEN
            UPDATE hoa_don SET trang_thai = 'CHUA_DOI_SOAT' WHERE id = NEW.hoa_don_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr05_cap_nhat_tranh_chap ON tranh_chap;
CREATE TRIGGER tr05_cap_nhat_tranh_chap
    BEFORE UPDATE ON tranh_chap
    FOR EACH ROW EXECUTE FUNCTION fn_tr05_cap_nhat_tranh_chap();

-- TR-07: Bảo vệ hóa đơn đã RECONCILED và tự động gán theo_ngoai_le (BR-04, BR-18, BR-23)
CREATE OR REPLACE FUNCTION fn_tr07_bao_ve_hoa_don() RETURNS TRIGGER AS $$
DECLARE
    v_duyet_ngoai_le BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.trang_thai = 'RECONCILED' THEN
            RAISE EXCEPTION 'Hóa đơn đã Reconciled không được phép xóa (BR-04)';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.trang_thai = 'RECONCILED' THEN
        RAISE EXCEPTION 'Hóa đơn đã Reconciled, bị khóa không được sửa (BR-04)';
    END IF;

    IF NEW.trang_thai = 'RECONCILED' AND OLD.trang_thai <> 'RECONCILED' THEN
        SELECT EXISTS (
            SELECT 1 FROM yeu_cau_duyet_ngoai_le
            WHERE hoa_don_id = NEW.id AND trang_thai = 'DUYET'
        ) INTO v_duyet_ngoai_le;

        IF v_duyet_ngoai_le THEN
            NEW.theo_ngoai_le := TRUE;
        ELSIF OLD.trang_thai <> 'MATCHED' THEN
            RAISE EXCEPTION 'Chỉ hóa đơn MATCHED hoặc đã được duyệt ngoại lệ mới chuyển sang RECONCILED (BR-18)';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr07_bao_ve_hoa_don ON hoa_don;
CREATE TRIGGER tr07_bao_ve_hoa_don
    BEFORE UPDATE OR DELETE ON hoa_don
    FOR EACH ROW EXECUTE FUNCTION fn_tr07_bao_ve_hoa_don();

-- TR-08 / TR-09: Kiểm tra điều kiện gửi yêu cầu duyệt ngoại lệ (BR-22)
CREATE OR REPLACE FUNCTION fn_tr08_kiem_tra_yeu_cau_duyet() RETURNS TRIGGER AS $$
DECLARE
    v_muc_lech  NUMERIC(18, 2);
    v_lech_lon  BOOLEAN;
    v_han_muc   NUMERIC(18, 2);
    v_tt_tc     VARCHAR(30);
BEGIN
    SELECT trang_thai INTO v_tt_tc FROM tranh_chap WHERE id = NEW.tranh_chap_id;
    IF v_tt_tc = 'RESOLVED' THEN
        RAISE EXCEPTION 'Tranh chấp đã đóng, không thể gửi yêu cầu duyệt ngoại lệ (BR-22)';
    END IF;

    SELECT l.muc_lech_tien, l.lech_lon, c.han_muc_duyet
    INTO v_muc_lech, v_lech_lon, v_han_muc
    FROM lan_doi_soat l
    JOIN cau_hinh_doi_soat c ON c.id = l.cau_hinh_id
    WHERE l.id = NEW.lan_doi_soat_id;

    IF NOT COALESCE(v_lech_lon, FALSE) THEN
        RAISE EXCEPTION 'Hóa đơn không thuộc diện lệch lớn để trình duyệt ngoại lệ (BR-22)';
    END IF;

    IF v_muc_lech IS NOT NULL AND v_muc_lech > v_han_muc THEN
        RAISE EXCEPTION 'Mức lệch (%) vượt hạn mức được phép duyệt ngoại lệ (%) (BR-22)', v_muc_lech, v_han_muc;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr08_kiem_tra_yeu_cau_duyet ON yeu_cau_duyet_ngoai_le;
CREATE TRIGGER tr08_kiem_tra_yeu_cau_duyet
    BEFORE INSERT ON yeu_cau_duyet_ngoai_le
    FOR EACH ROW EXECUTE FUNCTION fn_tr08_kiem_tra_yeu_cau_duyet();

-- TR-11: Ghi Audit Trail tự động ở tầng CSDL & Chặn sửa/xóa bảng audit_log (NF-12, F-13)
CREATE OR REPLACE FUNCTION fn_ghi_audit_log() RETURNS TRIGGER AS $$
DECLARE
    v_uid INT;
    v_id  INT;
BEGIN
    BEGIN
        v_uid := NULLIF(current_setting('app.user_id', true), '')::INT;
    EXCEPTION WHEN OTHERS THEN
        v_uid := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        v_id := OLD.id;
        INSERT INTO audit_log(nguoi_dung_id, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_cu, du_lieu_moi)
        VALUES (v_uid, TG_OP, TG_TABLE_NAME, v_id, to_jsonb(OLD), NULL);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_id := NEW.id;
        INSERT INTO audit_log(nguoi_dung_id, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_cu, du_lieu_moi)
        VALUES (v_uid, TG_OP, TG_TABLE_NAME, v_id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_id := NEW.id;
        INSERT INTO audit_log(nguoi_dung_id, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_cu, du_lieu_moi)
        VALUES (v_uid, TG_OP, TG_TABLE_NAME, v_id, NULL, to_jsonb(NEW));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'nguoi_dung',
        'thong_tin_cong_ty',
        'cau_hinh_doi_soat',
        'nha_cung_cap',
        'don_hang_po',
        'phieu_kho',
        'hoa_don',
        'lan_doi_soat',
        'tranh_chap',
        'yeu_cau_duyet_ngoai_le'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_audit_%I ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER tr_audit_%I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_ghi_audit_log()',
            t, t
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION fn_chan_sua_xoa_audit_log() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Bảng audit_log là bất biến, không được phép sửa hoặc xóa (NF-12)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bao_ve_audit_log ON audit_log;
CREATE TRIGGER tr_bao_ve_audit_log
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION fn_chan_sua_xoa_audit_log();

COMMIT;
