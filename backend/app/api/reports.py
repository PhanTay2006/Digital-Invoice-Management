"""Module bao_cao: dashboard, báo cáo, xuất file (F-08, F-14, F-15)."""
from typing import Optional
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import text
from ..core.common import engine, can_vai_tro
from ..infrastructure.export import csv_bytes, xlsx_bytes

router = APIRouter()
XEM = ("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI")


@router.get("/dashboard")
def dashboard(u=Depends(can_vai_tro(*XEM))):
    with engine.connect() as c:
        theo_tt = {r[0]: r[1] for r in c.execute(text("SELECT trang_thai,count(*) FROM hoa_don GROUP BY 1"))}
        tranh_chap_mo = c.execute(text("SELECT count(*) FROM tranh_chap WHERE trang_thai<>'RESOLVED'")).scalar()
        cho_duyet = c.execute(text("SELECT count(*) FROM yeu_cau_duyet_ngoai_le WHERE trang_thai='CHO_DUYET'")).scalar()
        top = [dict(r) for r in c.execute(text("""SELECT n.ten, count(*) AS so_mismatch FROM hoa_don h JOIN nha_cung_cap n ON n.id=h.nha_cung_cap_id
            WHERE h.trang_thai='MISMATCH' GROUP BY n.ten ORDER BY 2 DESC LIMIT 5""")).mappings()]
    tong = sum(theo_tt.values()) or 1
    return {"theo_trang_thai": theo_tt, "ty_le_reconciled_pct": round(theo_tt.get("RECONCILED", 0) * 100 / tong, 1),
            "tranh_chap_dang_mo": tranh_chap_mo, "yeu_cau_cho_duyet": cho_duyet, "ncc_nhieu_lech_nhat": top}


def _rows(trang_thai, tu_ngay, den_ngay):
    where, p = ["TRUE"], {}
    for cond, k, v in (("h.trang_thai=:t", "t", trang_thai), ("h.ngay_lap>=:a", "a", tu_ngay), ("h.ngay_lap<=:b", "b", den_ngay)):
        if v:
            where.append(cond); p[k] = v
    with engine.connect() as c:
        return [tuple(r) for r in c.execute(text(f"""SELECT h.so_hoa_don,n.ten,po.so_po,h.ngay_lap,h.tong_thanh_toan,h.trang_thai,h.theo_ngoai_le
            FROM hoa_don h JOIN nha_cung_cap n ON n.id=h.nha_cung_cap_id JOIN don_hang_po po ON po.id=h.po_id
            WHERE {' AND '.join(where)} ORDER BY h.ngay_lap DESC"""), p)]


@router.get("/bao-cao/hoa-don.csv")
def xuat_csv(trang_thai: Optional[str] = None, tu_ngay: Optional[str] = None, den_ngay: Optional[str] = None, u=Depends(can_vai_tro(*XEM))):
    return Response(csv_bytes(_rows(trang_thai, tu_ngay, den_ngay)), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=hoa-don.csv"})


@router.get("/bao-cao/hoa-don.xlsx")
def xuat_xlsx(trang_thai: Optional[str] = None, tu_ngay: Optional[str] = None, den_ngay: Optional[str] = None, u=Depends(can_vai_tro(*XEM))):
    return Response(xlsx_bytes(_rows(trang_thai, tu_ngay, den_ngay)), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=hoa-don.xlsx"})
