import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const require = createRequire(path.join(REPO_ROOT, 'package.json'))
const { chromium } = require('playwright')

const ROOT_OUT = path.join(REPO_ROOT, 'qa', 'pdf-samples')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function qrSvg(seed = 1, accent = '#0f172a') {
  const cells = []
  const size = 21
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTL = r < 7 && c < 7
      const inTR = r < 7 && c >= size - 7
      const inBL = r >= size - 7 && c < 7
      let on = false
      if (inTL || inTR || inBL) {
        const lr = inBL ? r - (size - 7) : r
        const lc = inTR ? c - (size - 7) : c
        on = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4)
      } else {
        on = ((r * 31 + c * 17 + seed * 13) % 5) < 2
      }
      if (on) {
        cells.push(`<rect x="${c * 3}" y="${r * 3}" width="3" height="3" fill="${accent}"/>`)
      }
    }
  }
  return `<svg width="68" height="68" viewBox="0 0 ${size * 3} ${size * 3}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/>${cells.join('')}</svg>`
}

function stampCircleSvg(color = '#dc2626') {
  return `<svg width="96" height="96" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="4 2" opacity="0.72"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="${color}" stroke-width="1.4" opacity="0.72"/>
    <path d="M22 50 L78 50 M50 22 L50 78" stroke="${color}" stroke-width="0.9" opacity="0.28"/>
    <polygon points="50,36 53.5,45 63,45 55.5,51 58,60 50,54.5 42,60 44.5,51 37,45 46.5,45" fill="${color}" opacity="0.55"/>
  </svg>`
}

