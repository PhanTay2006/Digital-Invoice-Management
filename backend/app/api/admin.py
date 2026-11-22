"""Module quan_tri: tài khoản, hồ sơ công ty, cấu hình dung sai, audit log (F-12, F-13)."""
from datetime import date
from decimal import Decimal as D
import re
from typing import Optional
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from ..core.common import engine, nguoi_dung, can_vai_tro, phien, loi_db
from ..domain.company import DEFAULT_COMPANY_INFO

router = APIRouter()
QT = Depends(can_vai_tro("QUAN_TRI"))
VAI_TRO = "MUA_HANG|THU_KHO|KE_TOAN_AP|QUAN_LY|QUAN_TRI|TOAN_QUYEN"
RE_USERNAME = re.compile(r"^[a-z0-9._-]{3,30}$")
RE_MST = re.compile(r"^\d{10}(-\d{3})?$")


class NDIn(BaseModel):
    ten_dang_nhap: str
    mat_khau: str = Field(min_length=8)
    ho_ten: str
    vai_tro: str = Field(pattern=f"^({VAI_TRO})$")

    @field_validator("ten_dang_nhap")
    @classmethod
    def check_username(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_USERNAME.match(s):
            raise ValueError("Tên đăng nhập phải dài 3–30 ký tự, chỉ gồm chữ thường, số, '.', '_', '-'")
        return s

    @field_validator("ho_ten")
    @classmethod
    def check_ho_ten(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) < 2:
            raise ValueError("Họ và tên phải có ít nhất 2 ký tự")
        return s


@router.get("/nguoi-dung")
def ds_nguoi_dung(u=QT):
    with engine.connect() as c:
        rows = c.execute(text("SELECT id,ten_dang_nhap,ho_ten,vai_tro,hoat_dong,ngay_tao FROM nguoi_dung ORDER BY id")).mappings()
        return [dict(r) for r in rows]


@router.post("/nguoi-dung", status_code=201)
def tao_nguoi_dung(b: NDIn, u=QT):
    h = bcrypt.hashpw(b.mat_khau.encode(), bcrypt.gensalt()).decode()
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            return {"id": c.execute(text("INSERT INTO nguoi_dung(ten_dang_nhap,mat_khau_bam,ho_ten,vai_tro) VALUES(:t,:h,:n,:v) RETURNING id"),
                                    {"t": b.ten_dang_nhap, "h": h, "n": b.ho_ten, "v": b.vai_tro}).scalar()}
    except DBAPIError as e:
        raise loi_db(e)


class NDSua(BaseModel):
    ho_ten: Optional[str] = None
    vai_tro: Optional[str] = Field(None, pattern=f"^({VAI_TRO})$")
    hoat_dong: Optional[bool] = None
    mat_khau: Optional[str] = Field(None, min_length=8)

    @field_validator("ho_ten")
    @classmethod
    def check_ho_ten_sua(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        if len(s) < 2:
            raise ValueError("Họ và tên phải có ít nhất 2 ký tự")
        return s


@router.put("/nguoi-dung/{nid}")  # cập nhật thông tin / khóa tài khoản / đổi vai trò (TR-11)
def sua_nguoi_dung(nid: int, b: NDSua, u=QT):
    sets = {k: v for k, v in b.model_dump().items() if v is not None}
    if not sets:
        raise HTTPException(422, "Không có gì để sửa")
    if nid == u["id"] and ("vai_tro" in sets or "hoat_dong" in sets):
        raise HTTPException(403, "Không tự đổi vai trò/khóa chính mình")
    if "mat_khau" in sets:
        sets["mat_khau_bam"] = bcrypt.hashpw(sets.pop("mat_khau").encode(), bcrypt.gensalt()).decode()
    with engine.begin() as c:
        phien(c, u["id"])
        n = c.execute(text(f"UPDATE nguoi_dung SET {','.join(f'{k}=:{k}' for k in sets)} WHERE id=:id"), {**sets, "id": nid}).rowcount
    if not n:
        raise HTTPException(404, "Không có người dùng")
    sets.pop("mat_khau_bam", None)
    return sets


@router.delete("/nguoi-dung/{nid}")
def xoa_nguoi_dung(nid: int, u=QT):
    if nid == u["id"]:
        raise HTTPException(403, "Không tự xóa chính mình")
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            n = c.execute(text("DELETE FROM nguoi_dung WHERE id=:id"), {"id": nid}).rowcount
        if not n:
            raise HTTPException(404, "Không có người dùng")
        return {"deleted": nid}
    except DBAPIError:
        raise HTTPException(409, "Tài khoản đã có dữ liệu nghiệp vụ hoặc nhật ký liên kết nên không thể xóa vĩnh viễn. Vui lòng dùng chức năng Khóa tài khoản.")


class CHIn(BaseModel):
    dung_sai_don_gia_pct: D = Field(ge=0, le=100)
    nguong_lech_lon_pct: D = Field(ge=0, le=100)
    nguong_lech_lon_tien: D = Field(ge=0)
    han_muc_duyet: D = Field(ge=0)


@router.post("/cau-hinh", status_code=201)  # thêm dòng mới, không sửa dòng cũ
def them_cau_hinh(b: CHIn, u=QT):
    with engine.begin() as c:
        phien(c, u["id"])
        return {"id": c.execute(text("""INSERT INTO cau_hinh_doi_soat(dung_sai_don_gia_pct,nguong_lech_lon_pct,nguong_lech_lon_tien,han_muc_duyet,nguoi_cau_hinh_id)
            VALUES(:dung_sai_don_gia_pct,:nguong_lech_lon_pct,:nguong_lech_lon_tien,:han_muc_duyet,:u) RETURNING id"""), {**b.model_dump(), "u": u["id"]}).scalar()}


@router.get("/cau-hinh/hien-hanh")
def cau_hinh_hien_hanh(u=Depends(can_vai_tro("QUAN_TRI", "QUAN_LY", "KE_TOAN_AP"))):
    with engine.connect() as c:
        r = c.execute(text("SELECT * FROM cau_hinh_doi_soat ORDER BY hieu_luc_tu DESC, id DESC LIMIT 1")).mappings().first()
    return dict(r) if r else {}


class CongTyIn(BaseModel):
    ten_cong_ty: str
    ten_tieng_anh: Optional[str] = None
    ten_viet_tat: Optional[str] = None
    loai_hinh_dn: Optional[str] = None
    mst: str = Field(max_length=14)
    ma_cqt_quan_ly: Optional[str] = None
    co_quan_thue_quan_ly: Optional[str] = None
    dia_chi: str
    nguoi_dai_dien: Optional[str] = None
    chuc_vu_dai_dien: Optional[str] = None
    so_giay_phep_dkkd: Optional[str] = None
    ngay_cap_dkkd: Optional[str] = None
    noi_cap_dkkd: Optional[str] = None
    so_tai_khoan: Optional[str] = None
    ngan_hang: Optional[str] = None
    dien_thoai: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

    @field_validator("ten_cong_ty")
    @classmethod
    def check_ten_cong_ty(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) < 2:
            raise ValueError("Tên công ty phải có ít nhất 2 ký tự")
        return s

    @field_validator("mst")
    @classmethod
    def check_mst_cong_ty(cls, v: str) -> str:
        s = (v or "").strip()
        if not RE_MST.match(s):
            raise ValueError("Mã số thuế công ty phải gồm đúng 10 chữ số (hoặc 10-3 chữ số, VD: 0108666888)")
        return s

    @field_validator("dia_chi")
    @classmethod
    def check_dia_chi(cls, v: str) -> str:
        s = (v or "").strip()
        if len(s) < 5:
            raise ValueError("Địa chỉ trụ sở phải có ít nhất 5 ký tự")
        return s

    @field_validator("ngay_cap_dkkd")
    @classmethod
    def check_ngay_cap_dkkd(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        s = str(v).strip()
        try:
            date.fromisoformat(s)
        except ValueError:
            raise ValueError("Ngày cấp ĐKKD phải đúng định dạng YYYY-MM-DD hợp lệ")
        return s

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        s = str(v).strip()
        if "@" not in s:
            raise ValueError("Email liên hệ không hợp lệ")
        return s


def _dinh_dang_cong_ty_row(row) -> dict:
    d = dict(row)
    if d.get("ngay_cap_dkkd") is not None:
        d["ngay_cap_dkkd"] = d["ngay_cap_dkkd"].isoformat() if hasattr(d["ngay_cap_dkkd"], "isoformat") else str(d["ngay_cap_dkkd"])
    return d


@router.get("/cong-ty")
def lay_thong_tin_cong_ty(u=Depends(nguoi_dung)):
    try:
        with engine.connect() as c:
            r = c.execute(text("SELECT * FROM thong_tin_cong_ty ORDER BY id DESC LIMIT 1")).mappings().first()
        if r:
            return _dinh_dang_cong_ty_row(r)
    except DBAPIError:
        pass
    return dict(DEFAULT_COMPANY_INFO)


@router.put("/cong-ty")
def cap_nhat_thong_tin_cong_ty(b: CongTyIn, u=QT):
    payload = {k: (v.strip() if isinstance(v, str) and k not in ("ten_cong_ty", "mst", "dia_chi") else v) for k, v in b.model_dump().items()}
    for k, v in list(payload.items()):
        if isinstance(v, str) and not v:
            payload[k] = None
    try:
        with engine.begin() as c:
            phien(c, u["id"])
            existing_id = c.execute(text("SELECT id FROM thong_tin_cong_ty ORDER BY id DESC LIMIT 1")).scalar()
            if existing_id:
                row = c.execute(text("""
                    UPDATE thong_tin_cong_ty
                    SET ten_cong_ty=:ten_cong_ty,
                        ten_tieng_anh=:ten_tieng_anh,
                        ten_viet_tat=:ten_viet_tat,
                        loai_hinh_dn=:loai_hinh_dn,
                        mst=:mst,
                        ma_cqt_quan_ly=:ma_cqt_quan_ly,
                        co_quan_thue_quan_ly=:co_quan_thue_quan_ly,
                        dia_chi=:dia_chi,
                        nguoi_dai_dien=:nguoi_dai_dien,
                        chuc_vu_dai_dien=:chuc_vu_dai_dien,
                        so_giay_phep_dkkd=:so_giay_phep_dkkd,
                        ngay_cap_dkkd=:ngay_cap_dkkd,
                        noi_cap_dkkd=:noi_cap_dkkd,
                        so_tai_khoan=:so_tai_khoan,
                        ngan_hang=:ngan_hang,
                        dien_thoai=:dien_thoai,
                        email=:email,
                        website=:website,
                        ngay_cap_nhat=now(),
                        nguoi_cap_nhat_id=:uid
                    WHERE id=:id
                    RETURNING *
                """), {**payload, "uid": u["id"], "id": existing_id}).mappings().first()
            else:
                row = c.execute(text("""
                    INSERT INTO thong_tin_cong_ty (
                        ten_cong_ty, ten_tieng_anh, ten_viet_tat, loai_hinh_dn,
                        mst, ma_cqt_quan_ly, co_quan_thue_quan_ly, dia_chi,
                        nguoi_dai_dien, chuc_vu_dai_dien, so_giay_phep_dkkd, ngay_cap_dkkd, noi_cap_dkkd,
                        so_tai_khoan, ngan_hang, dien_thoai, email, website, nguoi_cap_nhat_id
                    ) VALUES (
                        :ten_cong_ty, :ten_tieng_anh, :ten_viet_tat, :loai_hinh_dn,
                        :mst, :ma_cqt_quan_ly, :co_quan_thue_quan_ly, :dia_chi,
                        :nguoi_dai_dien, :chuc_vu_dai_dien, :so_giay_phep_dkkd, :ngay_cap_dkkd, :noi_cap_dkkd,
                        :so_tai_khoan, :ngan_hang, :dien_thoai, :email, :website, :uid
                    )
                    RETURNING *
                """), {**payload, "uid": u["id"]}).mappings().first()
            return _dinh_dang_cong_ty_row(row)
    except DBAPIError as e:
        raise loi_db(e)


def _an_du_lieu_nhay_cam(obj):
    if isinstance(obj, dict):
        return {k: v for k, v in obj.items() if k != "mat_khau_bam"}
    return obj


@router.get("/audit-log")
def audit_log(doi_tuong: Optional[str] = None, doi_tuong_id: Optional[int] = None, nguoi_dung_id: Optional[int] = None,
              hanh_dong: Optional[str] = None, limit: int = 100, u=QT):
    where, p = ["TRUE"], {"limit": min(limit, 500)}
    for cond, k, v in (("al.doi_tuong=:a", "a", doi_tuong), ("al.doi_tuong_id=:b", "b", doi_tuong_id),
                       ("al.nguoi_dung_id=:c", "c", nguoi_dung_id), ("al.hanh_dong=:d", "d", hanh_dong)):
        if v is not None:
            where.append(cond); p[k] = v
    with engine.connect() as c:
        rows = c.execute(text(f"""
            SELECT al.*,
                   nd.ten_dang_nhap AS nguoi_thuc_hien_username,
                   nd.ho_ten AS nguoi_thuc_hien_ho_ten,
                   nd.vai_tro AS nguoi_thuc_hien_vai_tro
            FROM audit_log al
            LEFT JOIN nguoi_dung nd ON nd.id = al.nguoi_dung_id
            WHERE {' AND '.join(where)}
            ORDER BY al.id DESC LIMIT :limit
        """), p).mappings()
        out = []
        for r in rows:
            item = dict(r)
            item["du_lieu_cu"] = _an_du_lieu_nhay_cam(item.get("du_lieu_cu"))
            item["du_lieu_moi"] = _an_du_lieu_nhay_cam(item.get("du_lieu_moi"))
            out.append(item)
        return out
