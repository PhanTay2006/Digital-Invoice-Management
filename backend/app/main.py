from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .core.common import engine
from .domain.company import DEFAULT_COMPANY_INFO
from .api import admin, auth, disputes, documents, matching, reports, upload

app = FastAPI(title="Hệ thống đối soát hóa đơn B2B")


@app.on_event("startup")
def ensure_schema_columns():
    try:
        with engine.begin() as c:
            c.execute(text("ALTER TABLE anh_xa_sku ADD COLUMN IF NOT EXISTS ten_san_pham VARCHAR(255)"))
            c.execute(text("ALTER TABLE dong_hoa_don ADD COLUMN IF NOT EXISTS ten_san_pham VARCHAR(255)"))
            c.execute(text("ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS ten_nguoi_mua VARCHAR(255)"))
            c.execute(text("ALTER TABLE hoa_don ADD COLUMN IF NOT EXISTS mst_nguoi_mua VARCHAR(20)"))
            c.execute(text("ALTER TABLE phieu_kho ADD COLUMN IF NOT EXISTS ten_don_vi VARCHAR(255)"))
            c.execute(text("ALTER TABLE phieu_kho ADD COLUMN IF NOT EXISTS mst_don_vi VARCHAR(20)"))
            c.execute(text("""
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
                )
            """))
            has_cty = c.execute(text("SELECT 1 FROM thong_tin_cong_ty LIMIT 1")).first()
            if not has_cty:
                c.execute(text("""
                    INSERT INTO thong_tin_cong_ty (
                        ten_cong_ty, ten_tieng_anh, ten_viet_tat, loai_hinh_dn,
                        mst, ma_cqt_quan_ly, co_quan_thue_quan_ly, dia_chi,
                        nguoi_dai_dien, chuc_vu_dai_dien, so_giay_phep_dkkd, ngay_cap_dkkd, noi_cap_dkkd,
                        so_tai_khoan, ngan_hang, dien_thoai, email, website
                    ) VALUES (
                        :ten_cong_ty, :ten_tieng_anh, :ten_viet_tat, :loai_hinh_dn,
                        :mst, :ma_cqt_quan_ly, :co_quan_thue_quan_ly, :dia_chi,
                        :nguoi_dai_dien, :chuc_vu_dai_dien, :so_giay_phep_dkkd, :ngay_cap_dkkd, :noi_cap_dkkd,
                        :so_tai_khoan, :ngan_hang, :dien_thoai, :email, :website
                    )
                """), DEFAULT_COMPANY_INFO)
            c.execute(text("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_ghi_audit_log') THEN
                        DROP TRIGGER IF EXISTS tr_audit_thong_tin_cong_ty ON thong_tin_cong_ty;
                        CREATE TRIGGER tr_audit_thong_tin_cong_ty
                            AFTER INSERT OR UPDATE OR DELETE ON thong_tin_cong_ty
                            FOR EACH ROW EXECUTE FUNCTION fn_ghi_audit_log();
                    END IF;
                END;
                $$;
            """))
    except Exception:
        pass

# Cho frontend Vite (localhost:5173) gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tất cả endpoint nằm dưới /api để khớp VITE_API_BASE_URL
for m in (auth, documents, matching, disputes, reports, admin, upload):
    app.include_router(m.router, prefix="/api")