import { formatVND } from './format'

export const ACTION_META = {
  INSERT: { label: 'Tạo mới', tone: 'success' },
  UPDATE: { label: 'Cập nhật', tone: 'warning' },
  DELETE: { label: 'Xóa', tone: 'danger' },
  UPLOAD: { label: 'Tải chứng từ', tone: 'info' },
  INIT: { label: 'Khởi tạo', tone: 'info' },
}

export const ENTITY_META = {
  hoa_don: 'Hóa đơn B2B',
  don_hang_po: 'Đơn đặt hàng (PO)',
  phieu_kho: 'Phiếu nhập kho (GRN)',
  nha_cung_cap: 'Nhà cung cấp',
  anh_xa_sku: 'Ánh xạ SKU',
  lan_doi_soat: 'Đối soát 3 chiều',
  tranh_chap: 'Hồ sơ tranh chấp',
  yeu_cau_duyet_ngoai_le: 'Duyệt ngoại lệ',
  cau_hinh_doi_soat: 'Cấu hình đối soát',
  thong_tin_cong_ty: 'Hồ sơ pháp lý Công ty',
  nguoi_dung: 'Tài khoản người dùng',
}

export const STATUS_LABELS = {
  CHUA_DOI_SOAT: 'Chưa đối soát',
  MATCHED: 'Khớp',
  PARTIAL: 'Khớp một phần / Nhập một phần',
  MISMATCH: 'Lệch',
  RECONCILED: 'Đã đối soát',
  OPEN: 'Đang mở',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  PARTIALLY_RECEIVED: 'Nhận một phần',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
  CONFIRMED: 'Đủ hàng',
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
  HANG_HOA: 'Hàng hóa',
  DICH_VU: 'Dịch vụ',
  MUA_HANG: 'Nhân viên mua hàng',
  THU_KHO: 'Thủ kho',
  KE_TOAN_AP: 'Kế toán AP',
  QUAN_LY: 'Quản lý (Kế toán trưởng)',
  QUAN_TRI: 'Quản trị hệ thống',
  TOAN_QUYEN: 'Toàn quyền Kiểm thử',
  PDF_DIEN_TU: 'PDF điện tử',
  PDF_SCAN: 'PDF scan (OCR)',
  PDF_HON_HOP: 'PDF hỗn hợp',
}

