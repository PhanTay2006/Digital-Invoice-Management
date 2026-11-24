import path from 'node:path'
import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

const PDF_ROOT = 'f:/University/source/cnpm/Bo_Mau_Chung_Tu_Demo_Co_Kim_Anh'
const SHOTS_DIR = `${PDF_ROOT}/05_Anh_Chup_Minh_Chung_Test`
const QA_PYTHON = 'C:/Users/LAZYORC/.gemini/antigravity/brain/684136d3-19e2-4499-a3bd-2bec7e67fe04/scratch/qa_venv/Scripts/python.exe'
const SEED_SCRIPT = `${PDF_ROOT}/scripts/seed_demo_co_kim_anh.py`

async function loginAs(page, username, password = 'Matkhau@123') {
  await page.goto('/login')
  await page.fill('#login-username', username)
  await page.fill('#login-password', password)
  await page.click('button[type="submit"]')
}

async function logout(page) {
  await page.click('button:has-text("Đăng xuất")')
  await expect(page).toHaveURL(/\/login/)
}

test.beforeAll(() => {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  execFileSync(QA_PYTHON, [SEED_SCRIPT, '--reset', '--fix-seed-buyer'], { stdio: 'inherit' })
})

test('E2E chuẩn CNPM: Đăng nhập -> RBAC -> Upload GRN & Invoice (Đúng/Sai) -> Đối soát -> Tranh chấp -> Duyệt ngoại lệ -> Dashboard/Excel -> Audit Log', async ({ page }) => {
  // 1. Đăng nhập sai mật khẩu (TC02)
  await loginAs(page, 'ketoan', 'WrongPassword!')
  await expect(page.locator('.figma-alert-error')).toBeVisible()
  await page.screenshot({ path: `${SHOTS_DIR}/00_login_wrong_password.png`, fullPage: true })

  // 2. Đăng nhập Thủ kho & kiểm tra RBAC chặn trang Quản trị /users (TC03)
  await loginAs(page, 'thukho')
  await expect(page).toHaveURL(/\/goods-receipts/)
  await page.goto('/users')
  await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  await page.screenshot({ path: `${SHOTS_DIR}/01_rbac_thukho_blocked_users.png`, fullPage: true })

  // 3. Upload & lưu Phiếu nhập kho đúng GRN_DUNG_01 (PO-2026-101)
  await page.goto('/goods-receipts')
  await page.click('button:has-text("Tải Phiếu kho lên")')
  await page.locator('.modal-container input[type="file"]').setInputFiles(
    path.join(PDF_ROOT, '01_Phieu_Nhap_Kho_GRN_Dung/GRN_DUNG_01_NhapDu_PO101.pdf')
  )
  await expect(page.locator('.extract-summary-card')).toContainText('GRN-2026-101')
  await expect(page.locator('.extract-summary-card')).toContainText('✓ Khớp hồ sơ công ty')
  await page.screenshot({ path: `${SHOTS_DIR}/02_grn_upload_preview.png`, fullPage: true })

  await page.click('button:has-text("Kiểm tra & Lưu Phiếu kho →")')
  await page.click('button:has-text("Xác nhận & Lưu Phiếu nhập kho vào DB")')
  await expect(page.locator('.alert-success')).toContainText('CONFIRMED')
  await page.screenshot({ path: `${SHOTS_DIR}/03_grn_saved_confirmed.png`, fullPage: true })

  await logout(page)

  // 4. Đăng nhập Kế toán AP -> Upload file giả mạo + file sai Công ty bên mua + 2 file Hóa đơn Đúng/Sai
  await loginAs(page, 'ketoan')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/invoices')

  // 4a. Upload file giả mạo .pdf -> báo lỗi
  await page.click('button:has-text("Tải Hóa đơn lên")')
  await page.locator('.modal-container input[type="file"]').setInputFiles(
    path.join(PDF_ROOT, '04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_11_GiaMaoDoiDuoi_FakePDF.pdf')
  )
  await expect(page.locator('.modal-container .alert-error')).toBeVisible()
  await page.screenshot({ path: `${SHOTS_DIR}/04_invoice_upload_fake_pdf_error.png`, fullPage: true })

  // 4b. Upload file sai công ty bên mua -> cảnh báo đỏ
  await page.locator('.modal-container input[type="file"]').setInputFiles(
    path.join(PDF_ROOT, '04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf')
  )
  await expect(page.locator('.extract-summary-card')).toContainText('✕ Sai đơn vị mua hàng')
  await page.screenshot({ path: `${SHOTS_DIR}/05_invoice_upload_wrong_company.png`, fullPage: true })

  // 4c. Upload Hóa đơn ĐÚNG HD_DUNG_01 (00015801) và lưu
  await page.locator('.modal-container input[type="file"]').setInputFiles(
    path.join(PDF_ROOT, '03_Hoa_Don_GTGT_Dung_Doi_Chung/HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf')
  )
  await expect(page.locator('.extract-summary-card')).toContainText('00015801')
  await expect(page.locator('.extract-summary-card')).toContainText('✓ Khớp CÔNG TY CỔ PHẦN BÁNH VIỆT NAM')
  await page.screenshot({ path: `${SHOTS_DIR}/06_invoice_upload_valid_preview.png`, fullPage: true })
  await page.click('button:has-text("Kiểm tra & Lưu Hóa đơn →")')
  await page.click('button:has-text("✓ Lưu Hóa đơn")')
  await expect(page.locator('.alert-success')).toContainText('Đã lưu Hóa đơn')

  // 4d. Upload Hóa đơn SAI lệch đơn giá 6% HD_SAI_01 (00015901) và lưu
  await page.click('button:has-text("Tải Hóa đơn lên")')
  await page.locator('.modal-container input[type="file"]').setInputFiles(
    path.join(PDF_ROOT, '04_Hoa_Don_GTGT_Sai_Mau_Loi/HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf')
  )
  await expect(page.locator('.extract-summary-card')).toContainText('00015901')
  await page.click('button:has-text("Kiểm tra & Lưu Hóa đơn →")')
  await page.click('button:has-text("✓ Lưu Hóa đơn")')
  await expect(page.locator('.alert-success')).toContainText('Đã lưu Hóa đơn')

  // 5. Sang màn hình Đối soát 3 chiều
  await page.goto('/matching')
  const rowValid = page.locator('tbody tr', { hasText: '00015801' })
  await rowValid.click()
  await rowValid.locator('button:has-text("Chạy đối soát")').click()
  await expect(rowValid).toContainText('Khớp')
  await page.screenshot({ path: `${SHOTS_DIR}/07_matching_matched_steps.png`, fullPage: true })

  await rowValid.locator('button:has-text("Hoàn tất đối soát")').click()
  await expect(rowValid).toContainText('Đã đối soát')

  const rowMismatch = page.locator('tbody tr', { hasText: '00015901' })
  await rowMismatch.click()
  await rowMismatch.locator('button:has-text("Chạy đối soát")').click()
  await expect(rowMismatch).toContainText('Lệch')
  await expect(page.locator('.alert-banner.alert-error')).toContainText('Lệch lớn')
  await page.screenshot({ path: `${SHOTS_DIR}/08_matching_mismatch_6pct.png`, fullPage: true })

  // 6. Sang màn hình Tranh chấp -> Mở tranh chấp & Gửi duyệt ngoại lệ
  await page.goto('/exceptions')
  const selectOpt = page.locator('form select option', { hasText: '00015901' })
  await expect(selectOpt).toBeAttached()
  const optVal = await selectOpt.getAttribute('value')
  await page.locator('form select').selectOption(optVal)
  await page.fill('input[placeholder*="Đơn giá"]', 'Nhà cung cấp báo tăng giá bơ lạt 6% theo thị trường')
  await page.click('button:has-text("Tạo Hồ sơ Tranh chấp")')
  await expect(page.locator('.alert-success')).toContainText('Đã mở Hồ sơ tranh chấp')

  await page.fill('input[placeholder*="Nhập lý do xin duyệt ngoại lệ"]', 'Đề nghị Kế toán trưởng duyệt chi do biến động giá')
  await page.click('button:has-text("Gửi duyệt ngoại lệ")')
  await expect(page.locator('.alert-success')).toContainText('Đã gửi Yêu cầu duyệt ngoại lệ')
  await page.screenshot({ path: `${SHOTS_DIR}/09_exception_submitted_to_manager.png`, fullPage: true })

  await logout(page)

  // 7. Đăng nhập Quản lý -> Phê duyệt ngoại lệ -> Dashboard -> Báo cáo Excel
  await loginAs(page, 'quanly')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/exceptions')
  await page.fill('input[placeholder*="Nhập ghi chú quyết định"]', 'Đồng ý duyệt ngoại lệ theo tờ trình')
  const approvalRow = page.locator('tbody tr', { hasText: '00015901' }).filter({ has: page.locator('button:has-text("✓ Duyệt")') })
  await approvalRow.locator('button:has-text("✓ Duyệt")').click()
  await expect(page.locator('.alert-success')).toContainText('RECONCILED')
  await page.screenshot({ path: `${SHOTS_DIR}/10_manager_approved_reconciled.png`, fullPage: true })

  await page.goto('/dashboard')
  await expect(page.locator('h1')).toContainText('Tổng quan')
  await page.screenshot({ path: `${SHOTS_DIR}/11_dashboard_realtime.png`, fullPage: true })

  await page.goto('/reports')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Xuất file Excel")'),
  ])
  expect(download.suggestedFilename()).toContain('.xlsx')
  await page.screenshot({ path: `${SHOTS_DIR}/12_reports_export_xlsx.png`, fullPage: true })

  await logout(page)

  // 8. Đăng nhập Admin -> Kiểm tra Audit Log
  await loginAs(page, 'admin')
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto('/users')
  await expect(page.locator('body')).toContainText('Audit Log')
  await page.screenshot({ path: `${SHOTS_DIR}/13_admin_audit_log.png`, fullPage: true })
})
