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


def _fmt_so(val) -> str:
    """Định dạng số kiểu Việt Nam: bỏ .00 dư thừa, tách hàng nghìn bằng dấu chấm."""
    if val is None or val == "":
        return "0"
    d = D(str(val))
    d_norm = d.normalize()
    sign = "-" if d_norm < 0 else ""
    d_abs = abs(d_norm)
    # Tránh dạng khoa học như 1E+2 của Decimal.normalize()
    s = format(d_abs, "f")
    if "." in s:
        int_part, frac_part = s.split(".", 1)
        frac_part = frac_part.rstrip("0")
    else:
        int_part, frac_part = s, ""
    int_fmt = f"{int(int_part):,}".replace(",", ".")
    return f"{sign}{int_fmt},{frac_part}" if frac_part else f"{sign}{int_fmt}"


def _fmt_tien(val) -> str:
    return f"{_fmt_so(val)} ₫"


def _fmt_pct(val) -> str:
    return f"{_fmt_so(D(str(val)).quantize(D('0.01')))}%"


def _mo_ta_ncc(obj: dict) -> str:
    ten = (obj.get("ten_ncc") or "").strip()
    mst = (obj.get("mst_ncc") or "").strip()
    nid = obj.get("nha_cung_cap_id")
    if ten and mst:
        return f"{ten} (MST: {mst})"
    if ten:
        return ten
    return f"NCC #{nid}"