export const FIELD_LABELS = {
  so_hoa_don: 'Số hóa đơn',
  tong_truoc_vat: 'Tiền trước thuế',
  vat: 'Thuế GTGT',
  tien_coc_tru: 'Tiền cọc trừ',
  tong_thanh_toan: 'Tổng thanh toán',
  trang_thai: 'Trạng thái',
  ngay_lap: 'Ngày lập',
  ma_cqt: 'Mã CQT',
  ten_nguoi_mua: 'Đơn vị mua hàng',
  mst_nguoi_mua: 'MST bên mua',
  theo_ngoai_le: 'Duyệt ngoại lệ',
  so_po: 'Số PO',
  loai_po: 'Loại PO',
  ngay_dat: 'Ngày đặt',
  tong_tien: 'Tổng giá trị',
  tien_coc: 'Tiền cọc',
  dieu_khoan_tt: 'Điều khoản TT',
  so_phieu: 'Số phiếu kho',
  ngay_nhap: 'Ngày nhập kho',
  ten: 'Tên nhà cung cấp',
  mst: 'Mã số thuế',
  dia_chi: 'Địa chỉ',
  ma_sku_ncc: 'SKU nhà cung cấp',
  ma_sku_noi_bo: 'SKU nội bộ',
  ten_san_pham: 'Tên sản phẩm',
  ten_dang_nhap: 'Tên đăng nhập',
  ho_ten: 'Họ và tên',
  vai_tro: 'Vai trò',
  hoat_dong: 'Trạng thái tài khoản',
  ket_qua: 'Kết quả đối soát',
  lech_lon: 'Cảnh báo lệch lớn',
  muc_lech_tien: 'Mức lệch tiền',
  chi_tiet_buoc: 'Chi tiết các bước đối soát',
  ly_do: 'Lý do',
  ghi_chu: 'Ghi chú',
  dung_sai_don_gia_pct: 'Dung sai đơn giá',
  nguong_lech_lon_pct: 'Ngưỡng lệch lớn (%)',
  nguong_lech_lon_tien: 'Ngưỡng lệch lớn (tiền)',
  han_muc_duyet: 'Hạn mức duyệt ngoại lệ',
  file_pdf: 'Tệp đính kèm',
  loai_file: 'Định dạng tệp',
  phuong_phap: 'Phương pháp trích xuất',
  so_trang: 'Số trang',
  po_id: 'Mã PO',
  hoa_don_id: 'Mã hóa đơn',
  nha_cung_cap_id: 'Mã NCC',
  tranh_chap_id: 'Mã tranh chấp',
  lan_doi_soat_id: 'Mã lần đối soát',
  hieu_luc_tu: 'Hiệu lực từ',
  thoi_gian: 'Thời gian',
  ngay_duyet: 'Ngày duyệt',
  ngay_dong: 'Ngày đóng',
  ten_cong_ty: 'Tên công ty',
  ten_tieng_anh: 'Tên tiếng Anh',
  ten_viet_tat: 'Tên viết tắt',
  loai_hinh_dn: 'Loại hình doanh nghiệp',
  ma_cqt_quan_ly: 'Mã CQT quản lý',
  co_quan_thue_quan_ly: 'Cơ quan Thuế quản lý',
  nguoi_dai_dien: 'Người đại diện pháp luật',
  chuc_vu_dai_dien: 'Chức vụ đại diện',
  so_giay_phep_dkkd: 'Số GCN ĐKKD',
  ngay_cap_dkkd: 'Ngày cấp ĐKKD',
  noi_cap_dkkd: 'Nơi cấp ĐKKD',
  so_tai_khoan: 'Số tài khoản ngân hàng',
  ngan_hang: 'Ngân hàng mở tài khoản',
  dien_thoai: 'Số điện thoại',
  email: 'Email doanh nghiệp',
  website: 'Website',
  ngay_cap_nhat: 'Ngày cập nhật',
}

const MONEY_FIELDS = new Set([
  'tong_thanh_toan',
  'tong_truoc_vat',
  'vat',
  'tien_coc',
  'tien_coc_tru',
  'tong_tien',
  'muc_lech_tien',
  'nguong_lech_lon_tien',
  'han_muc_duyet',
])

const PCT_FIELDS = new Set(['dung_sai_don_gia_pct', 'nguong_lech_lon_pct'])

const TECHNICAL_FIELDS = new Set([
  'id',
  'ngay_tao',
  'mat_khau_bam',
  'nguoi_tao_id',
  'nguoi_lap_id',
  'nguoi_chay_id',
  'nguoi_cau_hinh_id',
])

function safeParseObject(raw) {
  if (!raw) return null
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const clean = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k !== 'mat_khau_bam') clean[k] = v
  }
  return clean
}

function summarizeMatchingSteps(steps) {
  if (!Array.isArray(steps)) return '—'
  const total = steps.length
  const passed = steps.filter((s) => s && (s.dat === true || s.ket_qua === 'PASS' || s.hop_le === true)).length
  const failed = total - passed
  if (failed > 0) return `${total} bước kiểm tra (${passed} đạt, ${failed} lệch)`
  return `${total} bước kiểm tra (${passed} đạt)`
}

