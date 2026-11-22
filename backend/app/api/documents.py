"""Module chung_tu: NCC, ánh xạ SKU, PO, phiếu kho, hóa đơn (F-01..F-06)."""
import re
from datetime import date
from decimal import Decimal as D
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, nguoi_dung, can_vai_tro, phien, loi_db
from ..infrastructure.pdf_parser import kiem_tra_file

router = APIRouter()
Q2 = D("0.01")

RE_SO_HD = re.compile(r"^(?:HD-[A-Z0-9]+(?:-[A-Z0-9]+)*|\d{4,12})$")
RE_SO_PO = re.compile(r"^PO-[A-Z0-9]+(?:-[A-Z0-9]+)*$")
RE_SO_GRN = re.compile(r"^GRN-[A-Z0-9]+(?:-[A-Z0-9]+)*$")
RE_SKU = re.compile(r"^[A-Z0-9][A-Z0-9._-]{1,49}$")
RE_MST = re.compile(r"^\d{10}(-\d{3})?$")
RE_MA_CQT = re.compile(r"^[A-Z0-9-]{4,50}$")


def _kiem_tra_ngay(v: str, nhan: str) -> str:
    s = (v or "").strip()
    try:
        date.fromisoformat(s)
    except ValueError:
        raise ValueError(f"{nhan} phải đúng định dạng YYYY-MM-DD hợp lệ")
    return s