function signatureBadgeSvg(color = '#15803d') {
  return `<svg width="240" height="58" viewBox="0 0 240 58" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="238" height="56" rx="3" fill="#f0fdf4" stroke="${color}" stroke-width="1.3"/>
    <circle cx="28" cy="29" r="14" fill="#dcfce7" stroke="${color}" stroke-width="1.5"/>
    <path d="M21 29 L26 34 L36 23" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

function renderInvoiceHtml(cfg) {
  const themes = {
    blue: { primary: '#1d4ed8', light: '#eff6ff', border: '#bfdbfe', provider: 'VIETTEL S-INVOICE' },
    red: { primary: '#b91c1c', light: '#fef2f2', border: '#fecaca', provider: 'MISA meInvoice' },
    teal: { primary: '#0f766e', light: '#f0fdfa', border: '#99f6e4', provider: 'BKAV eHoadon' },
  }
  const t = themes[cfg.theme || 'blue']
  const rowsHtml = (cfg.items || [])
    .map(
      (it) => `
      <tr>
        <td class="mono nowrap">${it.sku}</td>
        <td>${it.name}</td>
        <td class="center nowrap">${it.unit}</td>
        <td class="right nowrap">${it.qty}</td>
        <td class="right nowrap">${it.price}</td>
        <td class="right bold nowrap">${it.total}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; font-size: 12.2px; line-height: 1.48; color: #0f172a; margin: 0; }
  .sheet { border: 2px solid ${t.primary}; padding: 16px 18px; position: relative; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${t.primary}; padding-bottom: 10px; margin-bottom: 10px; }
  .title-block { flex: 1; padding-right: 12px; }
  .doc-title { font-size: 20px; font-weight: 800; color: ${t.primary}; letter-spacing: 0.4px; margin: 0 0 2px; }
  .doc-sub { font-size: 11px; color: #475569; margin: 0 0 6px; font-style: italic; }
  .meta-line { margin: 2px 0; font-size: 12px; }
  .qr-box { border: 1px solid ${t.border}; padding: 4px; background: #fff; text-align: center; }
  .section-box { background: ${t.light}; border: 1px solid ${t.border}; padding: 9px 12px; margin-bottom: 9px; }
  .section-title { font-size: 11px; font-weight: 700; color: ${t.primary}; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.3px; }
  .field-line { margin: 2.5px 0; }
  .field-line b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  th { background: ${t.primary}; color: #ffffff; padding: 7px 6px; text-align: left; font-weight: 700; border: 1px solid ${t.primary}; }
  td { padding: 7px 6px; border: 1px solid #cbd5e1; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  .mono { font-family: Consolas, "Courier New", monospace; font-weight: 700; color: #1e293b; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .nowrap { white-space: nowrap; }
  .totals-box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px 14px; margin-top: 8px; }
  .total-line { margin: 3px 0; font-size: 12.5px; }
  .grand-total { font-size: 14px; font-weight: 800; color: ${t.primary}; border-top: 1px solid #cbd5e1; padding-top: 5px; margin-top: 5px; }
  .words-line { margin-top: 6px; font-style: italic; font-size: 11.8px; color: #334155; }
  .sign-area { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 18px; padding-top: 10px; border-top: 1px dashed #cbd5e1; }
  .sign-col { width: 46%; text-align: center; }
  .sign-label { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
  .sign-sub { font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 8px; }
  .sig-wrap { position: relative; display: inline-block; }
  .sig-text { position: absolute; left: 50px; top: 8px; text-align: left; font-size: 10.5px; color: #166534; line-height: 1.3; }
  .footer-note { margin-top: 10px; font-size: 10.5px; color: #64748b; text-align: center; }
  .missing-notice { padding: 14px; border: 1px dashed #dc2626; background: #fef2f2; color: #991b1b; margin: 12px 0; font-size: 12px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="header-row">
    <div class="title-block">
      <div class="doc-title">${cfg.title || 'HÓA ĐƠN GIÁ TRỊ GIA TĂNG'}</div>
      <div class="doc-sub">(Bản thể hiện của hóa đơn điện tử theo Nghị định 123/2020/NĐ-CP — ${t.provider})</div>
      ${cfg.serial ? `<div class="meta-line">Mẫu số - Ký hiệu: <b>${cfg.serial}</b></div>` : ''}
      ${cfg.soHoaDon ? `<div class="meta-line">Số hóa đơn: <b>${cfg.soHoaDon}</b></div>` : ''}
      ${cfg.ngayLap ? `<div class="meta-line">Ngày lập: <b>${cfg.ngayLap}</b></div>` : ''}
      ${cfg.maCqt ? `<div class="meta-line">Mã của Cơ quan thuế: <b>${cfg.maCqt}</b></div>` : ''}
    </div>
    <div class="qr-box">${qrSvg(cfg.seed || 1, t.primary)}</div>
  </div>

  <div class="section-box">
    <div class="section-title">Thông tin Bên bán (Nhà cung cấp)</div>
    <div class="field-line">Đơn vị bán hàng: <b>${cfg.sellerName}</b></div>
    ${cfg.sellerMst ? `<div class="field-line">Mã số thuế: <b>${cfg.sellerMst}</b></div>` : ''}
    ${cfg.sellerAddr ? `<div class="field-line">Địa chỉ: ${cfg.sellerAddr}</div>` : ''}
    ${cfg.sellerBank ? `<div class="field-line">Số tài khoản: ${cfg.sellerBank}</div>` : ''}
  </div>

  <div class="section-box">
    <div class="section-title">Thông tin Bên mua (Khách hàng)</div>
    ${cfg.buyerPerson ? `<div class="field-line">Họ tên người mua hàng: ${cfg.buyerPerson}</div>` : ''}
    <div class="field-line">Tên đơn vị mua hàng: <b>${cfg.buyerName}</b></div>
    ${cfg.buyerMst ? `<div class="field-line">Mã số thuế: <b>${cfg.buyerMst}</b></div>` : ''}
    ${cfg.buyerAddr ? `<div class="field-line">Địa chỉ: ${cfg.buyerAddr}</div>` : ''}
    ${cfg.soPo ? `<div class="field-line">Số PO: <b>${cfg.soPo}</b></div>` : ''}
    ${cfg.paymentMethod ? `<div class="field-line">Hình thức thanh toán: ${cfg.paymentMethod}</div>` : ''}
  </div>

  ${
    cfg.items && cfg.items.length
      ? `<table>
          <thead>
            <tr>
              <th>Mã hàng</th>
              <th>Tên hàng hóa, dịch vụ</th>
              <th class="center">ĐVT</th>
              <th class="right">Số lượng</th>
              <th class="right">Đơn giá</th>
              <th class="right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
      : `<div class="missing-notice">${cfg.missingNotice || 'Không có bảng kê chi tiết hàng hóa.'}</div>`
  }

  ${
    cfg.hideTotals
      ? ''
      : `<div class="totals-box">
          ${cfg.subtotal != null ? `<div class="total-line">Cộng tiền hàng: <b>${cfg.subtotal}</b></div>` : ''}
          ${cfg.vatAmount != null ? `<div class="total-line">Tiền thuế GTGT: <b>${cfg.vatAmount}</b></div>` : ''}
          ${cfg.vatRate ? `<div class="total-line">Thuế suất GTGT: <b>${cfg.vatRate}</b></div>` : ''}
          ${cfg.deposit != null ? `<div class="total-line">Trừ cọc: <b>${cfg.deposit}</b></div>` : ''}
          ${cfg.grandTotal != null ? `<div class="total-line grand-total">Tổng cộng tiền thanh toán: <b>${cfg.grandTotal}</b></div>` : ''}
          ${cfg.amountWords ? `<div class="words-line">Số tiền viết bằng chữ: ${cfg.amountWords}</div>` : ''}
        </div>`
  }

  <div class="sign-area">
    <div class="sign-col">
      <div class="sign-label">Người mua hàng</div>
      <div class="sign-sub">(Ký, ghi rõ họ tên)</div>
      <div style="height:46px;"></div>
    </div>
    <div class="sign-col">
      <div class="sign-label">Người bán hàng</div>
      <div class="sign-sub">(Ký điện tử hợp lệ)</div>
      <div class="sig-wrap">
        ${signatureBadgeSvg()}
        <div class="sig-text">
          <b>Signature Valid</b><br/>
          Ký bởi: ${cfg.sellerName.slice(0, 30)}<br/>
          Ngày ký: ${cfg.ngayLap || '2026'}
        </div>
      </div>
    </div>
  </div>
  <div class="footer-note">Đơn vị tính tiền tệ: Đồng Việt Nam (VNĐ) — Tra cứu hóa đơn điện tử chuẩn NĐ 123/2020/NĐ-CP.</div>
</div>
</body>
</html>`
}

function renderGrnHtml(cfg) {
  const rowsHtml = (cfg.items || [])
    .map(
      (it) => `
      <tr>
        <td class="mono nowrap">${it.sku}</td>
        <td>${it.name}</td>
        <td class="center nowrap">${it.unit}</td>
        <td class="right nowrap">${it.received}</td>
        <td class="right bold nowrap">${it.accepted}</td>
        <td class="right nowrap">${it.rejected}</td>
        <td class="nowrap">${it.reason || ''}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Segoe UI", sans-serif; font-size: 11.8px; line-height: 1.46; color: #0f172a; margin: 0; }
  .sheet { border: 1.8px solid #1e293b; padding: 16px 18px; }
  .form-strip { text-align: right; font-size: 11px; color: #334155; margin-bottom: 4px; }
  .top-row { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 10px; }
  .buyer-hdr { width: 100%; }
  .hdr-line { margin: 2px 0; font-size: 12px; }
  .doc-title { text-align: center; font-size: 20px; font-weight: 800; color: #0f172a; margin: 8px 0 2px; letter-spacing: 0.5px; }
  .doc-sub { text-align: center; font-size: 11px; color: #475569; font-style: italic; margin-bottom: 12px; }
  .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 14px; margin-bottom: 12px; }
  .meta-line { margin: 3px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 11.2px; }
  th { background: #1e293b; color: #ffffff; padding: 6px 5px; border: 1px solid #1e293b; text-align: left; }
  td { padding: 6px 5px; border: 1px solid #cbd5e1; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  .mono { font-family: Consolas, "Courier New", monospace; font-weight: 700; }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .nowrap { white-space: nowrap; }
  .sign-grid { display: flex; justify-content: space-between; margin-top: 22px; text-align: center; }
  .sign-box { width: 31%; }
  .sign-title { font-weight: 700; font-size: 12px; }
  .sign-hint { font-size: 11px; color: #64748b; font-style: italic; margin-bottom: 8px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="form-strip">
    <b>Mẫu số: 01 - VT</b> — (Ban hành theo Thông tư 200/2014/TT-BTC)
  </div>
  <div class="top-row">
    <div class="buyer-hdr">
      <div class="hdr-line">Đơn vị nhập: <b>${cfg.unitName}</b></div>
      <div class="hdr-line">Mã số thuế: <b>${cfg.unitMst}</b></div>
      <div class="hdr-line">Địa chỉ: ${cfg.unitAddr || 'A41, Khu dân cư Kim Sơn, Phường Tân Hưng, TP. Hồ Chí Minh'}</div>
    </div>
  </div>

  <div class="doc-title">PHIẾU NHẬP KHO</div>
  <div class="doc-sub">Chứng từ xác nhận kiểm đếm thực tế hàng hóa nhập kho (Goods Receipt Note)</div>

  <div class="meta-box">
    <div class="meta-line">Số phiếu: <b>${cfg.soPhieu}</b></div>
    <div class="meta-line">Ngày nhập: <b>${cfg.ngayNhap}</b></div>
    <div class="meta-line">Số PO: <b>${cfg.soPo}</b></div>
    <div class="meta-line">Nhà cung cấp giao hàng: <b>${cfg.supplierName}</b> (MST: ${cfg.supplierMst})</div>
    <div class="meta-line">Kho nhập: ${cfg.warehouse || 'Kho Nguyên Liệu Trung Tâm - TP. Hồ Chí Minh'}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Mã SKU</th>
        <th>Tên nhãn hiệu, quy cách, phẩm chất vật tư</th>
        <th class="center">ĐVT</th>
        <th class="right">Thực nhận</th>
        <th class="right">Đạt chuẩn</th>
        <th class="right">Từ chối</th>
        <th>Ghi chú / Lý do từ chối</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="sign-grid">
    <div class="sign-box">
      <div class="sign-title">Người giao hàng</div>
      <div class="sign-hint">(Ký, ghi rõ họ tên)</div>
      <div style="height:70px;"></div>
      <div>Đại diện ${cfg.supplierShort || 'Nhà cung cấp'}</div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Thủ kho kiểm nhận</div>
      <div class="sign-hint">(Ký, đóng dấu xác nhận)</div>
      <div>${stampCircleSvg('#dc2626')}</div>
      <div><b>Trần Thủ Kho</b></div>
    </div>
    <div class="sign-box">
      <div class="sign-title">Kế toán trưởng / Giám đốc</div>
      <div class="sign-hint">(Ký, ghi rõ họ tên)</div>
      <div style="height:70px;"></div>
      <div>Phạm Kế Toán Trưởng</div>
    </div>
  </div>
</div>
</body>
</html>`
}

const COMP_NAME = 'CÔNG TY CỔ PHẦN BÁNH VIỆT NAM'
const COMP_MST = '0108666888'
const COMP_ADDR = 'A41, Khu dân cư Kim Sơn, Phường Tân Hưng, Thành phố Hồ Chí Minh'

const GRN_DOCS = [
  {
    folder: '01-grn-valid',
    file: 'GRN_DUNG_01_NhapDu_PO101.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-2026-101',
    ngayNhap: '06/10/2026',
    soPo: 'PO-2026-101',
    supplierName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    supplierMst: '0314567890',
    supplierShort: 'NCC Á Châu',
    items: [
      { sku: 'SKU-BM01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', received: '200', accepted: '200', rejected: '0', reason: '' },
      { sku: 'SKU-BO02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', received: '30', accepted: '30', rejected: '0', reason: '' },
    ],
  },
  {
    folder: '01-grn-valid',
    file: 'GRN_DUNG_02_NhapMotPhan_CoHangLoi_PO102.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-2026-102A',
    ngayNhap: '07/10/2026',
    soPo: 'PO-2026-102',
    supplierName: 'CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT',
    supplierMst: '0316789012',
    supplierShort: 'NCC Nam Việt',
    items: [
      { sku: 'SKU-HB01', name: 'Hộp giấy đựng bánh cao cấp', unit: 'Cái', received: '600', accepted: '500', rejected: '100', reason: 'Hộp móp méo ẩm ướt khi vận chuyển' },
    ],
  },
  {
    folder: '01-grn-valid',
    file: 'GRN_DUNG_03_NhapBoSungDot2_DuHang_PO102.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-2026-102B',
    ngayNhap: '12/10/2026',
    soPo: 'PO-2026-102',
    supplierName: 'CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT',
    supplierMst: '0316789012',
    supplierShort: 'NCC Nam Việt',
    items: [
      { sku: 'SKU-HB01', name: 'Hộp giấy đựng bánh cao cấp', unit: 'Cái', received: '500', accepted: '500', rejected: '0', reason: '' },
    ],
  },
  {
    folder: '02-grn-invalid',
    file: 'GRN_SAI_01_SaiCongTyBenMua_MST.pdf',
    unitName: 'CÔNG TY TNHH THỰC PHẨM ĐÔNG ĐÔ',
    unitMst: '0309998887',
    unitAddr: '88 Nguyễn Trãi, Quận Thanh Xuân, TP. Hà Nội',
    soPhieu: 'GRN-2026-901',
    ngayNhap: '06/10/2026',
    soPo: 'PO-2026-101',
    supplierName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    supplierMst: '0314567890',
    supplierShort: 'NCC Á Châu',
    items: [
      { sku: 'SKU-BM01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', received: '200', accepted: '200', rejected: '0', reason: '' },
      { sku: 'SKU-BO02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', received: '30', accepted: '30', rejected: '0', reason: '' },
    ],
  },
  {
    folder: '02-grn-invalid',
    file: 'GRN_SAI_02_VuotSoLuongDatPO_TriggerChan.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-2026-902',
    ngayNhap: '07/10/2026',
    soPo: 'PO-2026-102',
    supplierName: 'CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT',
    supplierMst: '0316789012',
    supplierShort: 'NCC Nam Việt',
    items: [
      { sku: 'SKU-HB01', name: 'Hộp giấy đựng bánh cao cấp', unit: 'Cái', received: '1.200', accepted: '1.200', rejected: '0', reason: '' },
    ],
  },
  {
    folder: '02-grn-invalid',
    file: 'GRN_SAI_03_TrungSoPhieu_Va_SaiPO.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-001',
    ngayNhap: '08/10/2026',
    soPo: 'PO-2026-999',
    supplierName: 'Công ty ABC',
    supplierMst: '0312345678',
    supplierShort: 'Công ty ABC',
    items: [
      { sku: 'SKU-01', name: 'Thiết bị 5G tiêu chuẩn', unit: 'Bộ', received: '10', accepted: '10', rejected: '0', reason: '' },
    ],
  },
  {
    folder: '02-grn-invalid',
    file: 'GRN_SAI_04_LapChoPODichVu_TriggerChan.pdf',
    unitName: COMP_NAME,
    unitMst: COMP_MST,
    soPhieu: 'GRN-2026-904',
    ngayNhap: '09/10/2026',
    soPo: 'PO-2026-104',
    supplierName: 'CÔNG TY TNHH KỸ THUẬT LÒ NƯỚNG ĐÔNG DƯƠNG',
    supplierMst: '0318901234',
    supplierShort: 'NCC Đông Dương',
    items: [
      { sku: 'SKU-DV01', name: 'Bảo trì dây chuyền lò nướng công nghiệp', unit: 'Gói', received: '1', accepted: '1', rejected: '0', reason: '' },
    ],
  },
]

const INVOICE_DOCS = [
  // --- NHÓM ĐÚNG (ĐỐI CHỨNG) ---
  {
    folder: '03-invoice-valid',
    file: 'HD_DUNG_01_KhopTuyetDoi_3Chieu_PO101.pdf',
    theme: 'blue',
    seed: 11,
    serial: '1C26TAC',
    soHoaDon: '00015801',
    ngayLap: '15/10/2026',
    maCqt: '0070115A8B9C2026101500015801',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    sellerBank: '102030405060 — Ngân hàng ACB CN Tân Phú',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-101',
    paymentMethod: 'Chuyển khoản (Net 30)',
    items: [
      { sku: 'AC-BOTMI-01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', qty: '200', price: '350.000', total: '70.000.000' },
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '30', price: '1.000.000', total: '30.000.000' },
    ],
    subtotal: '100.000.000',
    vatAmount: '10.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '110.000.000',
    amountWords: 'Một trăm mười triệu đồng chẵn.',
  },
  {
    folder: '03-invoice-valid',
    file: 'HD_DUNG_02_LechNhoTrongDungSai_1.5Pct_TruCoc_PO103.pdf',
    theme: 'red',
    seed: 12,
    serial: '1C26TAC',
    soHoaDon: '00015802',
    ngayLap: '16/10/2026',
    maCqt: '0070115A8B9C2026101600015802',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-103',
    paymentMethod: 'Chuyển khoản (Trừ tiền đặt cọc 20.000.000 đ)',
    items: [
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '100', price: '1.015.000', total: '101.500.000' },
    ],
    subtotal: '101.500.000',
    vatAmount: '10.150.000',
    vatRate: '10%',
    deposit: '20.000.000',
    grandTotal: '91.650.000',
    amountWords: 'Chín mươi mốt triệu sáu trăm năm mươi nghìn đồng chẵn.',
  },
  {
    folder: '03-invoice-valid',
    file: 'HD_DUNG_03_GiaoMotPhan_Partial_PO102.pdf',
    theme: 'teal',
    seed: 13,
    serial: '1C26TNV',
    soHoaDon: '00024601',
    ngayLap: '10/10/2026',
    maCqt: '0070115B4D2E2026101000024601',
    sellerName: 'CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT',
    sellerMst: '0316789012',
    sellerAddr: 'Lô II-3, KCN Tân Bình, Quận Tân Bình, TP. Hồ Chí Minh',
    buyerPerson: 'Lê Văn Hùng',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-102',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'NV-HOPBANH-01', name: 'Hộp giấy đựng bánh cao cấp', unit: 'Cái', qty: '500', price: '100.000', total: '50.000.000' },
    ],
    subtotal: '50.000.000',
    vatAmount: '5.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '55.000.000',
    amountWords: 'Năm mươi lăm triệu đồng chẵn.',
  },
  {
    folder: '03-invoice-valid',
    file: 'HD_DUNG_04_PODichVu_DoiSoat2Chieu_PO104.pdf',
    theme: 'blue',
    seed: 14,
    serial: '1C26TDD',
    soHoaDon: '00038901',
    ngayLap: '18/10/2026',
    maCqt: '0070115C9F1A2026101800038901',
    sellerName: 'CÔNG TY TNHH KỸ THUẬT LÒ NƯỚNG ĐÔNG DƯƠNG',
    sellerMst: '0318901234',
    sellerAddr: 'Số 18 Đường số 4, KCN Sóng Thần 1, Dĩ An, Bình Dương',
    buyerPerson: 'Nguyễn Minh Hoàng',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-104',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'DD-BAOTRI-01', name: 'Bảo trì dây chuyền lò nướng công nghiệp', unit: 'Gói', qty: '1', price: '50.000.000', total: '50.000.000' },
    ],
    subtotal: '50.000.000',
    vatAmount: '4.000.000',
    vatRate: '8%',
    deposit: '0',
    grandTotal: '54.000.000',
    amountWords: 'Năm mươi bốn triệu đồng chẵn.',
  },
  {
    folder: '03-invoice-valid',
    file: 'HD_DUNG_05_VietTatTenCongTy_VanKhop_PO001.pdf',
    theme: 'red',
    seed: 15,
    serial: '1C26TAB',
    soHoaDon: 'HD-2026-0458',
    ngayLap: '12/10/2026',
    maCqt: '0070115D1E2F2026101200000458',
    sellerName: 'Công ty ABC',
    sellerMst: '0312345678',
    sellerAddr: 'Số 45 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    buyerPerson: 'Trần Thị Minh Thu',
    buyerName: 'Cty CP Bánh VN',
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-001',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'ABC-01', name: 'Thiết bị 5G tiêu chuẩn', unit: 'Bộ', qty: '100', price: '1.000.000', total: '100.000.000' },
    ],
    subtotal: '100.000.000',
    vatAmount: '10.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '110.000.000',
    amountWords: 'Một trăm mười triệu đồng chẵn.',
  },

  // --- NHÓM SAI (MẪU LỖI NGHIỆP VỤ & KỸ THUẬT) ---
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_01_LechDonGia_6Pct_TrinhDuyetNgoaiLe_PO105.pdf',
    theme: 'blue',
    seed: 21,
    serial: '1C26TAC',
    soHoaDon: '00015901',
    ngayLap: '17/10/2026',
    maCqt: '0070115E11222026101700015901',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-105',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '100', price: '1.060.000', total: '106.000.000' },
    ],
    subtotal: '106.000.000',
    vatAmount: '10.600.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '116.600.000',
    amountWords: 'Một trăm mười sáu triệu sáu trăm nghìn đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_02_LechDonGia_15Pct_VuotHanMucDuyet_PO101.pdf',
    theme: 'red',
    seed: 22,
    serial: '1C26TAC',
    soHoaDon: '00015902',
    ngayLap: '15/10/2026',
    maCqt: '0070115E22332026101500015902',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-101',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'AC-BOTMI-01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', qty: '200', price: '350.000', total: '70.000.000' },
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '30', price: '1.500.000', total: '45.000.000' },
    ],
    subtotal: '115.000.000',
    vatAmount: '11.500.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '126.500.000',
    amountWords: 'Một trăm hai mươi sáu triệu năm trăm nghìn đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_03_KhaiKhongSoLuong_VuotNhapKho_PO102.pdf',
    theme: 'teal',
    seed: 23,
    serial: '1C26TNV',
    soHoaDon: '00024903',
    ngayLap: '10/10/2026',
    maCqt: '0070115E33442026101000024903',
    sellerName: 'CÔNG TY TNHH BAO BÌ THỰC PHẨM NAM VIỆT',
    sellerMst: '0316789012',
    sellerAddr: 'Lô II-3, KCN Tân Bình, Quận Tân Bình, TP. Hồ Chí Minh',
    buyerPerson: 'Lê Văn Hùng',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-102',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'NV-HOPBANH-01', name: 'Hộp giấy đựng bánh cao cấp', unit: 'Cái', qty: '600', price: '100.000', total: '60.000.000' },
    ],
    subtotal: '60.000.000',
    vatAmount: '6.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '66.000.000',
    amountWords: 'Sáu mươi sáu triệu đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_04_SaiThongTinCongTyBenMua_SaiMST_PO101.pdf',
    theme: 'blue',
    seed: 24,
    serial: '1C26TAC',
    soHoaDon: '00015904',
    ngayLap: '15/10/2026',
    maCqt: '0070115E44552026101500015904',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Phạm Quốc Bảo',
    buyerName: 'CÔNG TY TNHH BÁNH KẸO MIỀN NAM',
    buyerMst: '0309991112',
    buyerAddr: 'Số 99 Đường 3/2, Quận 10, TP. Hồ Chí Minh',
    soPo: 'PO-2026-101',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'AC-BOTMI-01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', qty: '200', price: '350.000', total: '70.000.000' },
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '30', price: '1.000.000', total: '30.000.000' },
    ],
    subtotal: '100.000.000',
    vatAmount: '10.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '110.000.000',
    amountWords: 'Một trăm mười triệu đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_05_MaHangSKULa_ChuaAnhXa_PO101.pdf',
    theme: 'red',
    seed: 25,
    serial: '1C26TAC',
    soHoaDon: '00015905',
    ngayLap: '15/10/2026',
    maCqt: '0070115E55662026101500015905',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-101',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'AC-BOTMI-01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', qty: '200', price: '350.000', total: '70.000.000' },
      { sku: 'AC-PHUGIA-99', name: 'Phụ gia hương vani đặc biệt', unit: 'Hộp', qty: '10', price: '500.000', total: '5.000.000' },
    ],
    subtotal: '75.000.000',
    vatAmount: '7.500.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '82.500.000',
    amountWords: 'Tám mươi hai triệu năm trăm nghìn đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_06_QuenTruTienCoc_SaiTongTien_PO103.pdf',
    theme: 'teal',
    seed: 26,
    serial: '1C26TAC',
    soHoaDon: '00015906',
    ngayLap: '16/10/2026',
    maCqt: '0070115E66772026101600015906',
    sellerName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
    sellerMst: '0314567890',
    sellerAddr: '120 Lê Trọng Tấn, Phường Tây Thạnh, Quận Tân Phú, TP. Hồ Chí Minh',
    buyerPerson: 'Nguyễn Thị Lan',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-103',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'AC-BOLAT-02', name: 'Bơ lạt nhập khẩu Anchor', unit: 'Hộp', qty: '100', price: '1.000.000', total: '100.000.000' },
    ],
    subtotal: '100.000.000',
    vatAmount: '10.000.000',
    vatRate: '10%',
    deposit: '25.000.000',
    grandTotal: '85.000.000',
    amountWords: 'Tám mươi lăm triệu đồng chẵn (Trừ cọc sai vượt 20.000.000 đ trên PO).',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_07_TrungSoHoaDon_Va_SaiPO_BR01.pdf',
    theme: 'blue',
    seed: 27,
    serial: '1C26TAB',
    soHoaDon: 'HD-0457',
    ngayLap: '10/10/2026',
    maCqt: '0070115E77882026101000000457',
    sellerName: 'Công ty ABC',
    sellerMst: '0312345678',
    sellerAddr: 'Số 45 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    buyerPerson: 'Trần Thị Minh Thu',
    buyerName: COMP_NAME,
    buyerMst: COMP_MST,
    buyerAddr: COMP_ADDR,
    soPo: 'PO-2026-999',
    paymentMethod: 'Chuyển khoản',
    items: [
      { sku: 'ABC-01', name: 'Thiết bị 5G tiêu chuẩn', unit: 'Bộ', qty: '100', price: '1.000.000', total: '100.000.000' },
    ],
    subtotal: '100.000.000',
    vatAmount: '10.000.000',
    vatRate: '10%',
    deposit: '0',
    grandTotal: '110.000.000',
    amountWords: 'Một trăm mười triệu đồng chẵn.',
  },
  {
    folder: '04-invoice-invalid',
    file: 'HD_SAI_09_ThieuTruongBatBuoc_KhongCoBangHang_UC07.pdf',
    theme: 'red',
    seed: 29,
    serial: null,
    soHoaDon: '00099001',
    ngayLap: null,
    maCqt: null,
    sellerName: 'CÔNG TY TNHH DỊCH VỤ KHÔNG ĐẦY ĐỦ',
    sellerMst: null,
    sellerAddr: 'Chưa cập nhật địa chỉ',
    buyerPerson: null,
    buyerName: COMP_NAME,
    buyerMst: null,
    buyerAddr: COMP_ADDR,
    soPo: null,
    items: [],
    missingNotice: 'Chứng từ thiếu thông tin bắt buộc và không có bảng kê chi tiết hàng hóa (Kiểm thử ngoại lệ UC07 - chuyển sang nhập thủ công).',
    hideTotals: true,
  },
]