export function formatFieldValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'

  if (key === 'chi_tiet_buoc') {
    if (Array.isArray(value)) return summarizeMatchingSteps(value)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return summarizeMatchingSteps(parsed)
      } catch {
        // fallback below
      }
    }
  }

  if (typeof value === 'boolean') {
    if (key === 'hoat_dong') return value ? 'Hoạt động' : 'Đã khóa'
    if (key === 'lech_lon') return value ? 'Có (Lệch lớn)' : 'Không'
    return value ? 'Có' : 'Không'
  }

  if (MONEY_FIELDS.has(key)) {
    return formatVND(value)
  }

  if (PCT_FIELDS.has(key)) {
    const num = Number(value)
    return Number.isNaN(num) ? String(value) : `${num}%`
  }

  if (typeof value === 'string') {
    if (STATUS_LABELS[value]) return STATUS_LABELS[value]
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-')
      return `${d}/${m}/${y}`
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const dt = new Date(value)
      if (!Number.isNaN(dt.getTime())) {
        return dt.toLocaleString('vi-VN')
      }
    }
    return value
  }

  if (typeof value === 'number') {
    if (key === 'po_id' || key === 'hoa_don_id' || key === 'nha_cung_cap_id' || key === 'tranh_chap_id' || key === 'lan_doi_soat_id') {
      return `#${value}`
    }
    return value.toLocaleString('vi-VN')
  }

  if (Array.isArray(value)) return `${value.length} mục`
  return JSON.stringify(value)
}

function getFieldLabel(key) {
  return FIELD_LABELS[key] || key
}

function extractDocumentCode(entity, id, data) {
  if (data) {
    if (data.so_hoa_don) return data.so_hoa_don
    if (data.so_po) return data.so_po
    if (data.so_phieu) return data.so_phieu
    if (entity === 'nha_cung_cap' && data.ten) return data.ten
    if (entity === 'thong_tin_cong_ty' && data.ten_cong_ty) return data.ten_cong_ty
    if (entity === 'nguoi_dung' && data.ten_dang_nhap) return `@${data.ten_dang_nhap}`
    if (entity === 'anh_xa_sku' && (data.ma_sku_ncc || data.ma_sku_noi_bo)) {
      return `${data.ma_sku_ncc || '?'} → ${data.ma_sku_noi_bo || '?'}`
    }
    if ((entity === 'lan_doi_soat' || entity === 'tranh_chap' || entity === 'yeu_cau_duyet_ngoai_le') && data.hoa_don_id) {
      return `HĐ #${data.hoa_don_id}`
    }
  }
  return id ? `#${id}` : 'Chứng từ'
}

function isSameValue(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return String(a) === String(b)
}

function buildUpdateSummary(entity, docCode, diffRows) {
  if (!diffRows.length) return `Cập nhật ${ENTITY_META[entity] || entity} (${docCode})`
  const preview = diffRows
    .slice(0, 2)
    .map((r) => `${r.label}: "${r.oldFormatted}" → "${r.newFormatted}"`)
    .join(' • ')
  const extra = diffRows.length > 2 ? ` (+${diffRows.length - 2} thay đổi khác)` : ''
  const prefix = docCode && !docCode.startsWith('#') ? `${docCode} • ` : ''
  return `${prefix}${preview}${extra}`
}

