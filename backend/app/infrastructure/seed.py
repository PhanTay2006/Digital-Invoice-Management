"""Dữ liệu mẫu (kịch bản HD-0457). Chạy: docker compose exec api python -m app.infrastructure.seed"""
import bcrypt
from sqlalchemy import text
from ..core.common import engine

pw = bcrypt.hashpw(b"Matkhau@123", bcrypt.gensalt()).decode()
with engine.begin() as c:
    c.execute(text("ALTER TABLE nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check"))
    c.execute(text("ALTER TABLE nguoi_dung ADD CONSTRAINT nguoi_dung_vai_tro_check CHECK (vai_tro IN ('MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI', 'TOAN_QUYEN'))"))
    c.execute(text("ALTER TABLE anh_xa_sku ADD COLUMN IF NOT EXISTS ten_san_pham VARCHAR(255)"))
    c.execute(text("ALTER TABLE dong_hoa_don ADD COLUMN IF NOT EXISTS ten_san_pham VARCHAR(255)"))
    if not c.execute(text("SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap='admin'")).first():
        ids = {}
        for t, hten, vt in [("admin", "Quản trị", "QUAN_TRI"), ("muahang", "Mua hàng", "MUA_HANG"), ("thukho", "Thủ kho", "THU_KHO"),
                            ("ketoan", "Kế toán AP", "KE_TOAN_AP"), ("quanly", "Quản lý", "QUAN_LY")]:
            ids[t] = c.execute(text("INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro) VALUES(:t,:p,:h,:v) RETURNING id"),
                               {"t": t, "p": pw, "h": hten, "v": vt}).scalar()
        c.execute(text("INSERT INTO cau_hinh_doi_soat(dung_sai_don_gia_pct,nguong_lech_lon_pct,nguong_lech_lon_tien,han_muc_duyet,nguoi_cau_hinh_id) VALUES(2,5,5000000,10000000,:u)"), {"u": ids["admin"]})
        ncc = c.execute(text("INSERT INTO nha_cung_cap(ten,mst) VALUES('Công ty ABC','0312345678') RETURNING id")).scalar()
        c.execute(text("INSERT INTO anh_xa_sku(nha_cung_cap_id,ma_sku_ncc,ma_sku_noi_bo,ten_san_pham) VALUES(:n,'ABC-01','SKU-01','Thiết bị 5G tiêu chuẩn')"), {"n": ncc})
        po = c.execute(text("INSERT INTO don_hang_po(so_po,nha_cung_cap_id,ngay_dat,loai_po,tong_tien,nguoi_tao_id) VALUES('PO-2026-001',:n,'2026-10-01','HANG_HOA',100000000,:u) RETURNING id"), {"n": ncc, "u": ids["muahang"]}).scalar()
        dp = c.execute(text("INSERT INTO dong_po(po_id,ma_sku,mo_ta,so_luong_dat,don_gia) VALUES(:p,'SKU-01','Thiết bị 5G tiêu chuẩn',100,1000000) RETURNING id"), {"p": po}).scalar()
        k = c.execute(text("INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,nguoi_lap_id) VALUES('GRN-001',:p,'2026-10-05','CONFIRMED',:u) RETURNING id"), {"p": po, "u": ids["thukho"]}).scalar()
        c.execute(text("INSERT INTO dong_phieu_kho(phieu_kho_id,dong_po_id,so_nhan,so_dat,so_tu_choi) VALUES(:k,:d,100,100,0)"), {"k": k, "d": dp})
        hd = c.execute(text("""INSERT INTO hoa_don(so_hoa_don,nha_cung_cap_id,po_id,ngay_lap,tong_truoc_vat,vat,tong_thanh_toan,nguoi_tao_id)
            VALUES('HD-0457',:n,:p,'2026-10-10',105000000,10500000,115500000,:u) RETURNING id"""), {"n": ncc, "p": po, "u": ids["ketoan"]}).scalar()
        c.execute(text("INSERT INTO dong_hoa_don(hoa_don_id,dong_po_id,ma_sku_ncc,ten_san_pham,so_luong,don_gia,thanh_tien) VALUES(:h,:d,'ABC-01','Thiết bị 5G tiêu chuẩn',100,1050000,105000000)"), {"h": hd, "d": dp})
    if not c.execute(text("SELECT 1 FROM nguoi_dung WHERE ten_dang_nhap='tester'")).first():
        c.execute(text("INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro) VALUES('tester',:p,'Kiểm thử Toàn quyền','TOAN_QUYEN')"), {"p": pw})
print("Xong. Đăng nhập: tester (toàn quyền) hoặc admin|muahang|thukho|ketoan|quanly, mật khẩu Matkhau@123")