const WRONG_TYPE_GRN_FOR_INVOICE_FOLDER = {
  folder: '04-invoice-invalid',
  file: 'HD_SAI_08_NhamFile_TaiPhieuKhoVaoMucHoaDon.pdf',
  unitName: COMP_NAME,
  unitMst: COMP_MST,
  soPhieu: 'GRN-2026-888',
  ngayNhap: '06/10/2026',
  soPo: 'PO-2026-101',
  supplierName: 'CÔNG TY CỔ PHẦN NGUYÊN LIỆU BÁNH Á CHÂU',
  supplierMst: '0314567890',
  supplierShort: 'NCC Á Châu',
  items: [
    { sku: 'SKU-BM01', name: 'Bột mì đa dụng thượng hạng', unit: 'Bao', received: '200', accepted: '200', rejected: '0', reason: '' },
  ],
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()

    for (const doc of GRN_DOCS) {
      const dir = path.join(ROOT_OUT, doc.folder)
      ensureDir(dir)
      await page.setContent(renderGrnHtml(doc), { waitUntil: 'load' })
      await page.pdf({ path: path.join(dir, doc.file), format: 'A4', printBackground: true })
      console.log('Generated GRN:', doc.file)
    }

    for (const doc of INVOICE_DOCS) {
      const dir = path.join(ROOT_OUT, doc.folder)
      ensureDir(dir)
      await page.setContent(renderInvoiceHtml(doc), { waitUntil: 'load' })
      await page.pdf({ path: path.join(dir, doc.file), format: 'A4', printBackground: true })
      console.log('Generated INV:', doc.file)
    }

    // HD_SAI_08: là file GRN nhưng bỏ vào thư mục Hóa đơn sai để test cảnh báo nhầm chứng từ
    {
      const dir = path.join(ROOT_OUT, WRONG_TYPE_GRN_FOR_INVOICE_FOLDER.folder)
      ensureDir(dir)
      await page.setContent(renderGrnHtml(WRONG_TYPE_GRN_FOR_INVOICE_FOLDER), { waitUntil: 'load' })
      await page.pdf({ path: path.join(dir, WRONG_TYPE_GRN_FOR_INVOICE_FOLDER.file), format: 'A4', printBackground: true })
      console.log('Generated INV (Wrong type GRN):', WRONG_TYPE_GRN_FOR_INVOICE_FOLDER.file)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