function buildInsertSummary(entity, d) {
  if (!d) return `Tạo mới ${ENTITY_META[entity] || entity}`
  switch (entity) {
    case 'hoa_don':
      return `Hóa đơn ${d.so_hoa_don || ''} • Tổng TT: ${formatFieldValue('tong_thanh_toan', d.tong_thanh_toan)} (VAT: ${formatFieldValue('vat', d.vat)}) • ${formatFieldValue('trang_thai', d.trang_thai)}`
    case 'don_hang_po':
      return `Đơn hàng ${d.so_po || ''} (${formatFieldValue('loai_po', d.loai_po)}) • Tổng giá trị: ${formatFieldValue('tong_tien', d.tong_tien)}`
    case 'phieu_kho':
      return `Phiếu kho ${d.so_phieu || ''} • Ngày nhập: ${formatFieldValue('ngay_nhap', d.ngay_nhap)} • ${formatFieldValue('trang_thai', d.trang_thai)}`
    case 'nha_cung_cap':
      return `Nhà cung cấp "${d.ten || '—'}" • MST: ${d.mst || '—'}`
    case 'anh_xa_sku':
      return `Ánh xạ ${d.ma_sku_ncc || '—'} ↔ ${d.ma_sku_noi_bo || '—'}${d.ten_san_pham ? ` (${d.ten_san_pham})` : ''}`
    case 'lan_doi_soat': {
      const lech = d.muc_lech_tien && Number(d.muc_lech_tien) !== 0 ? ` • Lệch: ${formatFieldValue('muc_lech_tien', d.muc_lech_tien)}` : ''
      return `Đối soát HĐ #${d.hoa_don_id || '?'} → Kết quả: ${formatFieldValue('ket_qua', d.ket_qua)}${lech}`
    }
    case 'tranh_chap':
      return `Mở hồ sơ tranh chấp HĐ #${d.hoa_don_id || '?'}${d.ly_do ? ` • Lý do: ${d.ly_do}` : ''}`
    case 'yeu_cau_duyet_ngoai_le':
      return `Gửi yêu cầu duyệt ngoại lệ HĐ #${d.hoa_don_id || '?'}${d.ly_do ? ` • Lý do: ${d.ly_do}` : ''}`
    case 'cau_hinh_doi_soat':
      return `Thiết lập dung sai giá ${formatFieldValue('dung_sai_don_gia_pct', d.dung_sai_don_gia_pct)}, ngưỡng lệch lớn ${formatFieldValue('nguong_lech_lon_pct', d.nguong_lech_lon_pct)} / ${formatFieldValue('nguong_lech_lon_tien', d.nguong_lech_lon_tien)}, hạn mức duyệt ${formatFieldValue('han_muc_duyet', d.han_muc_duyet)}`
    case 'nguoi_dung':
      return `Tạo tài khoản @${d.ten_dang_nhap || '—'} (${d.ho_ten || '—'} — ${formatFieldValue('vai_tro', d.vai_tro)})`
    default:
      break
  }
  const parts = Object.entries(d)
    .filter(([k, v]) => !TECHNICAL_FIELDS.has(k) && v !== null && v !== undefined && v !== '')
    .slice(0, 3)
    .map(([k, v]) => `${getFieldLabel(k)}: ${formatFieldValue(k, v)}`)
  return parts.length ? parts.join(' • ') : `Tạo mới ${ENTITY_META[entity] || entity}`
}

function buildDeleteSummary(entity, oldData) {
  if (!oldData) return `Xóa ${ENTITY_META[entity] || entity}`
  if (entity === 'nguoi_dung') {
    return `Xóa tài khoản @${oldData.ten_dang_nhap || '—'} (${oldData.ho_ten || '—'})`
  }
  const code = extractDocumentCode(entity, oldData.id, oldData)
  return `Xóa ${ENTITY_META[entity] || entity}: ${code}`
}

function buildSummary(action, entity, docCode, oldData, newData, diffRows) {
  if (action === 'UPDATE') {
    return diffRows.length ? buildUpdateSummary(entity, docCode, diffRows) : `Cập nhật ${ENTITY_META[entity] || entity} (${docCode})`
  }
  if (action === 'INSERT') return buildInsertSummary(entity, newData)
  if (action === 'DELETE') return buildDeleteSummary(entity, oldData)
  if (action === 'UPLOAD' && newData) {
    const fileType = formatFieldValue('loai_file', newData.loai_file)
    const pages = newData.so_trang ? `${newData.so_trang} trang` : ''
    const method = newData.phuong_phap ? `${newData.phuong_phap}` : ''
    const extra = [pages, method].filter(Boolean).join(' • ')
    return `Tải tệp ${fileType}${extra ? ` (${extra})` : ''}`
  }
  const d = newData || oldData
  if (d) {
    const parts = Object.entries(d)
      .filter(([k, v]) => !TECHNICAL_FIELDS.has(k) && v !== null && v !== undefined && v !== '')
      .slice(0, 3)
      .map(([k, v]) => `${getFieldLabel(k)}: ${formatFieldValue(k, v)}`)
    if (parts.length) return parts.join(' • ')
  }
  return `${ACTION_META[action]?.label || action} ${ENTITY_META[entity] || entity}`
}

