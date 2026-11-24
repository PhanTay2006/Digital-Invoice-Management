"""Script nạp dữ liệu demo chuẩn B2B ngành Bánh kẹo (PO-2026-101..105) cho Cô Kim Anh xem.
Chạy:
  python seed_demo_co_kim_anh.py                 # Thêm/đảm bảo dữ liệu PO-2026-101..105 (không xóa dữ liệu đang có)
  python seed_demo_co_kim_anh.py --reset         # Dọn sạch chứng từ thử nghiệm và nạp lại từ đầu sạch đẹp
  python seed_demo_co_kim_anh.py --reset --fix-seed-buyer  # Kèm cập nhật tên/MST bên mua cho HD-0457 gốc
"""
import argparse
import os
import bcrypt
from sqlalchemy import create_engine, text

DB_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://app:app@localhost:5432/doisoat")


def ensure_base_accounts_and_config(c):
    pw = bcrypt.hashpw(b"Matkhau@123", bcrypt.gensalt()).decode()
    c.execute(text("ALTER TABLE nguoi_dung DROP CONSTRAINT IF EXISTS nguoi_dung_vai_tro_check"))
    c.execute(text(
        "ALTER TABLE nguoi_dung ADD CONSTRAINT nguoi_dung_vai_tro_check "
        "CHECK (vai_tro IN ('MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI', 'TOAN_QUYEN'))"
    ))
    accounts = [
        ("admin", "Quản trị Hệ thống", "QUAN_TRI"),
        ("muahang", "Nguyễn Văn Mua", "MUA_HANG"),
        ("thukho", "Trần Thủ Kho", "THU_KHO"),
        ("ketoan", "Lê Kế Toán AP", "KE_TOAN_AP"),
        ("quanly", "Phạm Kế Toán Trưởng", "QUAN_LY"),
        ("tester", "Võ Việt Hoàng (QA Toàn quyền)", "TOAN_QUYEN"),
    ]
    ids = {}
    for username, full_name, role in accounts:
        uid = c.execute(text("SELECT id FROM nguoi_dung WHERE ten_dang_nhap=:t"), {"t": username}).scalar()
        if not uid:
            uid = c.execute(
                text(
                    "INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro,hoat_dong) "
                    "VALUES(:t,:p,:h,:v,TRUE) RETURNING id"
                ),
                {"t": username, "p": pw, "h": full_name, "v": role},
            ).scalar()
        else:
            c.execute(text("UPDATE nguoi_dung SET hoat_dong=TRUE WHERE id=:i"), {"i": uid})
        ids[username] = uid

    if not c.execute(text("SELECT 1 FROM cau_hinh_doi_soat")).first():
        c.execute(
            text(
                "INSERT INTO cau_hinh_doi_soat(dung_sai_don_gia_pct,nguong_lech_lon_pct,nguong_lech_lon_tien,han_muc_duyet,nguoi_cau_hinh_id) "
                "VALUES(2,5,5000000,10000000,:u)"
            ),
            {"u": ids["admin"]},
        )
    else:
        c.execute(
            text(
                "INSERT INTO cau_hinh_doi_soat(dung_sai_don_gia_pct,nguong_lech_lon_pct,nguong_lech_lon_tien,han_muc_duyet,nguoi_cau_hinh_id) "
                "VALUES(2,5,5000000,10000000,:u)"
            ),
            {"u": ids["admin"]},
        )

    c.execute(text("""
        UPDATE thong_tin_cong_ty
        SET ten_cong_ty='CÔNG TY CỔ PHẦN BÁNH VIỆT NAM',
            ten_tieng_anh='VIETNAM BAKERY JOINT STOCK COMPANY',
            ten_viet_tat='BANH VN JSC',
            mst='0108666888',
            ma_cqt_quan_ly='70115'
        WHERE id = (SELECT id FROM thong_tin_cong_ty ORDER BY id DESC LIMIT 1)
    """))
    return ids