class NCC(BaseModel):
    ten: str
    mst: str = Field(max_length=14)
    dia_chi: Optional[str] = None

    @field_validator("ten")
    @classmethod
    def check_ten(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) < 2:
            raise ValueError("Tên nhà cung cấp phải có ít nhất 2 ký tự")
        return s

    @field_validator("mst")
    @classmethod
    def check_mst(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_MST.match(s):
            raise ValueError("Mã số thuế phải gồm đúng 10 chữ số (hoặc 10 chữ số-3 chữ số, VD: 0312345678)")
        return s


@router.post("/nha-cung-cap", status_code=201)
def tao_ncc(b: NCC, u=Depends(can_vai_tro("MUA_HANG", "QUAN_TRI", "KE_TOAN_AP"))):
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
    ten_san_pham: Optional[str] = None

    @field_validator("ma_sku_ncc", "ma_sku_noi_bo")
    @classmethod
    def check_sku(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SKU.match(s):
            raise ValueError("Mã SKU chỉ được gồm chữ IN HOA, số, dấu '.', '_', '-' (2–50 ký tự, không khoảng trắng)")
        return s


@router.post("/anh-xa-sku", status_code=201)
def tao_anh_xa(b: AnhXa, u=Depends(can_vai_tro("MUA_HANG", "KE_TOAN_AP"))):
    try:
        with engine.begin() as c:
            return {"id": c.execute(text("INSERT INTO anh_xa_sku(nha_cung_cap_id,ma_sku_ncc,ma_sku_noi_bo,ten_san_pham) VALUES(:nha_cung_cap_id,:ma_sku_ncc,:ma_sku_noi_bo,:ten_san_pham) RETURNING id"), b.model_dump()).scalar()}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/anh-xa-sku")
def ds_anh_xa(ncc_id: Optional[int] = None, u=Depends(can_vai_tro("MUA_HANG", "KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    with engine.connect() as c:
        base_sql = """
            SELECT ax.*, n.ten AS ten_ncc,
                   COALESCE(
                       NULLIF(ax.ten_san_pham, ''),
                       (SELECT dp.mo_ta FROM dong_po dp WHERE dp.ma_sku = ax.ma_sku_noi_bo AND dp.mo_ta IS NOT NULL AND dp.mo_ta <> '' ORDER BY dp.id DESC LIMIT 1)
                   ) AS ten_san_pham
            FROM anh_xa_sku ax
            JOIN nha_cung_cap n ON n.id = ax.nha_cung_cap_id
        """
        if ncc_id is not None:
            rows = c.execute(text(f"{base_sql} WHERE ax.nha_cung_cap_id=:n ORDER BY ax.id DESC"), {"n": ncc_id}).mappings()
        else:
            rows = c.execute(text(f"{base_sql} ORDER BY ax.id DESC")).mappings()
        return [dict(r) for r in rows]


# ---------- PO ----------
class DongPOIn(BaseModel):
    ma_sku: str
    mo_ta: Optional[str] = None
    so_luong_dat: D = Field(gt=0)
    don_gia: D = Field(ge=0)

    @field_validator("ma_sku")
    @classmethod
    def check_ma_sku(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SKU.match(s):
            raise ValueError("Mã SKU nội bộ chỉ được gồm chữ IN HOA, số, dấu '.', '_', '-' (2–50 ký tự)")
        return s


class POIn(BaseModel):
    so_po: str
    nha_cung_cap_id: int
    ngay_dat: str
    loai_po: str = "HANG_HOA"
    dieu_khoan_tt: Optional[str] = None
    tien_coc: D = Field(default=D(0), ge=0)
    dong: list[DongPOIn] = Field(min_length=1)

    @field_validator("so_po")
    @classmethod
    def check_so_po(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SO_PO.match(s):
            raise ValueError("Số PO phải bắt đầu bằng 'PO-' và chỉ gồm chữ IN HOA, số, dấu '-' (VD: PO-2026-002)")
        return s

    @field_validator("ngay_dat")
    @classmethod
    def check_ngay_dat(cls, v: str) -> str:
        return _kiem_tra_ngay(v, "Ngày đặt")

    @field_validator("loai_po")
    @classmethod
    def check_loai_po(cls, v: str) -> str:
        if v not in ("HANG_HOA", "DICH_VU"):
            raise ValueError("Loại PO chỉ chấp nhận HANG_HOA hoặc DICH_VU")
        return v

    @model_validator(mode="after")
    def check_po_logic(self):
        seen = set()
        for d in self.dong:
            if d.ma_sku in seen:
                raise ValueError(f"Mã SKU '{d.ma_sku}' bị trùng lặp trong cùng một PO")
            seen.add(d.ma_sku)
        tong = sum((d.so_luong_dat * d.don_gia for d in self.dong), D(0)).quantize(Q2)
        if self.tien_coc > tong:
            raise ValueError("Tiền đặt cọc không được lớn hơn tổng giá trị đơn hàng PO")
        return self


@router.get("/po")
def ds_po(u=Depends(can_vai_tro("MUA_HANG", "THU_KHO", "KE_TOAN_AP", "QUAN_LY"))):
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT p.*, n.ten AS ten_ncc, n.mst AS mst_ncc,
                   (SELECT STRING_AGG(COALESCE(NULLIF(dp.mo_ta, ''), dp.ma_sku), ', ' ORDER BY dp.id)
                    FROM dong_po dp WHERE dp.po_id = p.id) AS mat_hang
            FROM don_hang_po p
            JOIN nha_cung_cap n ON n.id = p.nha_cung_cap_id
            ORDER BY p.ngay_dat DESC, p.id DESC
        """)).mappings()
        return [dict(r) for r in rows]


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
def xem_po(pid: int, u=Depends(can_vai_tro("MUA_HANG", "THU_KHO", "KE_TOAN_AP", "QUAN_LY"))):
    with engine.connect() as c:
        po = c.execute(text("SELECT * FROM don_hang_po WHERE id=:i"), {"i": pid}).mappings().first()
        if not po:
            raise HTTPException(404, "Không có PO")
        dong = [dict(r) for r in c.execute(text("""
            SELECT dp.*,
                   COALESCE(
                       NULLIF(dp.mo_ta, ''),
                       (SELECT ax.ten_san_pham FROM anh_xa_sku ax
                        JOIN don_hang_po p ON p.nha_cung_cap_id = ax.nha_cung_cap_id
                        WHERE p.id = dp.po_id AND ax.ma_sku_noi_bo = dp.ma_sku AND ax.ten_san_pham IS NOT NULL AND ax.ten_san_pham <> ''
                        LIMIT 1)
                   ) AS ten_san_pham
            FROM dong_po dp WHERE dp.po_id=:i ORDER BY dp.id
        """), {"i": pid}).mappings()]
    return {**po, "dong": dong}


# ---------- Phiếu kho ----------
class DongKho(BaseModel):
    dong_po_id: int
    so_nhan: D = Field(ge=0)
    so_dat: D = Field(ge=0)
    so_tu_choi: D = Field(ge=0)
    ly_do: Optional[str] = None

    @model_validator(mode="after")
    def check_so_luong_kho(self):
        if self.so_dat > self.so_nhan:
            raise ValueError("Số lượng đạt không được lớn hơn số thực nhận")
        if self.so_dat + self.so_tu_choi > self.so_nhan:
            raise ValueError("Tổng số đạt và số từ chối không được vượt quá số thực nhận")
        return self


class KhoIn(BaseModel):
    so_phieu: str
    po_id: int
    ngay_nhap: str
    file_pdf: Optional[str] = None
    ten_don_vi: Optional[str] = None
    mst_don_vi: Optional[str] = None
    dong: list[DongKho] = Field(min_length=1)

    @field_validator("so_phieu")
    @classmethod
    def check_so_phieu(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SO_GRN.match(s):
            raise ValueError("Số phiếu kho phải bắt đầu bằng 'GRN-' và chỉ gồm chữ IN HOA, số, dấu '-' (VD: GRN-002)")
        return s

    @field_validator("ngay_nhap")
    @classmethod
    def check_ngay_nhap(cls, v: str) -> str:
        return _kiem_tra_ngay(v, "Ngày nhập kho")

    @field_validator("ten_don_vi")
    @classmethod
    def check_ten_don_vi(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s or None

    @field_validator("mst_don_vi")
    @classmethod
    def check_mst_don_vi(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = re.sub(r"[\s.]+", "", v.strip())
        if not s:
            return None
        if not RE_MST.match(s):
            raise ValueError("Mã số thuế đơn vị trên phiếu kho phải gồm đúng 10 chữ số (hoặc 10-3 chữ số)")
        return s

    @model_validator(mode="after")
    def check_co_it_nhat_mot_dong_nhan(self):
        if not any(d.so_nhan > 0 for d in self.dong):
            raise ValueError("Phiếu nhập kho phải có ít nhất 1 dòng có số thực nhận > 0")
        return self


@router.get("/phieu-kho")
def ds_phieu_kho(u=Depends(can_vai_tro("MUA_HANG", "THU_KHO", "KE_TOAN_AP", "QUAN_LY"))):
    with engine.connect() as c:
        rows = c.execute(text("""
            SELECT k.*, p.so_po, n.ten AS ten_ncc,
                   (SELECT STRING_AGG(COALESCE(NULLIF(dp.mo_ta, ''), dp.ma_sku), ', ' ORDER BY dk.id)
                    FROM dong_phieu_kho dk
                    JOIN dong_po dp ON dp.id = dk.dong_po_id
                    WHERE dk.phieu_kho_id = k.id) AS mat_hang
            FROM phieu_kho k
            JOIN don_hang_po p ON p.id = k.po_id
            JOIN nha_cung_cap n ON n.id = p.nha_cung_cap_id
            ORDER BY k.ngay_nhap DESC, k.id DESC
        """)).mappings()
        return [dict(r) for r in rows]


@router.get("/phieu-kho/{kid}")
def xem_phieu_kho(kid: int, u=Depends(can_vai_tro("MUA_HANG", "THU_KHO", "KE_TOAN_AP", "QUAN_LY"))):
    with engine.connect() as c:
        k = c.execute(text("""
            SELECT k.*, p.so_po, n.ten AS ten_ncc
            FROM phieu_kho k
            JOIN don_hang_po p ON p.id = k.po_id
            JOIN nha_cung_cap n ON n.id = p.nha_cung_cap_id
            WHERE k.id=:i
        """), {"i": kid}).mappings().first()
        if not k:
            raise HTTPException(404, "Không có phiếu kho")
        dong = [dict(r) for r in c.execute(text("""
            SELECT dk.*, dp.ma_sku, COALESCE(NULLIF(dp.mo_ta, ''), 'Sản phẩm ' || dp.ma_sku) AS ten_san_pham, dp.so_luong_dat
            FROM dong_phieu_kho dk
            JOIN dong_po dp ON dp.id = dk.dong_po_id
            WHERE dk.phieu_kho_id=:i ORDER BY dk.id
        """), {"i": kid}).mappings()]
    return {**k, "dong": dong}


@router.post("/phieu-kho", status_code=201)
def tao_phieu_kho(b: KhoIn, u=Depends(can_vai_tro("THU_KHO"))):
    kiem_tra_file(b.file_pdf)
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            kid = c.execute(text("""INSERT INTO phieu_kho(so_phieu,po_id,ngay_nhap,trang_thai,file_pdf,ten_don_vi,mst_don_vi,nguoi_lap_id)
                VALUES(:so_phieu,:po_id,:ngay_nhap,'PARTIAL',:file_pdf,:ten_don_vi,:mst_don_vi,:u) RETURNING id"""), {**b.model_dump(exclude={"dong"}), "u": u["id"]}).scalar()
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
    ten_san_pham: Optional[str] = None
    so_luong: D = Field(gt=0)
    don_gia: D = Field(ge=0)

    @field_validator("ma_sku_ncc")
    @classmethod
    def check_ma_sku_ncc(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SKU.match(s):
            raise ValueError("Mã SKU NCC chỉ được gồm chữ IN HOA, số, dấu '.', '_', '-' (2–50 ký tự)")
        return s


class HDIn(BaseModel):
    so_hoa_don: str
    nha_cung_cap_id: int
    po_id: int
    ngay_lap: str
    vat: D = Field(ge=0)
    tien_coc_tru: D = Field(default=D(0), ge=0)
    file_pdf: Optional[str] = None
    ma_cqt: Optional[str] = None
    ten_nguoi_mua: Optional[str] = None
    mst_nguoi_mua: Optional[str] = None
    dong: list[DongHD] = Field(min_length=1)

    @field_validator("so_hoa_don")
    @classmethod
    def check_so_hoa_don(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_SO_HD.match(s):
            raise ValueError("Số hóa đơn phải dạng 'HD-...' hoặc 4–12 chữ số (VD: HD-0458 hoặc 00002118)")
        return s

    @field_validator("ngay_lap")
    @classmethod
    def check_ngay_lap(cls, v: str) -> str:
        return _kiem_tra_ngay(v, "Ngày lập hóa đơn")

    @field_validator("ma_cqt")
    @classmethod
    def check_ma_cqt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if not s:
            return None
        if not RE_MA_CQT.match(s):
            raise ValueError("Mã CQT chỉ được gồm chữ IN HOA, số, dấu '-' (4–50 ký tự)")
        return s

    @field_validator("ten_nguoi_mua")
    @classmethod
    def check_ten_nguoi_mua(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s or None

    @field_validator("mst_nguoi_mua")
    @classmethod
    def check_mst_nguoi_mua(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = re.sub(r"[\s.]+", "", v.strip())
        if not s:
            return None
        if not RE_MST.match(s):
            raise ValueError("Mã số thuế bên mua phải gồm đúng 10 chữ số (hoặc 10-3 chữ số)")
        return s

    @model_validator(mode="after")
    def check_hd_logic(self):
        tong = sum((d.so_luong * d.don_gia for d in self.dong), D(0)).quantize(Q2)
        if self.tien_coc_tru > tong + self.vat:
            raise ValueError("Tiền cọc trừ không được lớn hơn tổng tiền hóa đơn (cộng thuế VAT)")
        return self


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
            hid = c.execute(text("""INSERT INTO hoa_don(so_hoa_don,nha_cung_cap_id,po_id,ngay_lap,tong_truoc_vat,vat,tien_coc_tru,tong_thanh_toan,file_pdf,ma_cqt,ten_nguoi_mua,mst_nguoi_mua,nguoi_tao_id)
                VALUES(:so,:n,:p,:ngay,:t,:vat,:coc,:tt,:f,:cqt,:ten_mua,:mst_mua,:u) RETURNING id"""),
                {"so": b.so_hoa_don, "n": b.nha_cung_cap_id, "p": b.po_id, "ngay": b.ngay_lap, "t": truoc, "vat": b.vat,
                 "coc": b.tien_coc_tru, "tt": truoc + b.vat - b.tien_coc_tru, "f": b.file_pdf, "cqt": b.ma_cqt,
                 "ten_mua": b.ten_nguoi_mua, "mst_mua": b.mst_nguoi_mua, "u": u["id"]}).scalar()
            for dpid, d, tt in dong:
                c.execute(text("INSERT INTO dong_hoa_don(hoa_don_id,dong_po_id,ma_sku_ncc,ten_san_pham,so_luong,don_gia,thanh_tien) VALUES(:h,:dp,:s,:tsp,:sl,:g,:tt)"),
                          {"h": hid, "dp": dpid, "s": d.ma_sku_ncc, "tsp": d.ten_san_pham, "sl": d.so_luong, "g": d.don_gia, "tt": tt})
        return {"id": hid, "tong_thanh_toan": str(truoc + b.vat - b.tien_coc_tru), "chua_anh_xa_sku": chua_anh_xa}
    except DBAPIError as e:
        raise loi_db(e)


@router.get("/hoa-don")
def tra_cuu_hoa_don(trang_thai: Optional[str] = None, ncc_id: Optional[int] = None, so_hoa_don: Optional[str] = None,
                    tu_ngay: Optional[str] = None, den_ngay: Optional[str] = None, limit: int = 50, offset: int = 0,
                    u=Depends(can_vai_tro("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    where, p = ["TRUE"], {"limit": min(limit, 200), "offset": offset}
    for col, key, val in (("trang_thai = :trang_thai", "trang_thai", trang_thai), ("nha_cung_cap_id = :ncc_id", "ncc_id", ncc_id),
                          ("so_hoa_don ILIKE :so", "so", f"%{so_hoa_don}%" if so_hoa_don else None),
                          ("ngay_lap >= :tu_ngay", "tu_ngay", tu_ngay), ("ngay_lap <= :den_ngay", "den_ngay", den_ngay)):
        if val is not None:
            where.append(col); p[key] = val
    with engine.connect() as c:
        rows = c.execute(text(f"""
            SELECT h.id, h.so_hoa_don, h.nha_cung_cap_id, h.po_id, h.ngay_lap,
                   h.tong_truoc_vat, h.vat, h.tien_coc_tru, h.tong_thanh_toan,
                   h.trang_thai, h.theo_ngoai_le, h.ma_cqt,
                   h.ten_nguoi_mua, h.mst_nguoi_mua,
                   n.mst AS mst_ncc,
                   mh.mat_hang
            FROM hoa_don h
            LEFT JOIN nha_cung_cap n ON n.id = h.nha_cung_cap_id
            LEFT JOIN (
                SELECT dh.hoa_don_id,
                       STRING_AGG(
                           COALESCE(NULLIF(dh.ten_san_pham, ''), NULLIF(dp.mo_ta, ''), dh.ma_sku_ncc),
                           ', ' ORDER BY dh.id
                       ) AS mat_hang
                FROM dong_hoa_don dh
                LEFT JOIN dong_po dp ON dp.id = dh.dong_po_id
                GROUP BY dh.hoa_don_id
            ) mh ON mh.hoa_don_id = h.id
            WHERE {' AND '.join(where)} ORDER BY h.ngay_lap DESC, h.id DESC LIMIT :limit OFFSET :offset
        """), p).mappings()
        return [dict(r) for r in rows]


@router.get("/hoa-don/{hid}")
def xem_hoa_don(hid: int, u=Depends(can_vai_tro("KE_TOAN_AP", "QUAN_LY", "QUAN_TRI"))):
    with engine.connect() as c:
        hd = c.execute(text("SELECT * FROM hoa_don WHERE id=:i"), {"i": hid}).mappings().first()
        if not hd:
            raise HTTPException(404, "Không có hóa đơn")
        dong = [dict(r) for r in c.execute(text("""
            SELECT dh.*,
                   COALESCE(
                       NULLIF(dh.ten_san_pham, ''),
                       NULLIF(dp.mo_ta, ''),
                       NULLIF(ax.ten_san_pham, ''),
                       'Mặt hàng ' || dh.ma_sku_ncc
                   ) AS ten_san_pham
            FROM dong_hoa_don dh
            LEFT JOIN dong_po dp ON dp.id = dh.dong_po_id
            LEFT JOIN anh_xa_sku ax ON ax.nha_cung_cap_id = :ncc AND ax.ma_sku_ncc = dh.ma_sku_ncc
            WHERE dh.hoa_don_id=:i ORDER BY dh.id
        """), {"i": hid, "ncc": hd["nha_cung_cap_id"]}).mappings()]
        ds = [dict(r) for r in c.execute(text("SELECT * FROM lan_doi_soat WHERE hoa_don_id=:i ORDER BY thoi_gian DESC"), {"i": hid}).mappings()]
    return {**hd, "dong": dong, "lan_doi_soat": ds}
