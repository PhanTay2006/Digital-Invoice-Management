/**
 * Tiện ích định dạng tiền tệ và số liệu theo chuẩn Việt Nam (phân cách hàng nghìn bằng dấu chấm)
 */

export function formatVND(val) {
  if (val === '' || val === null || val === undefined) return '0 ₫'
  const num = Number(val)
  if (isNaN(num)) return '0 ₫'
  return `${num.toLocaleString('vi-VN')} ₫`
}

export function formatCurrencyInput(val) {
  if (val === '' || val === null || val === undefined) return ''
  const clean = String(val).replace(/\D/g, '')
  if (!clean) return ''
  return Number(clean).toLocaleString('vi-VN')
}

export function parseCurrencyInput(str, allowEmpty = true) {
  if (str === '' || str === null || str === undefined) {
    return allowEmpty ? '' : 0
  }
  const clean = String(str).replace(/\D/g, '')
  if (!clean) return allowEmpty ? '' : 0
  return Number(clean)
}
