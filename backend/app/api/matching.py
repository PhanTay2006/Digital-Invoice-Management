"""Module doi_soat + duyệt ngoại lệ: Sequence 1 (F-07) và Sequence 2 (F-16)."""
import json
import time
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, can_vai_tro, phien
from ..domain.company import DEFAULT_COMPANY_INFO
from ..domain.matching import doi_soat, Cau_hinh

router = APIRouter()


def _lay_cong_ty_doi_soat(c) -> dict:
    try:
        with c.begin_nested():
            row = c.execute(text("SELECT * FROM thong_tin_cong_ty ORDER BY id DESC LIMIT 1")).mappings().first()
            if row:
                return dict(row)
    except DBAPIError:
        pass
    return dict(DEFAULT_COMPANY_INFO)


class BatchDoiSoatIn(BaseModel):
    hoa_don_ids: Optional[list[int]] = None


@router.post("/hoa-don/{hid}/doi-soat")  # Sequence 1 (F-07)
def chay_doi_soat(hid: int, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    with engine.begin() as c:  # một giao dịch: INSERT lan_doi_soat + UPDATE trạng thái
        phien(c, u["id"])
        hd_row = c.execute(text("""
            SELECT h.*, n.ten AS ten_ncc, n.mst AS mst_ncc
            FROM hoa_don h
            LEFT JOIN nha_cung_cap n ON n.id = h.nha_cung_cap_id
            WHERE h.id=:i FOR UPDATE OF h
        """), {"i": hid}).mappings().first()
        if not hd_row:
            raise HTTPException(404, "Không có hóa đơn")
        hd = dict(hd_row)
        if hd["trang_thai"] == "RECONCILED":
            raise HTTPException(409, "Hóa đơn đã Reconciled, bị khóa")
        po_row = c.execute(text("""
            SELECT p.*, n.ten AS ten_ncc, n.mst AS mst_ncc
            FROM don_hang_po p
            LEFT JOIN nha_cung_cap n ON n.id = p.nha_cung_cap_id
            WHERE p.id=:i
        """), {"i": hd["po_id"]}).mappings().first()
        po = dict(po_row) if po_row else None
        if not po:
            raise HTTPException(404, "Không tìm thấy PO tham chiếu")
        dhd = [dict(r) for r in c.execute(text("SELECT * FROM dong_hoa_don WHERE hoa_don_id=:i"), {"i": hid}).mappings()]
        dpo = {r["id"]: dict(r) for r in c.execute(text("SELECT * FROM dong_po WHERE po_id=:i"), {"i": po["id"]}).mappings()}
        kho = {r[0]: r[1] for r in c.execute(text(
            "SELECT dong_po_id,sum(so_dat) FROM dong_phieu_kho d JOIN phieu_kho p ON p.id=d.phieu_kho_id WHERE p.po_id=:i GROUP BY 1"), {"i": po["id"]})}
        ch = c.execute(text("SELECT * FROM cau_hinh_doi_soat ORDER BY hieu_luc_tu DESC LIMIT 1")).mappings().first()
        if not ch:
            raise HTTPException(409, "Chưa có cấu hình đối soát")
        cong_ty = _lay_cong_ty_doi_soat(c)
        pks = [dict(r) for r in c.execute(text("SELECT id, so_phieu, ten_don_vi, mst_don_vi FROM phieu_kho WHERE po_id=:i"), {"i": po["id"]}).mappings()]
        r = doi_soat(hd, dhd, po, dpo, kho, Cau_hinh(ch["dung_sai_don_gia_pct"], ch["nguong_lech_lon_pct"], ch["nguong_lech_lon_tien"], ch["han_muc_duyet"]), cong_ty=cong_ty, phieu_kho_list=pks)
        row_lan = c.execute(text("""INSERT INTO lan_doi_soat(hoa_don_id,cau_hinh_id,nguoi_chay_id,ket_qua,lech_lon,muc_lech_tien,chi_tiet_buoc)
            VALUES(:h,:c,:u,:k,:l,:m,CAST(:j AS JSONB)) RETURNING id, thoi_gian"""),
            {"h": hid, "c": ch["id"], "u": u["id"], "k": r["ket_qua"], "l": r["lech_lon"], "m": r["muc_lech_tien"], "j": json.dumps(r["chi_tiet_buoc"])}).mappings().first()
        lid = row_lan["id"]
        thoi_gian_iso = row_lan["thoi_gian"].isoformat() if getattr(row_lan["thoi_gian"], "isoformat", None) else str(row_lan["thoi_gian"])
        c.execute(text("UPDATE hoa_don SET trang_thai=:k WHERE id=:i"), {"k": r["ket_qua"], "i": hid})
        if r["ket_qua"] == "MISMATCH":
            c.execute(text("INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung) VALUES(:u,:h,'MISMATCH','Hóa đơn lệch, cần xử lý')"), {"u": u["id"], "h": hid})
    muc_lech_str = str(r["muc_lech_tien"]) if r["muc_lech_tien"] else None
    lan_obj = {
        "id": lid,
        "thoi_gian": thoi_gian_iso,
        "ket_qua": r["ket_qua"],
        "lech_lon": r["lech_lon"],
        "muc_lech_tien": muc_lech_str,
        "chi_tiet_buoc": r["chi_tiet_buoc"],
    }
    return {
        "lan_doi_soat_id": lid,
        "hoa_don_id": hid,
        "trang_thai": r["ket_qua"],
        **r,
        "muc_lech_tien": muc_lech_str,
        "lan_doi_soat": lan_obj,
    }


@router.post("/hoa-don/doi-soat-hang-loat")
def chay_doi_soat_hang_loat(b: Optional[BatchDoiSoatIn] = Body(default=None), u=Depends(can_vai_tro("KE_TOAN_AP"))):
    """Đối soát 3 chiều hàng loạt trong 1 transaction với bulk preload tránh N+1 query."""
    t0 = time.perf_counter()
    with engine.begin() as c:
        phien(c, u["id"])
        ch = c.execute(text("SELECT * FROM cau_hinh_doi_soat ORDER BY hieu_luc_tu DESC LIMIT 1")).mappings().first()
        if not ch:
            raise HTTPException(409, "Chưa có cấu hình đối soát")
        cong_ty = _lay_cong_ty_doi_soat(c)
        cfg = Cau_hinh(ch["dung_sai_don_gia_pct"], ch["nguong_lech_lon_pct"], ch["nguong_lech_lon_tien"], ch["han_muc_duyet"])

        if b and b.hoa_don_ids:
            ids = sorted({int(x) for x in b.hoa_don_ids})
            hds = [dict(r) for r in c.execute(
                text("""
                    SELECT h.*, n.ten AS ten_ncc, n.mst AS mst_ncc
                    FROM hoa_don h
                    LEFT JOIN nha_cung_cap n ON n.id = h.nha_cung_cap_id
                    WHERE h.id = ANY(:ids) AND h.trang_thai <> 'RECONCILED'
                    ORDER BY h.id FOR UPDATE OF h
                """),
                {"ids": ids},
            ).mappings()]
        else:
            hds = [dict(r) for r in c.execute(
                text("""
                    SELECT h.*, n.ten AS ten_ncc, n.mst AS mst_ncc
                    FROM hoa_don h
                    LEFT JOIN nha_cung_cap n ON n.id = h.nha_cung_cap_id
                    WHERE h.trang_thai = 'CHUA_DOI_SOAT'
                    ORDER BY h.id FOR UPDATE OF h
                """)
            ).mappings()]

        if not hds:
            return {"tong_xu_ly": 0, "matched": 0, "partial": 0, "mismatch": 0, "ket_qua": [], "thoi_gian_ms": round((time.perf_counter() - t0) * 1000, 1)}

        hd_ids = [hd["id"] for hd in hds]
        po_ids = sorted({hd["po_id"] for hd in hds if hd.get("po_id") is not None})

        pos_map = {
            r["id"]: dict(r)
            for r in c.execute(text("""
                SELECT p.*, n.ten AS ten_ncc, n.mst AS mst_ncc
                FROM don_hang_po p
                LEFT JOIN nha_cung_cap n ON n.id = p.nha_cung_cap_id
                WHERE p.id = ANY(:pids)
            """), {"pids": po_ids}).mappings()
        } if po_ids else {}

        dhd_by_hd: dict[int, list[dict]] = {}
        for r in c.execute(text("SELECT * FROM dong_hoa_don WHERE hoa_don_id = ANY(:hids)"), {"hids": hd_ids}).mappings():
            dhd_by_hd.setdefault(r["hoa_don_id"], []).append(dict(r))

        dpo_by_po: dict[int, dict[int, dict]] = {}
        kho_by_po: dict[int, dict[int, object]] = {}
        pk_by_po: dict[int, list[dict]] = {}
        if po_ids:
            for r in c.execute(text("SELECT * FROM dong_po WHERE po_id = ANY(:pids)"), {"pids": po_ids}).mappings():
                dpo_by_po.setdefault(r["po_id"], {})[r["id"]] = dict(r)
            for r in c.execute(text("SELECT id, po_id, so_phieu, ten_don_vi, mst_don_vi FROM phieu_kho WHERE po_id = ANY(:pids)"), {"pids": po_ids}).mappings():
                pk_by_po.setdefault(r["po_id"], []).append(dict(r))
            for r in c.execute(text("""
                SELECT p.po_id, d.dong_po_id, sum(d.so_dat) AS tong_dat
                FROM dong_phieu_kho d
                JOIN phieu_kho p ON p.id = d.phieu_kho_id
                WHERE p.po_id = ANY(:pids)
                GROUP BY p.po_id, d.dong_po_id
            """), {"pids": po_ids}).mappings():
                kho_by_po.setdefault(r["po_id"], {})[r["dong_po_id"]] = r["tong_dat"]

        counts = {"MATCHED": 0, "PARTIAL": 0, "MISMATCH": 0}
        update_rows = []
        notif_rows = []
        results = []

        for hd in hds:
            hid = hd["id"]
            pid = hd["po_id"]
            po = pos_map.get(pid)
            if not po:
                continue
            r = doi_soat(hd, dhd_by_hd.get(hid, []), po, dpo_by_po.get(pid, {}), kho_by_po.get(pid, {}), cfg, cong_ty=cong_ty, phieu_kho_list=pk_by_po.get(pid, []))
            lid = c.execute(text("""INSERT INTO lan_doi_soat(hoa_don_id,cau_hinh_id,nguoi_chay_id,ket_qua,lech_lon,muc_lech_tien,chi_tiet_buoc)
                VALUES(:h,:c,:u,:k,:l,:m,CAST(:j AS JSONB)) RETURNING id"""),
                {"h": hid, "c": ch["id"], "u": u["id"], "k": r["ket_qua"], "l": r["lech_lon"], "m": r["muc_lech_tien"], "j": json.dumps(r["chi_tiet_buoc"])}).scalar()
            update_rows.append({"k": r["ket_qua"], "i": hid})
            counts[r["ket_qua"]] = counts.get(r["ket_qua"], 0) + 1
            if r["ket_qua"] == "MISMATCH":
                notif_rows.append({"u": u["id"], "h": hid})
            results.append({
                "hoa_don_id": hid,
                "lan_doi_soat_id": lid,
                "ket_qua": r["ket_qua"],
                "lech_lon": r["lech_lon"],
                "muc_lech_tien": str(r["muc_lech_tien"]) if r["muc_lech_tien"] else None,
            })

        if update_rows:
            c.execute(text("UPDATE hoa_don SET trang_thai=:k WHERE id=:i"), update_rows)
        if notif_rows:
            c.execute(text("INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung) VALUES(:u,:h,'MISMATCH','Hóa đơn lệch, cần xử lý')"), notif_rows)

    return {
        "tong_xu_ly": len(results),
        "matched": counts["MATCHED"],
        "partial": counts["PARTIAL"],
        "mismatch": counts["MISMATCH"],
        "ket_qua": results,
        "thoi_gian_ms": round((time.perf_counter() - t0) * 1000, 1),
    }


class YeuCau(BaseModel):
    ly_do: str


@router.post("/tranh-chap/{tid}/yeu-cau-duyet", status_code=201)  # Sequence 2: gửi (F-16)
def gui_yeu_cau(tid: int, b: YeuCau, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    with engine.begin() as c:
        phien(c, u["id"])
        tc = c.execute(text("SELECT hoa_don_id FROM tranh_chap WHERE id=:i"), {"i": tid}).first()
        if not tc:
            raise HTTPException(404, "Không có tranh chấp")
        ld = c.execute(text("SELECT id FROM lan_doi_soat WHERE hoa_don_id=:h AND lech_lon ORDER BY thoi_gian DESC LIMIT 1"), {"h": tc[0]}).scalar()
        if not ld:
            raise HTTPException(409, "Hóa đơn không có lần đối soát lệch lớn")
        try:  # TR-08/TR-09 chặn nếu vượt hạn mức hoặc sai vai trò
            yid = c.execute(text("""INSERT INTO yeu_cau_duyet_ngoai_le(hoa_don_id,tranh_chap_id,lan_doi_soat_id,nguoi_gui_id,ly_do)
                VALUES(:h,:t,:l,:u,:d) RETURNING id"""), {"h": tc[0], "t": tid, "l": ld, "u": u["id"], "d": b.ly_do}).scalar()
        except Exception as e:
            raise HTTPException(422, str(e.orig) if hasattr(e, "orig") else str(e))
        c.execute(text("""INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung)
            SELECT id,:h,'YEU_CAU_DUYET','Có yêu cầu duyệt ngoại lệ cần xử lý' FROM nguoi_dung
            WHERE vai_tro IN ('QUAN_LY','TOAN_QUYEN') AND hoat_dong"""), {"h": tc[0]})
    return {"id": yid}


@router.post("/hoa-don/{hid}/xac-nhan")  # UC10: Xác nhận Reconciled
def xac_nhan_reconciled(hid: int, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    with engine.begin() as c:
        phien(c, u["id"])
        hd = c.execute(text("SELECT * FROM hoa_don WHERE id=:i FOR UPDATE"), {"i": hid}).mappings().first()
        if not hd:
            raise HTTPException(404, "Không có hóa đơn")
        if hd["trang_thai"] == "RECONCILED":
            raise HTTPException(409, "Hóa đơn đã được khóa Reconciled")
        try:
            c.execute(text("UPDATE hoa_don SET trang_thai='RECONCILED' WHERE id=:i"), {"i": hid})
        except Exception as e:
            raise HTTPException(422, str(getattr(e, "orig", e)).split("\n")[0])
    return {"id": hid, "trang_thai": "RECONCILED"}


@router.get("/yeu-cau-duyet")
def ds_yeu_cau_duyet(u=Depends(can_vai_tro("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT y.*, h.so_hoa_don, h.tong_thanh_toan, l.muc_lech_tien, nd.ho_ten AS ten_nguoi_gui
            FROM yeu_cau_duyet_ngoai_le y
            JOIN hoa_don h ON h.id = y.hoa_don_id
            JOIN lan_doi_soat l ON l.id = y.lan_doi_soat_id
            JOIN nguoi_dung nd ON nd.id = y.nguoi_gui_id
            ORDER BY y.thoi_gian_gui DESC, y.id DESC
        """)).mappings()
        return [dict(r) for r in rows]


class QuyetDinh(BaseModel):
    quyet_dinh: str  # DUYET | TU_CHOI
    ghi_chu: str


@router.put("/yeu-cau-duyet/{yid}")  # Sequence 2: duyệt/từ chối (F-16)
def duyet(yid: int, b: QuyetDinh, u=Depends(can_vai_tro("QUAN_LY"))):
    if b.quyet_dinh not in ("DUYET", "TU_CHOI") or not b.ghi_chu.strip():
        raise HTTPException(422, "Cần quyết định hợp lệ và ghi chú")
    with engine.begin() as c:
        phien(c, u["id"])
        y = c.execute(text("SELECT * FROM yeu_cau_duyet_ngoai_le WHERE id=:i FOR UPDATE"), {"i": yid}).mappings().first()
        if not y or y["trang_thai"] != "CHO_DUYET":
            raise HTTPException(409, "Yêu cầu không tồn tại hoặc đã quyết định")
        if y["nguoi_gui_id"] == u["id"] and u["vai_tro"] != "TOAN_QUYEN":
            raise HTTPException(403, "Không tự duyệt")
        c.execute(text("UPDATE yeu_cau_duyet_ngoai_le SET trang_thai=:q,nguoi_duyet_id=:u,ghi_chu_duyet=:g,thoi_gian_duyet=now() WHERE id=:i"),
                  {"q": b.quyet_dinh, "u": u["id"], "g": b.ghi_chu, "i": yid})
        if b.quyet_dinh == "DUYET":
            c.execute(text("UPDATE hoa_don SET trang_thai='RECONCILED' WHERE id=:h"), {"h": y["hoa_don_id"]})  # TR-07 đặt theo_ngoai_le
            tt = "RESOLVED"
            c.execute(text("UPDATE tranh_chap SET trang_thai='RESOLVED' WHERE id=:t"), {"t": y["tranh_chap_id"]})  # TR-05 đặt ngay_dong
        else:
            tt = "IN_PROGRESS"
            c.execute(text("UPDATE tranh_chap SET trang_thai='IN_PROGRESS' WHERE id=:t"), {"t": y["tranh_chap_id"]})
        c.execute(text("INSERT INTO lich_su_tranh_chap(tranh_chap_id,nguoi_thuc_hien_id,trang_thai_moi,ghi_chu) VALUES(:t,:u,:s,:g)"),
                  {"t": y["tranh_chap_id"], "u": u["id"], "s": tt, "g": b.ghi_chu})
        c.execute(text("INSERT INTO thong_bao(nguoi_nhan_id,hoa_don_id,loai,noi_dung) VALUES(:n,:h,'QUYET_DINH_DUYET',:d)"),
                  {"n": y["nguoi_gui_id"], "h": y["hoa_don_id"], "d": f"Yêu cầu duyệt: {b.quyet_dinh}"})
    return {"trang_thai": b.quyet_dinh}
