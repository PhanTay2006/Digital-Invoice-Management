"""Module chung_tu: NCC, ánh xạ SKU, PO, phiếu kho, hóa đơn (F-01..F-06)."""
from decimal import Decimal as D
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, nguoi_dung, can_vai_tro, phien, loi_db
from ..infrastructure.pdf_parser import kiem_tra_file

router = APIRouter()
Q2 = D("0.01")


class NCC(BaseModel):
    ten: str
    mst: str = Field(max_length=14)
    dia_chi: Optional[str] = None


@router.post("/nha-cung-cap", status_code=201)
def tao_ncc(b: NCC, u=Depends(can_vai_tro("MUA_HANG", "QUAN_TRI"))):
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            return {"id": c.execute(text("INSERT INTO nha_cung_cap(ten,mst,dia_chi) VALUES(:ten,:mst,:dia_chi) RETURNING id"), b.model_dump()).scalar()}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/nha-cung-cap")
def ds_ncc(u=Depends(nguoi_dung)):
    with engine.connect() as c:
        return [dict(r) for r in c.execute(text("SELECT id,ten,mst,dia_chi FROM nha_cung_cap ORDER BY ten")).mappings()]


class AnhXa(BaseModel):
    nha_cung_cap_id: int
    ma_sku_ncc: str
    ma_sku_noi_bo: str


@router.post("/anh-xa-sku", status_code=201)
def tao_anh_xa(b: AnhXa, u=Depends(can_vai_tro("MUA_HANG", "KE_TOAN_AP"))):
    try:
        with engine.begin() as c:
            return {"id": c.execute(text("INSERT INTO anh_xa_sku(nha_cung_cap_id,ma_sku_ncc,ma_sku_noi_bo) VALUES(:nha_cung_cap_id,:ma_sku_ncc,:ma_sku_noi_bo) RETURNING id"), b.model_dump()).scalar()}
    except DBAPIError as e:
        raise loi_db(e)


# ---------- PO ----------
class DongPOIn(BaseModel):
    ma_sku: str
    mo_ta: Optional[str] = None
    so_luong_dat: D = Field(gt=0)
    don_gia: D = Field(ge=0)


class POIn(BaseModel):
    so_po: str
    nha_cung_cap_id: int
    ngay_dat: str
    loai_po: str = "HANG_HOA"
    dieu_khoan_tt: Optional[str] = None
    tien_coc: D = D(0)
    dong: list[DongPOIn] = Field(min_length=1)


@router.post("/po", status_code=201)
def tao_po(b: POIn, u=Depends(can_vai_tro("MUA_HANG"))):
    tong = sum((d.so_luong_dat * d.don_gia for d in b.dong), D(0)).quantize(Q2)  # tinhTong()
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            pid = c.execute(text("""INSERT INTO don_hang_po(so_po,nha_cung_cap_id,ngay_dat,loai_po,dieu_khoan_tt,tien_coc,tong_tien,nguoi_tao_id)
                VALUES(:so_po,:nha_cung_cap_id,:ngay_dat,:loai_po,:dieu_khoan_tt,:tien_coc,:tong,:u) RETURNING id"""),
                {**b.model_dump(exclude={"dong"}), "tong": tong, "u": u["id"]}).scalar()
            for d in b.dong:
                c.execute(text("INSERT INTO dong_po(po_id,ma_sku,mo_ta,so_luong_dat,don_gia) VALUES(:p,:ma_sku,:mo_ta,:so_luong_dat,:don_gia)"), {"p": pid, **d.model_dump()})
        return {"id": pid, "tong_tien": str(tong)}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/po/{pid}")
def xem_po(pid: int, u=Depends(nguoi_dung)):
    with engine.connect() as c:
        po = c.execute(text("SELECT * FROM don_hang_po WHERE id=:i"), {"i": pid}).mappings().first()
        if not po:
            raise HTTPException(404, "Không có PO")
        dong = [dict(r) for r in c.execute(text("SELECT * FROM dong_po WHERE po_id=:i ORDER BY id"), {"i": pid}).mappings()]
    return {**po, "dong": dong}


