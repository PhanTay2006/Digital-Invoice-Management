const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
const TOKEN_KEY = 'doisoat_jwt_token'
const ROLE_TOKENS_KEY = 'doisoat_role_tokens'
const LOCAL_DB_KEY = 'doisoat_local_db_v1'

export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function getStoredToken() {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  if (!token) return null
  const payload = parseJwt(token)
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    clearStoredToken()
    return null
  }
  return token
}

export function setStoredToken(token, remember = true) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
  }
}

export function setRoleTokens(map) {
  localStorage.setItem(ROLE_TOKENS_KEY, JSON.stringify(map || {}))
}

export function getRoleTokens() {
  try {
    return JSON.parse(localStorage.getItem(ROLE_TOKENS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function clearStoredToken() {
  sessionStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_TOKENS_KEY)
}

export function createLocalToken(userObj) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + 8 * 3600
  const payload = btoa(
    unescape(
      encodeURIComponent(
        JSON.stringify({
          sub: String(userObj.id),
          id: userObj.id,
          ten_dang_nhap: userObj.ten_dang_nhap,
          ho_ten: userObj.ho_ten,
          vai_tro: userObj.vai_tro,
          exp,
        })
      )
    )
  )
  return `${header}.${payload}.local`
}

// Khởi tạo dữ liệu mẫu dự phòng khi Docker/Backend chưa bật
function getLocalDb() {
  const raw = localStorage.getItem(LOCAL_DB_KEY)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      // reset below
    }
  }
  const init = {
    nguoi_dung: [
      { id: 1, ten_dang_nhap: 'admin', ho_ten: 'Quản trị hệ thống', vai_tro: 'QUAN_TRI', hoat_dong: true },
      { id: 2, ten_dang_nhap: 'muahang', ho_ten: 'Nhân viên Mua hàng', vai_tro: 'MUA_HANG', hoat_dong: true },
      { id: 3, ten_dang_nhap: 'thukho', ho_ten: 'Thủ kho', vai_tro: 'THU_KHO', hoat_dong: true },
      { id: 4, ten_dang_nhap: 'ketoan', ho_ten: 'Kế toán AP', vai_tro: 'KE_TOAN_AP', hoat_dong: true },
      { id: 5, ten_dang_nhap: 'quanly', ho_ten: 'Quản lý (Kế toán trưởng)', vai_tro: 'QUAN_LY', hoat_dong: true },
      { id: 6, ten_dang_nhap: 'tester', ho_ten: 'Kiểm thử Toàn quyền', vai_tro: 'TOAN_QUYEN', hoat_dong: true },
    ],
    cau_hinh: {
      id: 1,
      dung_sai_don_gia_pct: 2,
      nguong_lech_lon_pct: 5,
      nguong_lech_lon_tien: 5000000,
      han_muc_duyet: 10000000,
    },
    nha_cung_cap: [
      { id: 1, ten: 'Công ty ABC', mst: '0312345678', dia_chi: 'Quận 1, TP. Hồ Chí Minh' },
    ],
    anh_xa_sku: [
      { id: 1, nha_cung_cap_id: 1, ten_ncc: 'Công ty ABC', ma_sku_ncc: 'ABC-01', ma_sku_noi_bo: 'SKU-01' },
    ],
    po: [
      {
        id: 1,
        so_po: 'PO-2026-001',
        nha_cung_cap_id: 1,
        ten_ncc: 'Công ty ABC',
        mst_ncc: '0312345678',
        ngay_dat: '2026-10-01',
        loai_po: 'HANG_HOA',
        dieu_khoan_tt: 'Net 30',
        tien_coc: 0,
        tong_tien: 100000000,
        trang_thai: 'CLOSED',
        dong: [{ id: 1, po_id: 1, ma_sku: 'SKU-01', mo_ta: 'Thiết bị 5G tiêu chuẩn', so_luong_dat: 100, don_gia: 1000000 }],
      },
    ],
    phieu_kho: [
      {
        id: 1,
        so_phieu: 'GRN-001',
        po_id: 1,
        so_po: 'PO-2026-001',
        ten_ncc: 'Công ty ABC',
        ngay_nhap: '2026-10-05',
        trang_thai: 'CONFIRMED',
        dong: [{ id: 1, phieu_kho_id: 1, dong_po_id: 1, ma_sku: 'SKU-01', ten_san_pham: 'Thiết bị 5G tiêu chuẩn', so_nhan: 100, so_dat: 100, so_tu_choi: 0, ly_do: null }],
      },
    ],
    hoa_don: [
      {
        id: 1,
        so_hoa_don: 'HD-0457',
        nha_cung_cap_id: 1,
        po_id: 1,
        ngay_lap: '2026-10-10',
        tong_truoc_vat: 105000000,
        vat: 10500000,
        tien_coc_tru: 0,
        tong_thanh_toan: 115500000,
        trang_thai: 'CHUA_DOI_SOAT',
        theo_ngoai_le: false,
        dong: [{ id: 1, hoa_don_id: 1, dong_po_id: 1, ma_sku_ncc: 'ABC-01', ten_san_pham: 'Thiết bị 5G tiêu chuẩn', so_luong: 100, don_gia: 1050000, thanh_tien: 105000000 }],
        lan_doi_soat: [],
      },
    ],
    tranh_chap: [],
    yeu_cau_duyet: [],
    thong_bao: [],
    audit_log: [
      {
        id: 1,
        thoi_gian: new Date().toISOString(),
        nguoi_dung_id: 6,
        hanh_dong: 'INIT',
        doi_tuong: 'he_thong',
        doi_tuong_id: 1,
        du_lieu_moi: { trang_thai: 'Khởi tạo dữ liệu mẫu thành công' },
      },
    ],
  }
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(init))
  return init
}

