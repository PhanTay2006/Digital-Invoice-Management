"""Lõi đối soát 3 chiều (F-07): hàm thuần, không phụ thuộc CSDL nên test được."""
from dataclasses import dataclass
from decimal import Decimal as D
from .company import doi_chieu_cong_ty


@dataclass
class Cau_hinh:
    dung_sai_don_gia_pct: D
    nguong_lech_lon_pct: D
    nguong_lech_lon_tien: D
    han_muc_duyet: D


def doi_soat(hd, dong_hd, po, dong_po, so_dat_luy_ke, cfg, cong_ty=None, phieu_kho_list=None):
    """hd/po: dict; dong_hd: list dict (dong_po_id, so_luong, don_gia, thanh_tien);
    dong_po: {id: {so_luong_dat, don_gia}}; so_dat_luy_ke: {dong_po_id: số đạt}.
    cong_ty: optional dict hồ sơ pháp lý Công ty Bên mua để kiểm tra bước (f).
    phieu_kho_list: optional list dict phiếu nhập kho liên kết PO để đối chiếu tên/MST đơn vị.
    Trả về dict: ket_qua, lech_lon, muc_lech_tien, chi_tiet_buoc."""
    buoc, lech_tien, lech_pct, partial = [], D(0), D(0), False

    def them(ma, dat, v_hd, v_ref, ly_do=""):
        buoc.append({"ma_buoc": ma, "dat": dat, "gia_tri_hoa_don": str(v_hd), "gia_tri_tham_chieu": str(v_ref), "ly_do": "" if dat else ly_do})

    # (a) NCC trên hóa đơn khớp NCC của PO
    them("a", hd["nha_cung_cap_id"] == po["nha_cung_cap_id"], hd["nha_cung_cap_id"], po["nha_cung_cap_id"], "Nhà cung cấp không khớp PO")

    # (b) mọi dòng hóa đơn ánh xạ được SKU sang dòng PO
    chua_anh_xa = [d for d in dong_hd if d["dong_po_id"] is None]
    them("b", not chua_anh_xa, len(chua_anh_xa), 0, "Có dòng chưa ánh xạ được SKU")
    co_dong = [d for d in dong_hd if d["dong_po_id"] is not None]

    # (c) số lượng: không dung sai; PO hàng hóa so thêm với số đạt trên phiếu kho
    sl_ok, sl_ly_do, sl_hd_t, sl_ref_t = True, "", D(0), D(0)
    for d in co_dong:
        p = dong_po[d["dong_po_id"]]
        tran = p["so_luong_dat"]
        ref = tran if po["loai_po"] == "DICH_VU" else so_dat_luy_ke.get(d["dong_po_id"], D(0))
        sl_hd_t += d["so_luong"]; sl_ref_t += ref
        if d["so_luong"] > tran:
            sl_ok, sl_ly_do = False, "Số lượng hóa đơn vượt PO"
            lech_tien += (d["so_luong"] - tran) * p["don_gia"]
        elif d["so_luong"] > ref:
            sl_ok, sl_ly_do = False, "Số lượng hóa đơn vượt số đã nhập kho"
            lech_tien += (d["so_luong"] - ref) * p["don_gia"]
        elif ref < tran:
            partial = True  # hàng chưa về đủ nhưng hóa đơn không vượt số đã nhận
    them("c", sl_ok, sl_hd_t, sl_ref_t, sl_ly_do)

    # (d) đơn giá trong dung sai %
    gia_ok, gia_ly_do = True, ""
    for d in co_dong:
        pg = dong_po[d["dong_po_id"]]["don_gia"]
        if pg == 0:
            continue
        pct = abs(d["don_gia"] - pg) / pg * 100
        if pct > cfg.dung_sai_don_gia_pct:
            gia_ok, gia_ly_do = False, f"Đơn giá lệch {pct:.0f}% > dung sai {cfg.dung_sai_don_gia_pct}%"
            lech_tien += abs(d["don_gia"] - pg) * d["so_luong"]
            lech_pct = max(lech_pct, pct)
    them("d", gia_ok, "", "", gia_ly_do)

    # (e) tổng tiền, VAT, cọc
    tong = sum((d["thanh_tien"] for d in dong_hd), D(0))
    e_ok = (tong == hd["tong_truoc_vat"]
            and hd["tong_thanh_toan"] == hd["tong_truoc_vat"] + hd["vat"] - hd["tien_coc_tru"]
            and hd["tien_coc_tru"] <= po["tien_coc"])
    them("e", e_ok, hd["tong_thanh_toan"], tong + hd["vat"] - hd["tien_coc_tru"], "Tổng tiền/VAT/cọc không khớp")

    # (f) thông tin công ty mình trên hóa đơn (và phiếu nhập kho nếu có) khớp Hồ sơ Thông tin công ty
    if cong_ty is not None:
        kt_cty = doi_chieu_cong_ty(
            hd.get("ten_nguoi_mua"),
            hd.get("mst_nguoi_mua"),
            cong_ty,
            bat_buoc_ten=True,
        )
        grn_errors: list[str] = []
        grn_notes: list[str] = []
        if po.get("loai_po", "HANG_HOA") == "HANG_HOA":
            for pk in phieu_kho_list or []:
                ten_pk = pk.get("ten_don_vi")
                mst_pk = pk.get("mst_don_vi")
                if ten_pk or mst_pk:
                    kt_pk = doi_chieu_cong_ty(ten_pk, mst_pk, cong_ty, bat_buoc_ten=False)
                    if not kt_pk["dat"]:
                        so_p = pk.get("so_phieu") or f"#{pk.get('id', '?')}"
                        grn_errors.append(f"Phiếu kho {so_p}: {kt_pk['thong_bao']}")
                        grn_notes.append(
                            f"GRN {so_p}: {ten_pk or '—'}" + (f" (MST: {mst_pk})" if mst_pk else "")
                        )

        hd_display = " | ".join(
            x for x in (
                kt_cty.get("ten_tren_phieu"),
                f"MST: {kt_cty['mst_tren_phieu']}" if kt_cty.get("mst_tren_phieu") else None,
            ) if x
        ) or "Chưa ghi trên hóa đơn"
        if grn_notes:
            hd_display = f"{hd_display} || {'; '.join(grn_notes)}"

        reasons: list[str] = []
        if not kt_cty["dat"]:
            reasons.append(kt_cty["thong_bao"])
        reasons.extend(grn_errors)

        f_ok = bool(kt_cty["dat"] and not grn_errors)
        gia_tri_tc = f"{kt_cty['ten_cong_ty']} | MST: {kt_cty['mst_cong_ty']}"
        them("f", f_ok, hd_display, gia_tri_tc, "; ".join(reasons))

    dat_het = all(b["dat"] for b in buoc)
    ket_qua = "PARTIAL" if dat_het and partial else "MATCHED" if dat_het else "MISMATCH"
    lech_lon = ket_qua == "MISMATCH" and (lech_pct >= cfg.nguong_lech_lon_pct or lech_tien >= cfg.nguong_lech_lon_tien)
    return {"ket_qua": ket_qua, "lech_lon": lech_lon, "muc_lech_tien": lech_tien if lech_tien else None, "chi_tiet_buoc": buoc}
