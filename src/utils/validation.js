export const RE_SO_HD = /^(?:HD-[A-Z0-9]+(?:-[A-Z0-9]+)*|\d{4,12})$/
export const RE_SO_PO = /^PO-[A-Z0-9]+(?:-[A-Z0-9]+)*$/
export const RE_SO_GRN = /^GRN-[A-Z0-9]+(?:-[A-Z0-9]+)*$/
export const RE_SKU = /^[A-Z0-9][A-Z0-9._-]{1,49}$/
export const RE_MST = /^\d{10}(-\d{3})?$/
export const RE_MA_CQT = /^[A-Z0-9-]{4,50}$/
export const RE_USERNAME = /^[a-z0-9._-]{3,30}$/

export function validateInvoiceNumber(val) {
  const s = String(val || '').trim()
  if (!s) return 'Vui lòng nhập số hóa đơn'
  if (!RE_SO_HD.test(s)) {
    return "Số hóa đơn phải dạng 'HD-...' hoặc 4–12 chữ số (VD: HD-0458 hoặc 00002118)"
  }
  return null
}

export function validatePoNumber(val) {
  const s = String(val || '').trim()
  if (!s) return 'Vui lòng nhập số PO'
  if (!RE_SO_PO.test(s)) {
    return "Số PO phải bắt đầu bằng 'PO-' và chỉ gồm chữ IN HOA, số, dấu '-' (VD: PO-2026-002)"
  }
  return null
}

export function validateGrnNumber(val) {
  const s = String(val || '').trim()
  if (!s) return 'Vui lòng nhập số phiếu nhập kho'
  if (!RE_SO_GRN.test(s)) {
    return "Số phiếu kho phải bắt đầu bằng 'GRN-' và chỉ gồm chữ IN HOA, số, dấu '-' (VD: GRN-002)"
  }
  return null
}

export function validateSku(val, label = 'Mã SKU') {
  const s = String(val || '').trim()
  if (!s) return `Vui lòng nhập ${label.toLowerCase()}`
  if (!RE_SKU.test(s)) {
    return `${label} chỉ gồm chữ IN HOA, số, dấu '.', '_', '-' (2–50 ký tự, không khoảng trắng)`
  }
  return null
}

export function validateMst(val) {
  const s = String(val || '').trim()
  if (!s) return 'Vui lòng nhập mã số thuế'
  if (!RE_MST.test(s)) {
    return 'Mã số thuế phải gồm đúng 10 chữ số (hoặc 10 chữ số-3 chữ số, VD: 0312345678)'
  }
  return null
}

export function validateIsoDate(val, label = 'Ngày') {
  const s = String(val || '').trim()
  if (!s) return `Vui lòng chọn ${label.toLowerCase()}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${label} không đúng định dạng YYYY-MM-DD`
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) {
    return `${label} không hợp lệ`
  }
  return null
}

function buildResult(errors) {
  const msgs = Object.values(errors).filter(Boolean)
  return {
    valid: msgs.length === 0,
    errors,
    summary: msgs[0] || '',
  }
}

