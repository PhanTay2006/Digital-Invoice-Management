"""Hồ sơ pháp lý Công ty (Bên mua hàng) & hàm đối chiếu chuẩn hóa Tên / Mã số thuế."""
import re
import unicodedata
from typing import Optional

DEFAULT_COMPANY_INFO: dict[str, Optional[str]] = {
    "ten_cong_ty": "CÔNG TY CỔ PHẦN BÁNH VIỆT NAM",
    "ten_tieng_anh": "VIETNAM BAKERY JOINT STOCK COMPANY",
    "ten_viet_tat": "BANH VN JSC",
    "loai_hinh_dn": "Công ty cổ phần",
    "mst": "0108666888",
    "ma_cqt_quan_ly": "70115",
    "co_quan_thue_quan_ly": "Thuế TP. Hồ Chí Minh - Thuế cơ sở 7 (Khu vực Phường Tân Hưng)",
    "dia_chi": "A41, Khu dân cư Kim Sơn, Phường Tân Hưng, Thành phố Hồ Chí Minh",
    "nguoi_dai_dien": "Nguyễn Minh Hoàng",
    "chuc_vu_dai_dien": "Tổng Giám đốc",
    "so_giay_phep_dkkd": "0108666888",
    "ngay_cap_dkkd": "2022-05-15",
    "noi_cap_dkkd": "Phòng Đăng ký kinh doanh - Sở Tài chính TP. Hồ Chí Minh",
    "so_tai_khoan": "0071001234568",
    "ngan_hang": "Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank) - CN TP. Hồ Chí Minh",
    "dien_thoai": "(028) 3876 6888",
    "email": "ketoan@banhvietnam.vn",
    "website": "https://banhvietnam.vn",
}

_VIET_TAT_PHAP_LY = {
    "CTY": "CONG TY",
    "CP": "CO PHAN",
    "TNHH": "TRACH NHIEM HUU HAN",
    "TM": "THUONG MAI",
    "DV": "DICH VU",
    "SX": "SAN XUAT",
    "XNK": "XUAT NHAP KHAU",
    "VN": "VIET NAM",
}


def bo_dau(s: str) -> str:
    """Chuyển chuỗi tiếng Việt có dấu thành không dấu (chữ đ/Đ -> d/D)."""
    if not s:
        return ""
    out: list[str] = []
    for ch in s:
        if ch == "đ":
            out.append("d")
        elif ch == "Đ":
            out.append("D")
        else:
            for decomp in unicodedata.normalize("NFD", ch):
                if unicodedata.category(decomp) != "Mn":
                    out.append(decomp)
    return "".join(out)


def chuan_hoa_ten_cong_ty(ten: Optional[str]) -> str:
    """Chuẩn hóa tên doanh nghiệp (bỏ dấu, in hoa, mở rộng viết tắt pháp lý phổ biến)."""
    s = bo_dau((ten or "").strip()).upper()
    if not s:
        return ""
    s = re.sub(r"[.,\-&/()_]+", " ", s)
    tokens: list[str] = []
    for tok in s.split():
        mapped = _VIET_TAT_PHAP_LY.get(tok, tok)
        tokens.extend(mapped.split())
    return " ".join(tokens)


def chuan_hoa_mst(mst: Optional[str]) -> str:
    """Chuẩn hóa Mã số thuế về dạng liền không dấu cách (10 số hoặc 10-3 số)."""
    s = re.sub(r"[\s.]+", "", (mst or "").strip())
    if not s:
        return ""
    m = re.search(r"(\d{10}(?:-\d{3})?)", s)
    return m[1] if m else s.upper()


