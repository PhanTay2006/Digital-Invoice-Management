# Kịch bản chạy tay qua /docs (sau khi seed)
1. POST /dang-nhap `ketoan` → dán token vào Authorize.
2. POST /hoa-don/1/doi-soat → MISMATCH, lech_lon=true, muc_lech_tien=5.000.000 (bước d không đạt).
3. POST /hoa-don/1/tranh-chap {"ly_do":"Đơn giá cao hơn PO"} → tranh chấp #1.
4. POST /tranh-chap/1/yeu-cau-duyet {"ly_do":"Biến động giá"} → yêu cầu #1.
5. Đăng nhập `quanly`; PUT /yeu-cau-duyet/1 {"quyet_dinh":"DUYET","ghi_chu":"Chấp nhận"} → hóa đơn RECONCILED, theo_ngoai_le=true.
6. Thử lại bước 2 → 409 (khóa). GET /audit-log (admin) thấy vết thay đổi.
Kỳ vọng sai: `ketoan` gọi PUT /yeu-cau-duyet → 403; `quanly` tự duyệt yêu cầu mình gửi → bị chặn.
