from decimal import Decimal as D
from app.domain.doi_soat import doi_soat, Cau_hinh

CFG = Cau_hinh(D(2), D(5), D(5_000_000), D(10_000_000))
PO = {"nha_cung_cap_id": 1, "loai_po": "HANG_HOA", "tien_coc": D(0)}
DPO = {10: {"so_luong_dat": D(100), "don_gia": D(1_000_000)}}
KHO = {10: D(100)}


def hd(gia, sl=100, coc=0):
    tt = D(sl) * D(gia)
    return ({"nha_cung_cap_id": 1, "tong_truoc_vat": tt, "vat": tt / 10, "tien_coc_tru": D(coc), "tong_thanh_toan": tt + tt / 10 - coc},
            [{"dong_po_id": 10, "so_luong": D(sl), "don_gia": D(gia), "thanh_tien": tt}])


def chay(gia, sl=100, kho=KHO, po=PO):
    h, d = hd(gia, sl)
    return doi_soat(h, d, po, DPO, kho, CFG)


def test_matched():
    assert chay(1_000_000)["ket_qua"] == "MATCHED"

def test_kich_ban_object_diagram_lech_don_gia_5pct():  # HD-0457
    r = chay(1_050_000)
    assert r["ket_qua"] == "MISMATCH" and r["lech_lon"] and r["muc_lech_tien"] == D(5_000_000)
    assert [b["ma_buoc"] for b in r["chi_tiet_buoc"] if not b["dat"]] == ["d"]

def test_trong_dung_sai():
    assert chay(1_015_000)["ket_qua"] == "MATCHED"

def test_vuot_so_luong_kho():
    assert chay(1_000_000, kho={10: D(80)})["ket_qua"] == "MISMATCH"

def test_partial_khi_kho_chua_du():
    assert chay(1_000_000, sl=80, kho={10: D(80)})["ket_qua"] == "PARTIAL"

def test_po_dich_vu_bo_qua_phieu_kho():
    assert chay(1_000_000, kho={}, po={**PO, "loai_po": "DICH_VU"})["ket_qua"] == "MATCHED"