def _sach_chuoi(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def doi_chieu_cong_ty(
    ten_tren_phieu: Optional[str],
    mst_tren_phieu: Optional[str],
    cong_ty: Optional[dict] = None,
    bat_buoc_ten: bool = False,
) -> dict:
    """Đối chiếu Tên và MST bên mua/đơn vị trên chứng từ với Hồ sơ pháp lý Công ty."""
    hs = cong_ty or DEFAULT_COMPANY_INFO
    ten_cty = hs.get("ten_cong_ty") or DEFAULT_COMPANY_INFO["ten_cong_ty"]
    mst_cty = hs.get("mst") or DEFAULT_COMPANY_INFO["mst"]

    ten_phieu_sach = _sach_chuoi(ten_tren_phieu)
    mst_phieu_sach = _sach_chuoi(mst_tren_phieu)
    mst_phieu_norm = chuan_hoa_mst(mst_phieu_sach) if mst_phieu_sach else ""

    if not ten_phieu_sach and not mst_phieu_sach:
        if bat_buoc_ten:
            return {
                "trang_thai": "THIEU_TEN_CONG_TY",
                "dat": False,
                "ten_khop": False,
                "mst_khop": None,
                "ten_tren_phieu": None,
                "mst_tren_phieu": None,
                "ten_cong_ty": ten_cty,
                "mst_cong_ty": mst_cty,
                "thong_bao": f"Chưa có Tên Công ty Bên mua trên chứng từ (yêu cầu khớp '{ten_cty}')",
            }
        return {
            "trang_thai": "CHUA_NHAN_DIEN",
            "dat": True,
            "ten_khop": None,
            "mst_khop": None,
            "ten_tren_phieu": None,
            "mst_tren_phieu": None,
            "ten_cong_ty": ten_cty,
            "mst_cong_ty": mst_cty,
            "thong_bao": "Chưa nhận diện được thông tin bên mua trên chứng từ",
        }

    ung_vien_ten = {
        chuan_hoa_ten_cong_ty(x)
        for x in (ten_cty, hs.get("ten_tieng_anh"), hs.get("ten_viet_tat"))
        if _sach_chuoi(x)
    }
    ung_vien_ten.discard("")

    ten_khop: Optional[bool] = None
    if ten_phieu_sach:
        ten_norm = chuan_hoa_ten_cong_ty(ten_phieu_sach)
        ten_khop = bool(ten_norm and ten_norm in ung_vien_ten)

    mst_khop: Optional[bool] = None
    if mst_phieu_sach:
        mst_cty_norm = chuan_hoa_mst(mst_cty)
        mst_khop = bool(mst_phieu_norm and mst_phieu_norm == mst_cty_norm)

    if bat_buoc_ten and not ten_phieu_sach:
        ly_do = [f"Chưa có Tên Công ty Bên mua trên chứng từ (yêu cầu khớp '{ten_cty}')"]
        if mst_khop is False:
            ly_do.append(f"MST bên mua ('{mst_phieu_norm or mst_phieu_sach}') ≠ '{mst_cty}'")
        return {
            "trang_thai": "THIEU_TEN_CONG_TY",
            "dat": False,
            "ten_khop": False,
            "mst_khop": mst_khop,
            "ten_tren_phieu": None,
            "mst_tren_phieu": mst_phieu_norm or mst_phieu_sach,
            "ten_cong_ty": ten_cty,
            "mst_cong_ty": mst_cty,
            "thong_bao": "; ".join(ly_do),
        }

    if mst_khop is False or ten_khop is False:
        ly_do_chi_tiet: list[str] = []
        if ten_khop is False:
            ly_do_chi_tiet.append(f"Tên đơn vị trên chứng từ ('{ten_phieu_sach}') ≠ '{ten_cty}'")
        if mst_khop is False:
            ly_do_chi_tiet.append(f"MST bên mua ('{mst_phieu_norm or mst_phieu_sach}') ≠ '{mst_cty}'")
        return {
            "trang_thai": "KHONG_KHOP",
            "dat": False,
            "ten_khop": ten_khop,
            "mst_khop": mst_khop,
            "ten_tren_phieu": ten_phieu_sach,
            "mst_tren_phieu": mst_phieu_norm or mst_phieu_sach,
            "ten_cong_ty": ten_cty,
            "mst_cong_ty": mst_cty,
            "thong_bao": "Sai thông tin Công ty Bên mua: " + "; ".join(ly_do_chi_tiet),
        }

    if ten_khop and mst_khop:
        tb = "Khớp đầy đủ Tên và MST công ty"
    elif mst_khop:
        tb = "Khớp MST công ty"
    else:
        tb = "Khớp tên công ty"

    return {
        "trang_thai": "KHOP",
        "dat": True,
        "ten_khop": ten_khop,
        "mst_khop": mst_khop,
        "ten_tren_phieu": ten_phieu_sach,
        "mst_tren_phieu": mst_phieu_norm or mst_phieu_sach,
        "ten_cong_ty": ten_cty,
        "mst_cong_ty": mst_cty,
        "thong_bao": tb,
    }