def doi_soat(hd, dong_hd, po, dong_po, so_dat_luy_ke, cfg, cong_ty=None, phieu_kho_list=None):
    """hd/po: dict; dong_hd: list dict (dong_po_id, so_luong, don_gia, thanh_tien);
    dong_po: {id: {so_luong_dat, don_gia}}; so_dat_luy_ke: {dong_po_id: số đạt}.
    cong_ty: optional dict hồ sơ pháp lý Công ty Bên mua để kiểm tra bước (f).
    phieu_kho_list: optional list dict phiếu nhập kho liên kết PO để đối chiếu tên/MST đơn vị.
    Trả về dict: ket_qua, lech_lon, muc_lech_tien, chi_tiet_buoc."""
    buoc, lech_tien, lech_pct, partial = [], D(0), D(0), False

    def them(ma, dat, v_hd, v_ref, ly_do="", ghi_chu_dat=""):
        buoc.append({
            "ma_buoc": ma,
            "dat": dat,
            "gia_tri_hoa_don": str(v_hd),
            "gia_tri_tham_chieu": str(v_ref),
            "ly_do": ghi_chu_dat if dat else ly_do,
        })

    # (a) NCC trên hóa đơn khớp NCC của PO
    a_ok = hd["nha_cung_cap_id"] == po["nha_cung_cap_id"]
    them(
        "a",
        a_ok,
        _mo_ta_ncc(hd),
        _mo_ta_ncc(po),
        "Nhà cung cấp trên Hóa đơn không khớp với PO tham chiếu",
    )

    # (b) mọi dòng hóa đơn ánh xạ được SKU sang dòng PO
    chua_anh_xa = [d for d in dong_hd if d["dong_po_id"] is None]
    co_dong = [d for d in dong_hd if d["dong_po_id"] is not None]
    n_tong = len(dong_hd)
    n_ok = len(co_dong)
    hd_skus = [str(d.get("ma_sku_ncc") or "").strip() for d in dong_hd if d.get("ma_sku_ncc")]
    unmapped_skus = [str(d.get("ma_sku_ncc") or "?").strip() for d in chua_anh_xa]
    po_skus = [str(v.get("ma_sku") or "").strip() for v in dong_po.values() if v.get("ma_sku")]

    if not chua_anh_xa:
        b_hd_str = f"Đã ánh xạ {n_ok}/{n_tong} dòng" + (f" ({', '.join(hd_skus)})" if hd_skus else "")
    else:
        b_hd_str = f"Chưa ánh xạ {len(chua_anh_xa)}/{n_tong} dòng ({', '.join(unmapped_skus)})"
    b_ref_str = f"{len(dong_po)} dòng PO" + (f" ({', '.join(po_skus)})" if po_skus else "")
    them(
        "b",
        not chua_anh_xa,
        b_hd_str,
        b_ref_str,
        f"Có {len(chua_anh_xa)} dòng hàng chưa ánh xạ được mã SKU sang PO ({', '.join(unmapped_skus)})",
    )

    # (c) số lượng: không dung sai; PO hàng hóa so thêm với số đạt trên phiếu kho
    sl_ok, sl_ly_do_list = True, []
    sl_hd_t, sl_ref_t, sl_po_t = D(0), D(0), D(0)
    loai_po = po.get("loai_po", "HANG_HOA")
    for d in co_dong:
        p = dong_po[d["dong_po_id"]]
        tran = D(str(p["so_luong_dat"]))
        ref = tran if loai_po == "DICH_VU" else D(str(so_dat_luy_ke.get(d["dong_po_id"], D(0))))
        sl_d = D(str(d["so_luong"]))
        sl_hd_t += sl_d
        sl_ref_t += ref
        sl_po_t += tran
        nhan_sp = d.get("ma_sku_ncc") or p.get("ma_sku") or f"Dòng #{d['dong_po_id']}"
        if sl_d > tran:
            sl_ok = False
            sl_ly_do_list.append(f"{nhan_sp}: SL hóa đơn ({_fmt_so(sl_d)}) vượt SL đặt PO ({_fmt_so(tran)})")
            lech_tien += (sl_d - tran) * D(str(p["don_gia"]))
        elif sl_d > ref:
            sl_ok = False
            sl_ly_do_list.append(f"{nhan_sp}: SL hóa đơn ({_fmt_so(sl_d)}) vượt SL nhập kho đạt ({_fmt_so(ref)})")
            lech_tien += (sl_d - ref) * D(str(p["don_gia"]))
        elif ref < tran:
            partial = True  # hàng chưa về đủ nhưng hóa đơn không vượt số đã nhận

    c_hd_str = f"{_fmt_so(sl_hd_t)} đơn vị"
    if loai_po == "DICH_VU":
        c_ref_str = f"PO Dịch vụ: {_fmt_so(sl_po_t)} đơn vị (bỏ qua GRN)"
    else:
        c_ref_str = f"Nhập kho đạt: {_fmt_so(sl_ref_t)} / Đặt PO: {_fmt_so(sl_po_t)}"
    c_note_ok = "Hợp lệ (Giao một phần — chờ nhập bổ sung)" if (sl_ok and partial) else ""
    them("c", sl_ok, c_hd_str, c_ref_str, "; ".join(sl_ly_do_list) or "Số lượng vượt mức cho phép", c_note_ok)

    # (d) đơn giá trong dung sai %
    gia_ok = True
    gia_ly_do_list = []
    gia_hd_parts = []
    gia_ref_parts = []
    ds_pct = D(str(cfg.dung_sai_don_gia_pct))
    max_pct_ok = D(0)

    for d in co_dong:
        p = dong_po[d["dong_po_id"]]
        pg = D(str(p["don_gia"]))
        dg_hd = D(str(d["don_gia"]))
        sku_hd = d.get("ma_sku_ncc") or p.get("ma_sku")
        sku_po = p.get("ma_sku") or d.get("ma_sku_ncc")
        gia_hd_parts.append(f"{sku_hd}: {_fmt_tien(dg_hd)}" if sku_hd else _fmt_tien(dg_hd))

        if pg == 0:
            gia_ref_parts.append(f"{sku_po}: 0 ₫" if sku_po else "0 ₫")
            continue

        tran_gia = pg * (D(100) + ds_pct) / D(100)
        gia_ref_parts.append(
            (f"{sku_po}: " if sku_po else "")
            + f"{_fmt_tien(pg)} (±{_fmt_pct(ds_pct)}, tối đa {_fmt_tien(tran_gia)})"
        )
        pct = abs(dg_hd - pg) / pg * D(100)
        if pct > ds_pct:
            gia_ok = False
            gia_ly_do_list.append(
                (f"{sku_hd}: " if sku_hd else "")
                + f"Đơn giá lệch {_fmt_pct(pct)} ({_fmt_tien(dg_hd)} so với {_fmt_tien(pg)}) > dung sai {_fmt_pct(ds_pct)}"
            )
            lech_tien += abs(dg_hd - pg) * D(str(d["so_luong"]))
            lech_pct = max(lech_pct, pct)
        else:
            max_pct_ok = max(max_pct_ok, pct)

    d_hd_str = " | ".join(gia_hd_parts) if gia_hd_parts else "Không có dòng ánh xạ"
    d_ref_str = " | ".join(gia_ref_parts) if gia_ref_parts else f"Dung sai cho phép: ±{_fmt_pct(ds_pct)}"
    d_note_ok = (
        f"Hợp lệ (lệch {_fmt_pct(max_pct_ok)} ≤ dung sai {_fmt_pct(ds_pct)})"
        if (gia_ok and co_dong and max_pct_ok > 0)
        else (f"Hợp lệ (khớp 100%, dung sai ±{_fmt_pct(ds_pct)})" if (gia_ok and co_dong) else "")
    )
    them("d", gia_ok, d_hd_str, d_ref_str, "; ".join(gia_ly_do_list) or "Đơn giá vượt ngưỡng dung sai", d_note_ok)

    # (e) tổng tiền, VAT, cọc
    tong = sum((D(str(d["thanh_tien"])) for d in dong_hd), D(0))
    truoc_vat = D(str(hd["tong_truoc_vat"]))
    vat_hd = D(str(hd["vat"]))
    coc_tru = D(str(hd["tien_coc_tru"]))
    tong_tt_hd = D(str(hd["tong_thanh_toan"]))
    coc_po = D(str(po["tien_coc"]))
    tong_tt_mong_doi = tong + vat_hd - coc_tru

    e_reasons = []
    if tong != truoc_vat:
        e_reasons.append(f"Tổng thành tiền các dòng ({_fmt_tien(tong)}) khác Tổng trước VAT ({_fmt_tien(truoc_vat)})")
    if tong_tt_hd != truoc_vat + vat_hd - coc_tru:
        e_reasons.append(
            f"Tổng thanh toán ({_fmt_tien(tong_tt_hd)}) khác Trước VAT + VAT - Cọc ({_fmt_tien(truoc_vat + vat_hd - coc_tru)})"
        )
    if coc_tru > coc_po:
        e_reasons.append(f"Tiền cọc khấu trừ ({_fmt_tien(coc_tru)}) vượt tiền cọc trên PO ({_fmt_tien(coc_po)})")
    e_ok = len(e_reasons) == 0

    e_hd_str = f"{_fmt_tien(tong_tt_hd)} (Trước VAT: {_fmt_tien(truoc_vat)} + VAT: {_fmt_tien(vat_hd)}"
    e_hd_str += f" - Cọc: {_fmt_tien(coc_tru)})" if coc_tru > 0 else ")"

    e_ref_str = f"{_fmt_tien(tong_tt_mong_doi)} (Tổng dòng: {_fmt_tien(tong)} + VAT: {_fmt_tien(vat_hd)}"
    if coc_tru > 0 or coc_po > 0:
        e_ref_str += f" - Cọc trừ: {_fmt_tien(coc_tru)} / Cọc PO: {_fmt_tien(coc_po)})"
    else:
        e_ref_str += ")"

    them("e", e_ok, e_hd_str, e_ref_str, "; ".join(e_reasons) or "Tổng tiền/VAT/cọc không khớp")

    # (f) thông tin công ty mình trên hóa đơn (và phiếu nhập kho nếu có) khớp Hồ sơ Thông tin công ty
    if cong_ty is not None:
        kt_cty = doi_chieu_cong_ty(
            hd.get("ten_nguoi_mua"),
            hd.get("mst_nguoi_mua"),
            cong_ty,
            bat_buoc_ten=True,
        )
        grn_errors: list[str] = []
        grn_summaries: list[str] = []
        if loai_po == "HANG_HOA":
            for pk in phieu_kho_list or []:
                ten_pk = pk.get("ten_don_vi")
                mst_pk = pk.get("mst_don_vi")
                so_p = pk.get("so_phieu") or f"#{pk.get('id', '?')}"
                if ten_pk or mst_pk:
                    kt_pk = doi_chieu_cong_ty(ten_pk, mst_pk, cong_ty, bat_buoc_ten=False)
                    grn_summaries.append(
                        f"{so_p}: {ten_pk or '—'}" + (f" (MST: {mst_pk})" if mst_pk else "")
                    )
                    if not kt_pk["dat"]:
                        grn_errors.append(f"Phiếu kho {so_p}: {kt_pk['thong_bao']}")

        hd_buyer_str = " | ".join(
            x for x in (
                kt_cty.get("ten_tren_phieu"),
                f"MST: {kt_cty['mst_tren_phieu']}" if kt_cty.get("mst_tren_phieu") else None,
            ) if x
        ) or "Chưa ghi trên hóa đơn"

        hd_display = f"HĐ: {hd_buyer_str}"
        if grn_summaries:
            hd_display = f"{hd_display} || Kho: {'; '.join(grn_summaries)}"

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