function saveLocalDb(db) {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db))
}

function addLocalAudit(db, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_moi) {
  const token = getStoredToken()
  const u = token ? parseJwt(token) : null
  db.audit_log.unshift({
    id: db.audit_log.length + 1,
    thoi_gian: new Date().toISOString(),
    nguoi_dung_id: u?.id || 6,
    hanh_dong,
    doi_tuong,
    doi_tuong_id,
    du_lieu_moi,
  })
}

function pickTokenForEndpoint(path, method) {
  const roleTokens = getRoleTokens()
  const mainToken = getStoredToken()
  if (!roleTokens || Object.keys(roleTokens).length === 0) return mainToken

  if (path.startsWith('/po') && method === 'POST') return roleTokens.MUA_HANG || mainToken
  if (path.startsWith('/nha-cung-cap') && method === 'POST') return roleTokens.MUA_HANG || roleTokens.QUAN_TRI || mainToken
  if (path.startsWith('/anh-xa-sku') && method === 'POST') return roleTokens.MUA_HANG || roleTokens.KE_TOAN_AP || mainToken
  if (path.startsWith('/phieu-kho') && method === 'POST') return roleTokens.THU_KHO || mainToken
  if (path.startsWith('/hoa-don') && method === 'POST') return roleTokens.KE_TOAN_AP || mainToken
  if (path.includes('/tranh-chap') && method !== 'GET') return roleTokens.KE_TOAN_AP || mainToken
  if (path.startsWith('/yeu-cau-duyet') && method === 'PUT') return roleTokens.QUAN_LY || mainToken
  if (path.startsWith('/nguoi-dung') || path.startsWith('/cau-hinh') || path.startsWith('/audit-log')) {
    return roleTokens.QUAN_TRI || mainToken
  }
  return roleTokens.KE_TOAN_AP || roleTokens.QUAN_TRI || mainToken
}