# ---------- Phiếu kho ----------
class DongKho(BaseModel):
    dong_po_id: int
    so_nhan: D = Field(ge=0)
    so_dat: D = Field(ge=0)
    so_tu_choi: D = Field(ge=0)
    ly_do: Optional[str] = None


class KhoIn(BaseModel):
    so_phieu: str
    po_id: int
    ngay_nhap: str
    file_pdf: Optional[str] = None
    dong: list[DongKho] = Field(min_length=1)


@router.post("/phieu-kho", status_code=201)
def tao_phieu_kho(b: KhoIn, u=Depends(can_vai_tro("THU_KHO"))):
    kiem_tra_file(b.file_pdf)
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            kid = c.execute(text("""INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,file_pdf,nguoi_lap_id)
                VALUES(:so_phieu,:po_id,:ngay_nhap,'PARTIAL',:file_pdf,:u) RETURNING id"""), {**b.model_dump(exclude={"dong"}), "u": u["id"]}).scalar()
            for d in b.dong:
                ok = c.execute(text("SELECT 1 FROM dong_po WHERE id=:d AND po_id=:p"), {"d": d.dong_po_id, "p": b.po_id}).first()
                if not ok:
                    raise HTTPException(422, f"Dòng PO {d.dong_po_id} không thuộc PO {b.po_id}")
                c.execute(text("""INSERT INTO dong_phieu_kho(phieu_kho_id,dong_po_id,so_nhan,so_dat,so_tu_choi,ly_do)
                    VALUES(:k,:dong_po_id,:so_nhan,:so_dat,:so_tu_choi,:ly_do)"""), {"k": kid, **d.model_dump()})
            # TR-03 (ở tầng ứng dụng): CONFIRMED nếu mọi dòng PO đủ số đạt lũy kế
            thieu = c.execute(text("""SELECT count(*) FROM dong_po dp WHERE dp.po_id=:p AND dp.so_luong_dat >
                COALESCE((SELECT sum(so_dat) FROM dong_phieu_kho WHERE dong_po_id=dp.id),0)"""), {"p": b.po_id}).scalar()
            tt = "PARTIAL" if thieu else "CONFIRMED"
            c.execute(text("UPDATE phieu_kho SET trang_thai=:t WHERE id=:i"), {"t": tt, "i": kid})
        return {"id": kid, "trang_thai": tt}
    except DBAPIError as e:
        raise loi_db(e)


# ---------- Hóa đơn ----------
class DongHD(BaseModel):
    ma_sku_ncc: str
    so_luong: D = Field(gt=0)
    don_gia: D = Field(ge=0)


class HDIn(BaseModel):
    so_hoa_don: str
    nha_cung_cap_id: int
    po_id: int
    ngay_lap: str
    vat: D = Field(ge=0)
    tien_coc_tru: D = D(0)
    file_pdf: Optional[str] = None
    ma_cqt: Optional[str] = None
    dong: list[DongHD] = Field(min_length=1)


