"""Xuất báo cáo (F-14, F-15): CSV (mở bằng Excel) và XLSX."""
import csv, io

TIEU_DE = ["Số hóa đơn", "NCC", "Số PO", "Ngày lập", "Tổng thanh toán", "Trạng thái", "Theo ngoại lệ"]


def csv_bytes(rows) -> bytes:
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(TIEU_DE); w.writerows(rows)
    return ("\ufeff" + buf.getvalue()).encode("utf-8")  # BOM để Excel đọc đúng tiếng Việt


def xlsx_bytes(rows) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font
    wb = Workbook(); ws = wb.active; ws.title = "Hóa đơn"
    ws.append(TIEU_DE)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append([float(x) if hasattr(x, "as_tuple") else (str(x) if hasattr(x, "isoformat") else x) for x in r])
    for col, w in zip("ABCDEFG", (16, 28, 16, 12, 18, 14, 14)):
        ws.column_dimensions[col].width = w
    out = io.BytesIO(); wb.save(out)
    return out.getvalue()