def reset_transactional_data(c):
    # Tạm vô hiệu hóa trigger chặn xóa trên phieu_kho và hoa_don khi QA reset dữ liệu demo
    c.execute(text("ALTER TABLE phieu_kho DISABLE TRIGGER tr_kiem_tra_phieu_kho"))
    c.execute(text("ALTER TABLE hoa_don DISABLE TRIGGER tr07_bao_ve_hoa_don"))
    try:
        c.execute(text("""
            TRUNCATE TABLE
                thong_bao,
                yeu_cau_duyet_ngoai_le,
                lich_su_tranh_chap,
                tranh_chap,
                lan_doi_soat,
                dong_hoa_don,
                hoa_don,
                dong_phieu_kho,
                phieu_kho,
                dong_po,
                don_hang_po,
                anh_xa_sku,
                nha_cung_cap
            RESTART IDENTITY CASCADE
        """))
    finally:
        c.execute(text("ALTER TABLE phieu_kho ENABLE TRIGGER tr_kiem_tra_phieu_kho"))
        c.execute(text("ALTER TABLE hoa_don ENABLE TRIGGER tr07_bao_ve_hoa_don"))


def seed_all(reset: bool = False, fix_seed_buyer: bool = False):
    engine = create_engine(DB_URL, pool_pre_ping=True)
    with engine.begin() as c:
        ids = ensure_base_accounts_and_config(c)
        c.execute(text("SELECT set_config('app.user_id', :u, true)"), {"u": str(ids["admin"])})

        if reset:
            reset_transactional_data(c)

        # 1. Nhà cung cấp gốc (Công ty ABC) + PO-2026-001 + GRN-001 + HD-0457
        ncc_abc = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst='0312345678'")).scalar()
        if not ncc_abc:
            ncc_abc = c.execute(
                text("INSERT INTO nha_cung_cap(ten,mst,dia_chi) VALUES('Công ty ABC','0312345678','Quận 1, TP. Hồ Chí Minh') RETURNING id")
            ).scalar()
        if not c.execute(text("SELECT 1 FROM anh_xa_sku WHERE nha_cung_cap_id=:n AND ma_sku_ncc='ABC-01'"), {"n": ncc_abc}).first():
            c.execute(
                text("INSERT INTO anh_xa_sku(nha_cung_cap_id,ma_sku_ncc,ma_sku_noi_bo,ten_san_pham) VALUES(:n,'ABC-01','SKU-01','Thiết bị 5G tiêu chuẩn')"),
                {"n": ncc_abc},
            )
        po001 = c.execute(text("SELECT id FROM don_hang_po WHERE so_po='PO-2026-001'")).scalar()
        if not po001:
            po001 = c.execute(
                text("INSERT INTO don_hang_po(so_po,nha_cung_cap_id,ngay_dat,loai_po,dieu_khoan_tt,tien_coc,tong_tien,nguoi_tao_id) VALUES('PO-2026-001',:n,'2026-10-01','HANG_HOA','Net 30',0,100000000,:u) RETURNING id"),
                {"n": ncc_abc, "u": ids["muahang"]},
            ).scalar()
            dp001 = c.execute(
                text("INSERT INTO dong_po(po_id,ma_sku,mo_ta,so_luong_dat,don_gia) VALUES(:p,'SKU-01','Thiết bị 5G tiêu chuẩn',100,1000000) RETURNING id"),
                {"p": po001},
            ).scalar()
            grn001 = c.execute(
                text("INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,ten_don_vi,mst_don_vi,nguoi_lap_id) VALUES('GRN-001',:p,'2026-10-05','CONFIRMED','CÔNG TY CỔ PHẦN BÁNH VIỆT NAM','0108666888',:u) RETURNING id"),
                {"p": po001, "u": ids["thukho"]},
            ).scalar()
            c.execute(text("INSERT INTO dong_phieu_kho(phieu_kho_id,dong_po_id,so_nhan,so_dat,so_tu_choi) VALUES(:k,:d,100,100,0)"), {"k": grn001, "d": dp001})
            hd0457 = c.execute(
                text("""INSERT INTO hoa_don(so_hoa_don,nha_cung_cap_id,po_id,ngay_lap,tong_truoc_vat,vat,tien_coc_tru,tong_thanh_toan,ten_nguoi_mua,mst_nguoi_mua,nguoi_tao_id)
                        VALUES('HD-0457',:n,:p,'2026-10-10',105000000,10500000,0,115500000,:ten_mua,:mst_mua,:u) RETURNING id"""),
                {
                    "n": ncc_abc, "p": po001,
                    "ten_mua": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM" if fix_seed_buyer else None,
                    "mst_mua": "0108666888" if fix_seed_buyer else None,
                    "u": ids["ketoan"],
                },
            ).scalar()
            c.execute(text("INSERT INTO dong_hoa_don(hoa_don_id,dong_po_id,ma_sku_ncc,ten_san_pham,so_luong,don_gia,thanh_tien) VALUES(:h,:d,'ABC-01','Thiết bị 5G tiêu chuẩn',100,1050000,105000000)"), {"h": hd0457, "d": dp001})

        # 2. Ba nhà cung cấp B2B cho bộ mẫu Hóa đơn & Phiếu nhập kho demo
        nccs = [
            ("CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU", "0314567890", "120 Lê Trọng Tấn, Q. Tân Phú, TP.HCM"),
            ("CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT", "0316789012", "KCN Tân Bình, Q. Tân Bình, TP.HCM"),
            ("CÔNG TY TNHH KỸ THUẬT LÒ NƯỚNG ĐÔNG DƯƠNG", "0318901234", "KCN Sóng Thần 1, Dĩ An, Bình Dương"),
        ]
        ncc_ids = {}
        for ten, mst, dia_chi in nccs:
            nid = c.execute(text("SELECT id FROM nha_cung_cap WHERE mst=:m"), {"m": mst}).scalar()
            if not nid:
                nid = c.execute(
                    text("INSERT INTO nha_cung_cap(ten,mst,dia_chi) VALUES(:t,:m,:d) RETURNING id"),
                    {"t": ten, "m": mst, "d": dia_chi},
                ).scalar()
            ncc_ids[mst] = nid

        sku_maps = [
            (ncc_ids["0314567890"], "AC-BOTMI-01", "SKU-BM01", "Bột mì đa dụng thượng hạng"),
            (ncc_ids["0314567890"], "AC-BOLAT-02", "SKU-BO02", "Bơ lạt nhập khẩu Anchor"),
            (ncc_ids["0316789012"], "NV-HOPBANH-01", "SKU-HB01", "Hộp giấy đựng bánh cao cấp"),
            (ncc_ids["0318901234"], "DD-BAOTRI-01", "SKU-DV01", "Bảo trì dây chuyền lò nướng công nghiệp"),
        ]
        for nid, sku_ncc, sku_nb, ten_sp in sku_maps:
            if not c.execute(text("SELECT 1 FROM anh_xa_sku WHERE nha_cung_cap_id=:n AND ma_sku_ncc=:s"), {"n": nid, "s": sku_ncc}).first():
                c.execute(
                    text("INSERT INTO anh_xa_sku(nha_cung_cap_id,ma_sku_ncc,ma_sku_noi_bo,ten_san_pham) VALUES(:n,:sn,:sb,:tsp)"),
                    {"n": nid, "sn": sku_ncc, "sb": sku_nb, "tsp": ten_sp},
                )

        # 3. 5 Đơn đặt hàng PO-2026-101..105 phục vụ 5 kịch bản demo độc lập
        def ensure_po(so_po, mst_ncc, ngay_dat, loai_po, tien_coc, lines):
            pid = c.execute(text("SELECT id FROM don_hang_po WHERE so_po=:s"), {"s": so_po}).scalar()
            if pid:
                return pid, {
                    r["ma_sku"]: r["id"]
                    for r in c.execute(text("SELECT id, ma_sku FROM dong_po WHERE po_id=:p"), {"p": pid}).mappings()
                }
            tong = sum(sl * dg for _, _, sl, dg in lines)
            pid = c.execute(
                text("""INSERT INTO don_hang_po(so_po,nha_cung_cap_id,ngay_dat,loai_po,dieu_khoan_tt,tien_coc,tong_tien,nguoi_tao_id)
                        VALUES(:s,:n,:nd,:lp,'Net 30',:coc,:tt,:u) RETURNING id"""),
                {"s": so_po, "n": ncc_ids[mst_ncc], "nd": ngay_dat, "lp": loai_po, "coc": tien_coc, "tt": tong, "u": ids["muahang"]},
            ).scalar()
            dmap = {}
            for sku, mo_ta, sl, dg in lines:
                dmap[sku] = c.execute(
                    text("INSERT INTO dong_po(po_id,ma_sku,mo_ta,so_luong_dat,don_gia) VALUES(:p,:sk,:mt,:sl,:dg) RETURNING id"),
                    {"p": pid, "sk": sku, "mt": mo_ta, "sl": sl, "dg": dg},
                ).scalar()
            return pid, dmap

        # PO-2026-101: Chưa có GRN -> demo Upload GRN_DUNG_01 rồi Upload HD_DUNG_01 / HD_SAI_02,04,05
        ensure_po("PO-2026-101", "0314567890", "2026-10-01", "HANG_HOA", 0, [
            ("SKU-BM01", "Bột mì đa dụng thượng hạng", 200, 350000),
            ("SKU-BO02", "Bơ lạt nhập khẩu Anchor", 30, 1000000),
        ])

        # PO-2026-102: Chưa có GRN -> demo Upload GRN_DUNG_02 (Partial 500/1000) -> HD_DUNG_03 (PARTIAL) & HD_SAI_03 -> Upload GRN_DUNG_03
        ensure_po("PO-2026-102", "0316789012", "2026-10-03", "HANG_HOA", 0, [
            ("SKU-HB01", "Hộp giấy đựng bánh cao cấp", 1000, 100000),
        ])

        # PO-2026-103: Có sẵn cọc 20tr + GRN-2026-103 đủ 100 -> demo dung sai +1.5% & trừ cọc (HD_DUNG_02 vs HD_SAI_06)
        po103, dpo103 = ensure_po("PO-2026-103", "0314567890", "2026-10-05", "HANG_HOA", 20000000, [
            ("SKU-BO02", "Bơ lạt nhập khẩu Anchor", 100, 1000000),
        ])
        if not c.execute(text("SELECT 1 FROM phieu_kho WHERE so_phieu='GRN-2026-103'")).first():
            grn103 = c.execute(
                text("INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,ten_don_vi,mst_don_vi,nguoi_lap_id) VALUES('GRN-2026-103',:p,'2026-10-08','CONFIRMED','CÔNG TY CỔ PHẦN BÁNH VIỆT NAM','0108666888',:u) RETURNING id"),
                {"p": po103, "u": ids["thukho"]},
            ).scalar()
            c.execute(text("INSERT INTO dong_phieu_kho(phieu_kho_id,dong_po_id,so_nhan,so_dat,so_tu_choi) VALUES(:k,:d,100,100,0)"), {"k": grn103, "d": dpo103["SKU-BO02"]})

        # PO-2026-104: PO Dịch vụ -> demo 2-Way Matching (HD_DUNG_04) & Trigger chặn lập GRN (GRN_SAI_04)
        ensure_po("PO-2026-104", "0318901234", "2026-10-08", "DICH_VU", 0, [
            ("SKU-DV01", "Bảo trì dây chuyền lò nướng công nghiệp", 1, 50000000),
        ])

        # PO-2026-105: Có sẵn GRN-2026-105 đủ 100 -> demo Lệch lớn 6tr (HD_SAI_01) -> Tranh chấp -> Duyệt ngoại lệ
        po105, dpo105 = ensure_po("PO-2026-105", "0314567890", "2026-10-10", "HANG_HOA", 0, [
            ("SKU-BO02", "Bơ lạt nhập khẩu Anchor", 100, 1000000),
        ])
        if not c.execute(text("SELECT 1 FROM phieu_kho WHERE so_phieu='GRN-2026-105'")).first():
            grn105 = c.execute(
                text("INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,ten_don_vi,mst_don_vi,nguoi_lap_id) VALUES('GRN-2026-105',:p,'2026-10-12','CONFIRMED','CÔNG TY CỔ PHẦN BÁNH VIỆT NAM','0108666888',:u) RETURNING id"),
                {"p": po105, "u": ids["thukho"]},
            ).scalar()
            c.execute(text("INSERT INTO dong_phieu_kho(phieu_kho_id,dong_po_id,so_nhan,so_dat,so_tu_choi) VALUES(:k,:d,100,100,0)"), {"k": grn105, "d": dpo105["SKU-BO02"]})

    print(f"Đã nạp dữ liệu demo thành công! (reset={reset}, fix_seed_buyer={fix_seed_buyer})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="Xóa dữ liệu giao dịch cũ và nạp mới toàn bộ dữ liệu demo")
    parser.add_argument("--fix-seed-buyer", action="store_true", help="Điền sẵn tên/MST bên mua cho HD-0457 mẫu gốc")
    args = parser.parse_args()
    seed_all(reset=args.reset, fix_seed_buyer=args.fix_seed_buyer)