@router.post("/hoa-don", status_code=201)
def tao_hoa_don(b: HDIn, u=Depends(can_vai_tro("KE_TOAN_AP"))):
    kiem_tra_file(b.file_pdf)
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            dong, chua_anh_xa = [], []
            for d in b.dong:  # ánh xạ SKU NCC -> SKU nội bộ -> dòng PO (F-03)
                r = c.execute(text("""SELECT dp.id FROM anh_xa_sku ax JOIN dong_po dp ON dp.ma_sku=ax.ma_sku_noi_bo AND dp.po_id=:p
                    WHERE ax.nha_cung_cap_id=:n AND ax.ma_sku_ncc=:s"""), {"p": b.po_id, "n": b.nha_cung_cap_id, "s": d.ma_sku_ncc}).first()
                if not r:
                    chua_anh_xa.append(d.ma_sku_ncc)
                dong.append((r[0] if r else None, d, (d.so_luong * d.don_gia).quantize(Q2)))
            truoc = sum((x[2] for x in dong), D(0))
            hid = c.execute(text("""INSERT INTO hoa_don(so_hoa_don,nha_cung_cap_id,po_id,ngay_lap,tong_truoc_vat,vat,tien_coc_tru,tong_thanh_toan,file_pdf,nguoi_tao_id)
                VALUES(:so,:n,:p,:ngay,:t,:vat,:coc,:tt,:f,:u) RETURNING id"""),
                {"so": b.so_hoa_don, "n": b.nha_cung_cap_id, "p": b.po_id, "ngay": b.ngay_lap, "t": truoc, "vat": b.vat,
                 "coc": b.tien_coc_tru, "tt": truoc + b.vat - b.tien_coc_tru, "f": b.file_pdf, "u": u["id"]}).scalar()
            for dpid, d, tt in dong:
                c.execute(text("INSERT INTO dong_hoa_don(hoa_don_id,dong_po_id,ma_sku_ncc,so_luong,don_gia,thanh_tien) VALUES(:h,:dp,:s,:sl,:g,:tt)"),
                          {"h": hid, "dp": dpid, "s": d.ma_sku_ncc, "sl": d.so_luong, "g": d.don_gia, "tt": tt})
        return {"id": hid, "tong_thanh_toan": str(truoc + b.vat - b.tien_coc_tru), "chua_anh_xa_sku": chua_anh_xa}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/hoa-don")
def tra_cuu_hoa_don(trang_thai: Optional[str] = None, ncc_id: Optional[int] = None, so_hoa_don: Optional[str] = None,
                    tu_ngay: Optional[str] = None, den_ngay: Optional[str] = None, limit: int = 50, offset: int = 0,
                    u=Depends(nguoi_dung)):
    where, p = ["TRUE"], {"limit": min(limit, 200), "offset": offset}
    for col, key, val in (("trang_thai = :trang_thai", "trang_thai", trang_thai), ("nha_cung_cap_id = :ncc_id", "ncc_id", ncc_id),
                          ("so_hoa_don ILIKE :so", "so", f"%{so_hoa_don}%" if so_hoa_don else None),
                          ("ngay_lap >= :tu_ngay", "tu_ngay", tu_ngay), ("ngay_lap <= :den_ngay", "den_ngay", den_ngay)):
        if val is not None:
            where.append(col); p[key] = val
    with engine.connect() as c:
        rows = c.execute(text(f"SELECT id,so_hoa_don,nha_cung_cap_id,po_id,ngay_lap,tong_thanh_toan,trang_thai,theo_ngoai_le FROM hoa_don "
                              f"WHERE {' AND '.join(where)} ORDER BY ngay_lap DESC, id DESC LIMIT :limit OFFSET :offset"), p).mappings()
        return [dict(r) for r in rows]


@router.get("/hoa-don/{hid}")
def xem_hoa_don(hid: int, u=Depends(nguoi_dung)):
    with engine.connect() as c:
        hd = c.execute(text("SELECT * FROM hoa_don WHERE id=:i"), {"i": hid}).mappings().first()
        if not hd:
            raise HTTPException(404, "Không có hóa đơn")
        dong = [dict(r) for r in c.execute(text("SELECT * FROM dong_hoa_don WHERE hoa_don_id=:i ORDER BY id"), {"i": hid}).mappings()]
        ds = [dict(r) for r in c.execute(text("SELECT * FROM lan_doi_soat WHERE hoa_don_id=:i ORDER BY thoi_gian DESC"), {"i": hid}).mappings()]
    return {**hd, "dong": dong, "lan_doi_soat": ds}