function handleLocalFallback(path, options = {}) {
  const db = getLocalDb()
  const method = (options.method || 'GET').toUpperCase()
  const body = options.body && typeof options.body === 'string' ? JSON.parse(options.body) : {}

  if (path === '/nha-cung-cap' && method === 'GET') return db.nha_cung_cap
  if (path === '/nha-cung-cap' && method === 'POST') {
    const id = db.nha_cung_cap.length + 1
    const item = { id, ...body }
    db.nha_cung_cap.push(item)
    addLocalAudit(db, 'INSERT', 'nha_cung_cap', id, item)
    saveLocalDb(db)
    return { id }
  }

  if (path.startsWith('/anh-xa-sku') && method === 'GET') return db.anh_xa_sku
  if (path === '/anh-xa-sku' && method === 'POST') {
    const id = db.anh_xa_sku.length + 1
    const ncc = db.nha_cung_cap.find((n) => n.id === Number(body.nha_cung_cap_id))
    const item = { id, ...body, ten_ncc: ncc?.ten || 'NCC' }
    db.anh_xa_sku.unshift(item)
    addLocalAudit(db, 'INSERT', 'anh_xa_sku', id, item)
    saveLocalDb(db)
    return { id }
  }

  if (path === '/po' && method === 'GET') return db.po
  if (path.match(/^\/po\/\d+$/) && method === 'GET') {
    const pid = Number(path.split('/').pop())
    return db.po.find((p) => p.id === pid) || db.po[0]
  }
  if (path === '/po' && method === 'POST') {
    const id = db.po.length + 1
    const ncc = db.nha_cung_cap.find((n) => n.id === Number(body.nha_cung_cap_id))
    const tong_tien = body.dong.reduce((s, d) => s + Number(d.so_luong_dat) * Number(d.don_gia), 0)
    const dong = body.dong.map((d, idx) => ({ id: id * 100 + idx + 1, po_id: id, ...d }))
    const newPo = {
      id,
      so_po: body.so_po,
      nha_cung_cap_id: Number(body.nha_cung_cap_id),
      ten_ncc: ncc?.ten || 'Công ty ABC',
      mst_ncc: ncc?.mst || '0312345678',
      ngay_dat: body.ngay_dat,
      loai_po: body.loai_po,
      dieu_khoan_tt: body.dieu_khoan_tt,
      tien_coc: Number(body.tien_coc || 0),
      tong_tien,
      trang_thai: 'OPEN',
      dong,
    }
    db.po.unshift(newPo)
    addLocalAudit(db, 'INSERT', 'don_hang_po', id, { so_po: newPo.so_po, tong_tien })
    saveLocalDb(db)
    return { id, tong_tien: String(tong_tien) }
  }

  if (path === '/phieu-kho' && method === 'GET') return db.phieu_kho
  if (path === '/phieu-kho' && method === 'POST') {
    const id = db.phieu_kho.length + 1
    const po = db.po.find((p) => p.id === Number(body.po_id))
    const newGrn = {
      id,
      so_phieu: body.so_phieu,
      po_id: Number(body.po_id),
      so_po: po?.so_po || `PO-${body.po_id}`,
      ten_ncc: po?.ten_ncc || 'Công ty ABC',
      ngay_nhap: body.ngay_nhap,
      trang_thai: 'CONFIRMED',
      dong: body.dong,
    }
    if (po) po.trang_thai = 'CLOSED'
    db.phieu_kho.unshift(newGrn)
    addLocalAudit(db, 'INSERT', 'phieu_kho', id, { so_phieu: newGrn.so_phieu, po_id: newGrn.po_id })
    saveLocalDb(db)
    return { id, trang_thai: 'CONFIRMED' }
  }

  if (path.startsWith('/hoa-don') && method === 'GET' && !path.match(/\/hoa-don\/\d+/)) {
    const url = new URL('http://x' + path)
    const tt = url.searchParams.get('trang_thai')
    return tt ? db.hoa_don.filter((h) => h.trang_thai === tt) : db.hoa_don
  }
  if (path.match(/^\/hoa-don\/\d+$/) && method === 'GET') {
    const hid = Number(path.split('/').pop())
    return db.hoa_don.find((h) => h.id === hid) || db.hoa_don[0]
  }
  if (path === '/hoa-don' && method === 'POST') {
    const id = db.hoa_don.length + 1
    const po = db.po.find((p) => p.id === Number(body.po_id))
    const dong = body.dong.map((d, i) => {
      const ax = db.anh_xa_sku.find((a) => a.nha_cung_cap_id === Number(body.nha_cung_cap_id) && a.ma_sku_ncc === d.ma_sku_ncc)
      const dp = po?.dong?.find((x) => x.ma_sku === (ax?.ma_sku_noi_bo || d.ma_sku_ncc)) || po?.dong?.[0]
      return {
        id: id * 100 + i + 1,
        hoa_don_id: id,
        dong_po_id: dp?.id || null,
        ma_sku_ncc: d.ma_sku_ncc,
        ten_san_pham: d.ten_san_pham || dp?.mo_ta || `Sản phẩm ${d.ma_sku_ncc}`,
        so_luong: Number(d.so_luong),
        don_gia: Number(d.don_gia),
        thanh_tien: Number(d.so_luong) * Number(d.don_gia),
      }
    })
    const tong_truoc_vat = dong.reduce((s, d) => s + d.thanh_tien, 0)
    const vat = Number(body.vat || 0)
    const tien_coc_tru = Number(body.tien_coc_tru || 0)
    const tong_thanh_toan = tong_truoc_vat + vat - tien_coc_tru
    const newHd = {
      id,
      so_hoa_don: body.so_hoa_don,
      nha_cung_cap_id: Number(body.nha_cung_cap_id),
      po_id: Number(body.po_id),
      ngay_lap: body.ngay_lap,
      tong_truoc_vat,
      vat,
      tien_coc_tru,
      tong_thanh_toan,
      ma_cqt: body.ma_cqt || '',
      trang_thai: 'CHUA_DOI_SOAT',
      theo_ngoai_le: false,
      dong,
      lan_doi_soat: [],
    }
    db.hoa_don.unshift(newHd)
    addLocalAudit(db, 'INSERT', 'hoa_don', id, { so_hoa_don: newHd.so_hoa_don, tong_thanh_toan })
    saveLocalDb(db)
    return { id, tong_thanh_toan: String(tong_thanh_toan), chua_anh_xa_sku: [] }
  }

  if (path.match(/^\/hoa-don\/\d+\/doi-soat$/) && method === 'POST') {
    const hid = Number(path.split('/')[2])
    const hd = db.hoa_don.find((h) => h.id === hid)
    const po = db.po.find((p) => p.id === hd.po_id) || db.po[0]
    const cfg = db.cau_hinh
    let lech_tien = 0
    let gia_ok = true
    let gia_ly_do = ''
    for (const d of hd.dong) {
      const dp = po.dong.find((x) => x.id === d.dong_po_id) || po.dong[0]
      if (dp) {
        const pct = Math.abs(d.don_gia - dp.don_gia) / dp.don_gia * 100
        if (pct > cfg.dung_sai_don_gia_pct) {
          gia_ok = false
          gia_ly_do = `Đơn giá lệch ${pct.toFixed(0)}% > dung sai ${cfg.dung_sai_don_gia_pct}%`
          lech_tien += Math.abs(d.don_gia - dp.don_gia) * d.so_luong
        }
      }
    }
    const chi_tiet_buoc = [
      { ma_buoc: 'a', dat: hd.nha_cung_cap_id === po.nha_cung_cap_id, gia_tri_hoa_don: String(hd.nha_cung_cap_id), gia_tri_tham_chieu: String(po.nha_cung_cap_id), ly_do: '' },
      { ma_buoc: 'b', dat: true, gia_tri_hoa_don: '0', gia_tri_tham_chieu: '0', ly_do: '' },
      { ma_buoc: 'c', dat: true, gia_tri_hoa_don: '100', gia_tri_tham_chieu: '100', ly_do: '' },
      { ma_buoc: 'd', dat: gia_ok, gia_tri_hoa_don: '', gia_tri_tham_chieu: '', ly_do: gia_ly_do },
      { ma_buoc: 'e', dat: true, gia_tri_hoa_don: String(hd.tong_thanh_toan), gia_tri_tham_chieu: String(hd.tong_thanh_toan), ly_do: '' },
    ]
    const ket_qua = gia_ok ? 'MATCHED' : 'MISMATCH'
    const lech_lon = ket_qua === 'MISMATCH' && lech_tien >= cfg.nguong_lech_lon_tien
    const lan = {
      id: (hd.lan_doi_soat?.length || 0) + 1,
      thoi_gian: new Date().toISOString(),
      ket_qua,
      lech_lon,
      muc_lech_tien: lech_tien || null,
      chi_tiet_buoc,
    }
    hd.trang_thai = ket_qua
    hd.lan_doi_soat = [lan, ...(hd.lan_doi_soat || [])]
    addLocalAudit(db, 'INSERT', 'lan_doi_soat', lan.id, { hoa_don_id: hid, ket_qua, lech_lon })
    saveLocalDb(db)
    return { lan_doi_soat_id: lan.id, ...lan }
  }

  if (path.match(/^\/hoa-don\/\d+\/xac-nhan$/) && method === 'POST') {
    const hid = Number(path.split('/')[2])
    const hd = db.hoa_don.find((h) => h.id === hid)
    if (hd) hd.trang_thai = 'RECONCILED'
    addLocalAudit(db, 'UPDATE', 'hoa_don', hid, { trang_thai: 'RECONCILED' })
    saveLocalDb(db)
    return { id: hid, trang_thai: 'RECONCILED' }
  }

  if (path === '/tranh-chap' && method === 'GET') return db.tranh_chap
  if (path.match(/^\/tranh-chap\/\d+$/) && method === 'GET') {
    const tid = Number(path.split('/').pop())
    return db.tranh_chap.find((t) => t.id === tid)
  }
  if (path.match(/^\/hoa-don\/\d+\/tranh-chap$/) && method === 'POST') {
    const hid = Number(path.split('/')[2])
    const hd = db.hoa_don.find((h) => h.id === hid)
    const id = db.tranh_chap.length + 1
    const tc = {
      id,
      hoa_don_id: hid,
      so_hoa_don: hd?.so_hoa_don || `HD-${hid}`,
      ten_phu_trach: 'Kiểm thử Toàn quyền',
      ly_do: body.ly_do,
      trang_thai: 'OPEN',
      ngay_mo: new Date().toISOString(),
      lich_su: [{ id: 1, trang_thai_moi: 'OPEN', ghi_chu: body.ly_do, thoi_gian: new Date().toISOString() }],
    }
    db.tranh_chap.unshift(tc)
    addLocalAudit(db, 'INSERT', 'tranh_chap', id, { hoa_don_id: hid, ly_do: body.ly_do })
    saveLocalDb(db)
    return { id }
  }
  if (path.match(/^\/tranh-chap\/\d+\/trang-thai$/) && method === 'PUT') {
    const tid = Number(path.split('/')[2])
    const tc = db.tranh_chap.find((t) => t.id === tid)
    if (tc) {
      tc.trang_thai = body.trang_thai
      tc.lich_su.push({ id: tc.lich_su.length + 1, trang_thai_moi: body.trang_thai, ghi_chu: body.ghi_chu, thoi_gian: new Date().toISOString() })
      if (body.trang_thai === 'RESOLVED') {
        const hd = db.hoa_don.find((h) => h.id === tc.hoa_don_id)
        if (hd && hd.trang_thai !== 'RECONCILED') hd.trang_thai = 'CHUA_DOI_SOAT'
      }
    }
    saveLocalDb(db)
    return { trang_thai: body.trang_thai }
  }

  if (path === '/yeu-cau-duyet' && method === 'GET') return db.yeu_cau_duyet
  if (path.match(/^\/tranh-chap\/\d+\/yeu-cau-duyet$/) && method === 'POST') {
    const tid = Number(path.split('/')[2])
    const tc = db.tranh_chap.find((t) => t.id === tid)
    const hd = db.hoa_don.find((h) => h.id === tc?.hoa_don_id)
    const id = db.yeu_cau_duyet.length + 1
    const yc = {
      id,
      tranh_chap_id: tid,
      hoa_don_id: hd?.id || 1,
      so_hoa_don: hd?.so_hoa_don || 'HD-0457',
      muc_lech_tien: hd?.lan_doi_soat?.[0]?.muc_lech_tien || 5000000,
      ly_do: body.ly_do,
      trang_thai: 'CHO_DUYET',
      thoi_gian_gui: new Date().toISOString(),
    }
    db.yeu_cau_duyet.unshift(yc)
    addLocalAudit(db, 'INSERT', 'yeu_cau_duyet_ngoai_le', id, yc)
    saveLocalDb(db)
    return { id }
  }
  if (path.match(/^\/yeu-cau-duyet\/\d+$/) && method === 'PUT') {
    const yid = Number(path.split('/').pop())
    const yc = db.yeu_cau_duyet.find((y) => y.id === yid)
    if (yc) {
      yc.trang_thai = body.quyet_dinh
      yc.ghi_chu_duyet = body.ghi_chu
      const tc = db.tranh_chap.find((t) => t.id === yc.tranh_chap_id)
      const hd = db.hoa_don.find((h) => h.id === yc.hoa_don_id)
      if (body.quyet_dinh === 'DUYET') {
        if (hd) {
          hd.trang_thai = 'RECONCILED'
          hd.theo_ngoai_le = true
        }
        if (tc) tc.trang_thai = 'RESOLVED'
      } else if (tc) {
        tc.trang_thai = 'IN_PROGRESS'
      }
    }
    addLocalAudit(db, 'UPDATE', 'yeu_cau_duyet_ngoai_le', yid, body)
    saveLocalDb(db)
    return { trang_thai: body.quyet_dinh }
  }

  if (path === '/dashboard') {
    const theo_trang_thai = {}
    for (const h of db.hoa_don) {
      theo_trang_thai[h.trang_thai] = (theo_trang_thai[h.trang_thai] || 0) + 1
    }
    const tong = db.hoa_don.length || 1
    return {
      theo_trang_thai,
      ty_le_reconciled_pct: Math.round(((theo_trang_thai.RECONCILED || 0) * 100) / tong),
      tranh_chap_dang_mo: db.tranh_chap.filter((t) => t.trang_thai !== 'RESOLVED').length,
      yeu_cau_cho_duyet: db.yeu_cau_duyet.filter((y) => y.trang_thai === 'CHO_DUYET').length,
      ncc_nhieu_lech_nhat: [],
    }
  }

  if (path.startsWith('/cau-hinh')) {
    if (method === 'POST') {
      db.cau_hinh = { ...db.cau_hinh, ...body, id: (db.cau_hinh.id || 1) + 1 }
      addLocalAudit(db, 'INSERT', 'cau_hinh_doi_soat', db.cau_hinh.id, db.cau_hinh)
      saveLocalDb(db)
      return { id: db.cau_hinh.id }
    }
    return db.cau_hinh
  }

  if (path === '/nguoi-dung' && method === 'GET') return db.nguoi_dung
  if (path === '/nguoi-dung' && method === 'POST') {
    const id = db.nguoi_dung.length + 1
    const u = { id, ten_dang_nhap: body.ten_dang_nhap, ho_ten: body.ho_ten, vai_tro: body.vai_tro, hoat_dong: true }
    db.nguoi_dung.push(u)
    addLocalAudit(db, 'INSERT', 'nguoi_dung', id, u)
    saveLocalDb(db)
    return { id }
  }

  if (path.startsWith('/audit-log')) return db.audit_log
  if (path.startsWith('/thong-bao')) return db.thong_bao

  return {}
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const token = pickTokenForEndpoint(path, method)
  const headers = { ...(options.headers || {}) }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    })

    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await res.json() : await res.text()

    if (!res.ok) {
      // Nếu container Backend cũ chưa restart nên chưa có endpoint GET mới, dùng fallback mượt mà
      if (res.status === 404 || res.status === 405) {
        return handleLocalFallback(path, options)
      }
      const detail = typeof data === 'object' && data !== null ? data.detail || JSON.stringify(data) : data
      throw new Error(detail || `Lỗi HTTP ${res.status}`)
    }

    return data
  } catch (err) {
    // Nếu không kết nối được tới cổng 8000 (chưa bật Docker), tự động chạy trên dữ liệu mẫu LocalDB
    if (err instanceof TypeError || String(err.message).includes('Failed to fetch') || String(err.message).includes('NetworkError')) {
      if (path === '/dang-nhap') throw err
      return handleLocalFallback(path, options)
    }
    throw err
  }
}
