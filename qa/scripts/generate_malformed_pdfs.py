"""Sinh 3 tệp PDF lỗi kỹ thuật (hỏng cấu trúc, giả mạo .pdf, ảnh scan trắng) vào thư mục 04-invoice-invalid."""
import io
import os
from pathlib import Path
from PIL import Image

OUT_DIR = str(Path(__file__).resolve().parents[1] / "pdf-samples" / "04-invoice-invalid")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 10. File PDF bị hỏng cấu trúc / cắt cụt xref
    corrupt_path = os.path.join(OUT_DIR, "HD_SAI_10_FileHongCauTruc_Corrupted.pdf")
    with open(corrupt_path, "wb") as f:
        f.write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%CORRUPTED_TRUNCATED_STREAM_BYTES")

    # 11. File text thuần giả mạo đuôi .pdf
    fake_path = os.path.join(OUT_DIR, "HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf")
    with open(fake_path, "w", encoding="utf-8") as f:
        f.write(
            "HOA DON GIA MAO\n"
            "Day khong phai file PDF that ma la file van ban doi duoi .pdf de kiem thu bao mat upload (NF-17 / BR-12).\n"
        )

    # 12. File PDF dạng ảnh scan trắng (không có lớp văn bản, không có chữ OCR)
    blank_scan_path = os.path.join(OUT_DIR, "HD_SAI_12_AnhScanTrang_KhongCoChu.pdf")
    img = Image.new("RGB", (1240, 1754), (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PDF", resolution=150.0)
    with open(blank_scan_path, "wb") as f:
        f.write(buf.getvalue())

    print("Da tao xong 3 file PDF loi ky thuat:", corrupt_path, fake_path, blank_scan_path)


if __name__ == "__main__":
    main()