export function validateInvoiceForm({ soHoaDon, nccId, poId, ngayLap, maCqt, mstNguoiMua, vat, tienCocTru, dong }) {
  const errors = {}
  const hdErr = validateInvoiceNumber(soHoaDon)
  if (hdErr) errors.soHoaDon = hdErr
  if (!nccId) errors.nccId = 'Vui lòng chọn nhà cung cấp'
  if (!poId) errors.poId = 'Vui lòng chọn đơn đặt hàng (PO)'

  const dateErr = validateIsoDate(ngayLap, 'Ngày lập hóa đơn')
  if (dateErr) errors.ngayLap = dateErr

  const cqtTrim = String(maCqt || '').trim()
  if (cqtTrim && !RE_MA_CQT.test(cqtTrim)) {
    errors.maCqt = "Mã CQT chỉ gồm chữ IN HOA, số và dấu '-' (4–50 ký tự)"
  }

  const mstMuaClean = String(mstNguoiMua || '').replace(/[\s.]+/g, '').trim()
  if (mstMuaClean && !RE_MST.test(mstMuaClean)) {
    errors.mstNguoiMua = 'Mã số thuế bên mua phải gồm đúng 10 chữ số (hoặc 10-3 chữ số)'
  }

  const vatNum = Number(vat === '' || vat == null ? 0 : vat)
  if (Number.isNaN(vatNum) || vatNum < 0) {
    errors.vat = 'Thuế GTGT (VAT) không được âm'
  }

  const cocNum = Number(tienCocTru === '' || tienCocTru == null ? 0 : tienCocTru)
  if (Number.isNaN(cocNum) || cocNum < 0) {
    errors.tienCocTru = 'Tiền cọc trừ không được âm'
  }

  if (!Array.isArray(dong) || dong.length === 0) {
    errors.dong = 'Hóa đơn phải có ít nhất 1 dòng mặt hàng'
  } else {
    let tongTruocVat = 0
    dong.forEach((d, idx) => {
      const skuErr = validateSku(d.ma_sku_ncc, 'Mã SKU NCC')
      if (skuErr) errors[`dong_${idx}_ma_sku_ncc`] = skuErr

      const sl = Number(d.so_luong)
      if (Number.isNaN(sl) || sl <= 0) {
        errors[`dong_${idx}_so_luong`] = 'Số lượng phải > 0'
      }

      const dg = Number(d.don_gia)
      if (d.don_gia === '' || d.don_gia == null || Number.isNaN(dg) || dg < 0) {
        errors[`dong_${idx}_don_gia`] = 'Đơn giá phải ≥ 0'
      }

      if (!Number.isNaN(sl) && !Number.isNaN(dg) && sl > 0 && dg >= 0) {
        tongTruocVat += sl * dg
      }
    })
    if (!errors.vat && !errors.tienCocTru && cocNum > tongTruocVat + vatNum) {
      errors.tienCocTru = 'Tiền cọc trừ không được lớn hơn tổng tiền hóa đơn (cộng VAT)'
    }
  }

  return buildResult(errors)
}

export function validatePoForm({ soPo, nccId, ngayDat, loaiPo, tienCoc, dong }) {
  const errors = {}
  const poErr = validatePoNumber(soPo)
  if (poErr) errors.soPo = poErr
  if (!nccId) errors.nccId = 'Vui lòng chọn nhà cung cấp'

  const dateErr = validateIsoDate(ngayDat, 'Ngày đặt hàng')
  if (dateErr) errors.ngayDat = dateErr

  if (!['HANG_HOA', 'DICH_VU'].includes(loaiPo)) {
    errors.loaiPo = 'Loại PO không hợp lệ'
  }

  const cocNum = Number(tienCoc === '' || tienCoc == null ? 0 : tienCoc)
  if (Number.isNaN(cocNum) || cocNum < 0) {
    errors.tienCoc = 'Tiền đặt cọc không được âm'
  }

  if (!Array.isArray(dong) || dong.length === 0) {
    errors.dong = 'Đơn đặt hàng phải có ít nhất 1 dòng mặt hàng'
  } else {
    const seen = new Set()
    let tong = 0
    dong.forEach((d, idx) => {
      const skuTrim = String(d.ma_sku || '').trim()
      const skuErr = validateSku(skuTrim, 'Mã SKU nội bộ')
      if (skuErr) {
        errors[`dong_${idx}_ma_sku`] = skuErr
      } else if (seen.has(skuTrim)) {
        errors[`dong_${idx}_ma_sku`] = `Mã SKU '${skuTrim}' bị trùng trong cùng PO`
      } else {
        seen.add(skuTrim)
      }

      const sl = Number(d.so_luong_dat)
      if (Number.isNaN(sl) || sl <= 0) {
        errors[`dong_${idx}_so_luong_dat`] = 'Số lượng đặt phải > 0'
      }

      const dg = Number(d.don_gia)
      if (d.don_gia === '' || d.don_gia == null || Number.isNaN(dg) || dg < 0) {
        errors[`dong_${idx}_don_gia`] = 'Đơn giá phải ≥ 0'
      }

      if (!Number.isNaN(sl) && !Number.isNaN(dg) && sl > 0 && dg >= 0) {
        tong += sl * dg
      }
    })
    if (!errors.tienCoc && cocNum > tong) {
      errors.tienCoc = 'Tiền đặt cọc không được lớn hơn tổng giá trị đơn hàng'
    }
  }

  return buildResult(errors)
}