export function formatAuditRecord(log, usersById = {}) {
  const rawOld = safeParseObject(log.du_lieu_cu)
  const rawNew = safeParseObject(log.du_lieu_moi)
  const activeData = rawNew || rawOld

  const actionMeta = ACTION_META[log.hanh_dong] || { label: log.hanh_dong, tone: 'info' }
  const entityLabel = ENTITY_META[log.doi_tuong] || log.doi_tuong
  const documentCode = extractDocumentCode(log.doi_tuong, log.doi_tuong_id, activeData)

  let actor = { name: 'Hệ thống tự động', username: '', roleLabel: '' }
  if (log.nguoi_thuc_hien_ho_ten || log.nguoi_thuc_hien_username) {
    actor = {
      name: log.nguoi_thuc_hien_ho_ten || log.nguoi_thuc_hien_username,
      username: log.nguoi_thuc_hien_username || '',
      roleLabel: STATUS_LABELS[log.nguoi_thuc_hien_vai_tro] || log.nguoi_thuc_hien_vai_tro || '',
    }
  } else if (log.nguoi_dung_id) {
    const found = usersById[log.nguoi_dung_id]
    if (found) {
      actor = {
        name: found.ho_ten || found.ten_dang_nhap,
        username: found.ten_dang_nhap || '',
        roleLabel: STATUS_LABELS[found.vai_tro] || found.vai_tro || '',
      }
    } else {
      actor = { name: `Người dùng #${log.nguoi_dung_id}`, username: '', roleLabel: '' }
    }
  }

  const diffRows = []
  if (log.hanh_dong === 'UPDATE' && rawOld && rawNew) {
    const keys = Array.from(new Set([...Object.keys(rawOld), ...Object.keys(rawNew)]))
    for (const k of keys) {
      if (TECHNICAL_FIELDS.has(k)) continue
      if (!isSameValue(rawOld[k], rawNew[k])) {
        diffRows.push({
          key: k,
          label: getFieldLabel(k),
          oldFormatted: formatFieldValue(k, rawOld[k]),
          newFormatted: formatFieldValue(k, rawNew[k]),
        })
      }
    }
  }

  const detailSource = log.hanh_dong === 'DELETE' ? rawOld : activeData
  const detailRows = detailSource
    ? Object.entries(detailSource)
        .filter(([k, v]) => !TECHNICAL_FIELDS.has(k) && v !== null && v !== undefined && v !== '')
        .map(([k, v]) => ({
          key: k,
          label: getFieldLabel(k),
          valueFormatted: formatFieldValue(k, v),
        }))
    : []

  const dt = log.thoi_gian ? new Date(log.thoi_gian) : null
  const validDt = dt && !Number.isNaN(dt.getTime())
  const timeStr = validDt ? dt.toLocaleTimeString('vi-VN') : '—'
  const dateStr = validDt ? dt.toLocaleDateString('vi-VN') : '—'
  const fullTimeStr = validDt ? dt.toLocaleString('vi-VN') : '—'

  return {
    ...log,
    actionMeta,
    entityLabel,
    documentCode,
    actor,
    diffRows,
    detailRows,
    summary: buildSummary(log.hanh_dong, log.doi_tuong, documentCode, rawOld, rawNew, diffRows),
    timeStr,
    dateStr,
    fullTimeStr,
    rawOld,
    rawNew,
  }
}