export function validateGrnForm({ soPhieu, poId, ngayNhap, mstDonVi, dongKho }) {
  const errors = {}
  const grnErr = validateGrnNumber(soPhieu)
  if (grnErr) errors.soPhieu = grnErr
  if (!poId) errors.poId = 'Vui lòng chọn PO tham chiếu'

  const dateErr = validateIsoDate(ngayNhap, 'Ngày nhập kho')
  if (dateErr) errors.ngayNhap = dateErr

  const mstDonViClean = String(mstDonVi || '').replace(/[\s.]+/g, '').trim()
  if (mstDonViClean && !RE_MST.test(mstDonViClean)) {
    errors.mstDonVi = 'Mã số thuế đơn vị phải gồm đúng 10 chữ số (hoặc 10-3 chữ số)'
  }

  if (!Array.isArray(dongKho) || dongKho.length === 0) {
    errors.dongKho = 'Phiếu kho phải có ít nhất 1 dòng hàng'
  } else {
    let coDongNhan = false
    dongKho.forEach((d, idx) => {
      const nhan = Number(d.so_nhan)
      const dat = Number(d.so_dat)
      const tuChoi = Number(d.so_tu_choi === '' || d.so_tu_choi == null ? 0 : d.so_tu_choi)

      if (d.so_nhan === '' || d.so_nhan == null || Number.isNaN(nhan) || nhan < 0) {
        errors[`dong_${idx}_so_nhan`] = 'Số thực nhận phải ≥ 0'
      } else if (nhan > 0) {
        coDongNhan = true
      }

      if (d.so_dat === '' || d.so_dat == null || Number.isNaN(dat) || dat < 0) {
        errors[`dong_${idx}_so_dat`] = 'Số lượng đạt phải ≥ 0'
      } else if (!Number.isNaN(nhan) && dat > nhan) {
        errors[`dong_${idx}_so_dat`] = 'Số lượng đạt không được lớn hơn số thực nhận'
      }

      if (Number.isNaN(tuChoi) || tuChoi < 0) {
        errors[`dong_${idx}_so_tu_choi`] = 'Số từ chối phải ≥ 0'
      } else if (!Number.isNaN(nhan) && !Number.isNaN(dat) && dat + tuChoi > nhan) {
        errors[`dong_${idx}_so_tu_choi`] = 'Tổng số đạt + từ chối không được vượt quá số thực nhận'
      }
    })
    if (!coDongNhan && !errors.dongKho) {
      errors.dongKho = 'Phiếu nhập kho phải có ít nhất 1 dòng có số thực nhận > 0'
    }
  }

  return buildResult(errors)
}

export function validateSupplierForm({ ten, mst }) {
  const errors = {}
  const tenTrim = String(ten || '').trim()
  if (tenTrim.length < 2) {
    errors.ten = 'Tên nhà cung cấp phải có ít nhất 2 ký tự'
  }
  const mstErr = validateMst(mst)
  if (mstErr) errors.mst = mstErr
  return buildResult(errors)
}

export function validateSkuMappingForm({ nccId, maSkuNcc, maSkuNoiBo }) {
  const errors = {}
  if (!nccId) errors.nccId = 'Vui lòng chọn nhà cung cấp'
  const errNcc = validateSku(maSkuNcc, 'Mã SKU bên NCC')
  if (errNcc) errors.maSkuNcc = errNcc
  const errNoiBo = validateSku(maSkuNoiBo, 'Mã SKU nội bộ')
  if (errNoiBo) errors.maSkuNoiBo = errNoiBo
  return buildResult(errors)
}

export function validateCreateUserForm({ tenDangNhap, matKhau, hoTen }) {
  const errors = {}
  const u = String(tenDangNhap || '').trim()
  if (!u) {
    errors.tenDangNhap = 'Vui lòng nhập tên đăng nhập'
  } else if (!RE_USERNAME.test(u)) {
    errors.tenDangNhap = "Tên đăng nhập phải dài 3–30 ký tự, chỉ gồm chữ thường, số, '.', '_', '-'"
  }
  if (!matKhau || String(matKhau).length < 8) {
    errors.matKhau = 'Mật khẩu phải có tối thiểu 8 ký tự'
  }
  if (String(hoTen || '').trim().length < 2) {
    errors.hoTen = 'Họ và tên phải có ít nhất 2 ký tự'
  }
  return buildResult(errors)
}

export function validateEditUserForm({ hoTen, matKhau }) {
  const errors = {}
  if (String(hoTen || '').trim().length < 2) {
    errors.hoTen = 'Họ và tên phải có ít nhất 2 ký tự'
  }
  const pw = String(matKhau || '').trim()
  if (pw && pw.length < 8) {
    errors.matKhau = 'Mật khẩu mới phải có tối thiểu 8 ký tự'
  }
  return buildResult(errors)
}
