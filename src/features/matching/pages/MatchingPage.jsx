import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TRANG_THAI_LABEL = {
  CHUA_DOI_SOAT: 'Chưa đối soát',
  MATCHED: 'Khớp',
  PARTIAL: 'Khớp một phần',
  MISMATCH: 'Lệch',
  RECONCILED: 'Đã đối soát',
}

const TEN_BUOC = {
  a: 'Kiểm tra Nhà cung cấp khớp PO tham chiếu',
  b: 'Kiểm tra ánh xạ SKU NCC sang dòng hàng PO',
  c: 'Đối chiếu số lượng Hóa đơn với PO và Phiếu nhập kho (GRN)',
  d: 'Đối chiếu đơn giá trong ngưỡng dung sai',
  e: 'Kiểm tra tổng tiền, thuế VAT và khoản trừ cọc',
  f: 'Đối chiếu Tên & MST Đơn vị mua trên Hóa đơn / Phiếu kho',
}

function isPlainNumber(str) {
  if (str === null || str === undefined) return false
  const s = String(str).trim()
  return /^-?\d+(\.\d+)?$/.test(s)
}

function fmtNum(val) {
  const n = Number(val)
  if (!Number.isFinite(n)) return String(val ?? '0')
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
}

function fmtMoney(val) {
  return `${fmtNum(val)} ₫`
}

/**
 * Chuẩn hóa hiển thị cho cả bản ghi đối soát mới và bản ghi cũ trong DB
 * (tránh hiển thị ID thô "1", "0", "100.00", "—" ở bước đơn giá, hay "115500000.00").
 */
function formatMatchingStep(step, detail, poDetail, grnsForPo, nccMap, config) {
  let vHd = step.gia_tri_hoa_don ?? ''
  let vRef = step.gia_tri_tham_chieu ?? ''
  let lyDo = step.ly_do || ''

  const hdLines = detail?.dong || []
  const poLines = poDetail?.dong || []
  const poLineMap = Object.fromEntries(poLines.map((d) => [Number(d.id), d]))
  const dsPct = Number(config?.dung_sai_don_gia_pct ?? 2)

  if (step.ma_buoc === 'a') {
    if (isPlainNumber(vHd)) {
      const ncc = nccMap[Number(vHd)]
      vHd = ncc ? `${ncc.ten}${ncc.mst ? ` (MST: ${ncc.mst})` : ''}` : `NCC #${vHd}`
    }
    if (isPlainNumber(vRef)) {
      const ncc = nccMap[Number(vRef)]
      vRef = ncc ? `${ncc.ten}${ncc.mst ? ` (MST: ${ncc.mst})` : ''}` : `NCC #${vRef}`
    }
  } else if (step.ma_buoc === 'b') {
    if (isPlainNumber(vHd)) {
      const unmappedCount = Number(vHd)
      const total = hdLines.length
      const skus = hdLines.map((d) => d.ma_sku_ncc).filter(Boolean)
      if (unmappedCount === 0 && total > 0) {
        vHd = `Đã ánh xạ ${total}/${total} dòng${skus.length ? ` (${skus.join(', ')})` : ''}`
      } else if (unmappedCount > 0) {
        vHd = `Chưa ánh xạ ${unmappedCount}/${total} dòng`
      }
    }
    if (isPlainNumber(vRef)) {
      const poSkus = poLines.map((d) => d.ma_sku).filter(Boolean)
      vRef = poLines.length
        ? `${poLines.length} dòng PO (${poSkus.join(', ')})`
        : 'Yêu cầu ánh xạ đủ dòng hàng PO'
    }
  } else if (step.ma_buoc === 'c') {
    if (isPlainNumber(vHd)) {
      vHd = `${fmtNum(vHd)} đơn vị`
    }
    if (isPlainNumber(vRef)) {
      const totalPoQty = poLines.reduce((s, d) => s + Number(d.so_luong_dat || 0), 0)
      if (poDetail?.loai_po === 'DICH_VU') {
        vRef = `PO Dịch vụ: ${fmtNum(vRef)} đơn vị (bỏ qua GRN)`
      } else if (totalPoQty > 0) {
        vRef = `Nhập kho đạt: ${fmtNum(vRef)} / Đặt PO: ${fmtNum(totalPoQty)}`
      } else {
        vRef = `${fmtNum(vRef)} đơn vị`
      }
    }
  } else if (step.ma_buoc === 'd') {
    if (!vHd && hdLines.length > 0) {
      vHd = hdLines
        .map((d) => `${d.ma_sku_ncc ? `${d.ma_sku_ncc}: ` : ''}${fmtMoney(d.don_gia)}`)
        .join(' | ')
    }
    if (!vRef) {
      if (poLines.length > 0) {
        vRef = poLines
          .map((p) => {
            const pg = Number(p.don_gia || 0)
            const maxAllow = pg * (1 + dsPct / 100)
            return `${p.ma_sku ? `${p.ma_sku}: ` : ''}${fmtMoney(pg)} (±${fmtNum(dsPct)}%, tối đa ${fmtMoney(maxAllow)})`
          })
          .join(' | ')
      } else if (hdLines.length > 0 && poLineMap) {
        vRef = `Dung sai cho phép: ±${fmtNum(dsPct)}%`
      } else {
        vRef = `Dung sai cho phép: ±${fmtNum(dsPct)}%`
      }
    }
    // Làm gọn phần trăm như "2.00%" -> "2%" trong lý do cũ nếu có
    if (lyDo) {
      lyDo = lyDo.replace(/(\d+)\.00%/g, '$1%')
    } else if (step.dat) {
      lyDo = `Hợp lệ (trong dung sai ±${fmtNum(dsPct)}%)`
    }
  } else if (step.ma_buoc === 'e') {
    if (isPlainNumber(vHd)) {
      if (detail) {
        const coc = Number(detail.tien_coc_tru || 0)
        vHd =
          `${fmtMoney(vHd)} (Trước VAT: ${fmtMoney(detail.tong_truoc_vat)} + VAT: ${fmtMoney(detail.vat)}` +
          (coc > 0 ? ` - Cọc: ${fmtMoney(coc)})` : ')')
      } else {
        vHd = fmtMoney(vHd)
      }
    }
    if (isPlainNumber(vRef)) {
      const tongDong = hdLines.reduce((s, d) => s + Number(d.thanh_tien || 0), 0)
      const vatVal = Number(detail?.vat || 0)
      const cocVal = Number(detail?.tien_coc_tru || 0)
      const cocPo = Number(poDetail?.tien_coc || 0)
      if (detail && hdLines.length > 0) {
        vRef =
          `${fmtMoney(vRef)} (Tổng dòng: ${fmtMoney(tongDong)} + VAT: ${fmtMoney(vatVal)}` +
          (cocVal > 0 || cocPo > 0
            ? ` - Cọc trừ: ${fmtMoney(cocVal)} / Cọc PO: ${fmtMoney(cocPo)})`
            : ')')
      } else {
        vRef = fmtMoney(vRef)
      }
    }
  } else if (step.ma_buoc === 'f') {
    // Nếu bản ghi cũ chưa kèm thông tin Phiếu kho liên kết thì hiển thị bổ sung
    if (vHd && !vHd.includes('Kho:') && grnsForPo?.length > 0) {
      const grnSummary = grnsForPo
        .filter((k) => k.ten_don_vi || k.mst_don_vi)
        .map((k) => `${k.so_phieu}: ${k.ten_don_vi || '—'}${k.mst_don_vi ? ` (MST: ${k.mst_don_vi})` : ''}`)
        .join('; ')
      if (grnSummary) {
        vHd = `${vHd.startsWith('HĐ:') ? vHd : `HĐ: ${vHd}`} || Kho: ${grnSummary}`
      }
    }
  }

  return {
    vHd: vHd || '—',
    vRef: vRef || '—',
    lyDo: lyDo || 'Hợp lệ',
  }
}

export default function MatchingPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pos, setPos] = useState([])
  const [grns, setGrns] = useState([])
  const [poDetailsCache, setPoDetailsCache] = useState({})
  const [config, setConfig] = useState(null)
  const [companyInfo, setCompanyInfo] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [matchingId, setMatchingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [isBatchMatching, setIsBatchMatching] = useState(false)
  const [msg, setMsg] = useState(null)

  const canMatch = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  const nccMap = Object.fromEntries(suppliers.map((s) => [s.id, s]))
  const poMap = Object.fromEntries(pos.map((p) => [p.id, p]))

  async function ensurePoDetail(pid) {
    if (!pid) return null
    if (poDetailsCache[pid]) return poDetailsCache[pid]
    try {
      const detail = await apiFetch(`/po/${pid}`)
      setPoDetailsCache((prev) => ({ ...prev, [pid]: detail }))
      return detail
    } catch {
      return null
    }
  }

  async function loadData() {
    try {
      const [hdList, cfg, nccList, poList, grnList, cty] = await Promise.all([
        apiFetch('/hoa-don'),
        apiFetch('/cau-hinh/hien-hanh').catch(() => null),
        apiFetch('/nha-cung-cap').catch(() => []),
        apiFetch('/po').catch(() => []),
        apiFetch('/phieu-kho').catch(() => []),
        apiFetch('/cong-ty').catch(() => null),
      ])
      setInvoices(hdList)
      setConfig(cfg)
      setSuppliers(nccList)
      setPos(poList)
      setGrns(grnList)
      setCompanyInfo(cty)
      if (hdList.length > 0) {
        const targetId =
          selectedDetail && hdList.some((h) => h.id === selectedDetail.id)
            ? selectedDetail.id
            : hdList[0].id
        await viewInvoiceMatching(targetId)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function viewInvoiceMatching(id) {
    try {
      const detail = await apiFetch(`/hoa-don/${id}`)
      setSelectedDetail(detail)
      if (detail?.po_id) {
        await ensurePoDetail(detail.po_id)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function runMatching(id) {
    if (matchingId === id || isBatchMatching) return
    setMsg(null)
    setMatchingId(id)
    const t0 = performance.now()
    try {
      const res = await apiFetch(`/hoa-don/${id}/doi-soat`, { method: 'POST' })
      const elapsedMs = Math.max(1, Math.round(performance.now() - t0))
      const label = TRANG_THAI_LABEL[res.ket_qua] || res.ket_qua
      setMsg({
        type: res.ket_qua === 'MATCHED' ? 'success' : 'error',
        text: `Kết quả đối soát Hóa đơn #${id}: ${label}${res.lech_lon ? ` (Lệch lớn: ${Number(res.muc_lech_tien).toLocaleString('vi-VN')} ₫)` : ''} — ${elapsedMs}ms`,
      })
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, trang_thai: res.ket_qua } : inv))
      )
      await viewInvoiceMatching(id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setMatchingId(null)
    }
  }

  async function runBatchMatching() {
    if (isBatchMatching || matchingId !== null) return
    setMsg(null)
    setIsBatchMatching(true)
    const t0 = performance.now()
    try {
      const res = await apiFetch('/hoa-don/doi-soat-hang-loat', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const elapsedMs = res.thoi_gian_ms ?? Math.max(1, Math.round(performance.now() - t0))
      const hdList = await apiFetch('/hoa-don')
      setInvoices(hdList)
      if (selectedDetail && (res.ket_qua || []).some((x) => x.hoa_don_id === selectedDetail.id)) {
        await viewInvoiceMatching(selectedDetail.id)
      }
      setMsg({
        type: res.mismatch > 0 ? 'error' : 'success',
        text: `Đã đối soát hàng loạt ${res.tong_xu_ly} hóa đơn trong ${elapsedMs}ms — Khớp: ${res.matched}, Khớp một phần: ${res.partial}, Lệch: ${res.mismatch}`,
      })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setIsBatchMatching(false)
    }
  }

  async function confirmReconciled(id) {
    if (confirmingId === id || isBatchMatching) return
    setMsg(null)
    setConfirmingId(id)
    try {
      await apiFetch(`/hoa-don/${id}/xac-nhan`, { method: 'POST' })
      setMsg({
        type: 'success',
        text: `Đã xác nhận hoàn tất đối soát và khóa Hóa đơn #${id} thành công!`,
      })
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, trang_thai: 'RECONCILED' } : inv))
      )
      setSelectedDetail((prev) =>
        prev && prev.id === id ? { ...prev, trang_thai: 'RECONCILED' } : prev
      )
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setConfirmingId(null)
    }
  }

  const pendingCount = invoices.filter((inv) => inv.trang_thai === 'CHUA_DOI_SOAT').length
  const activePoDetail = selectedDetail?.po_id ? poDetailsCache[selectedDetail.po_id] || poMap[selectedDetail.po_id] : null
  const activeGrns = selectedDetail?.po_id ? grns.filter((k) => Number(k.po_id) === Number(selectedDetail.po_id)) : []

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Đối soát 3 chiều</h1>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canMatch && pendingCount > 0 && (
            <button
              className="button button-primary"
              type="button"
              onClick={runBatchMatching}
              disabled={isBatchMatching || matchingId !== null}
            >
              {isBatchMatching ? '⏳ Đang đối soát...' : `⚡ Đối soát tất cả (${pendingCount})`}
            </button>
          )}
          <button className="button button-secondary" type="button" onClick={loadData} disabled={isBatchMatching}>
            ↻ Làm mới
          </button>
        </div>
      </div>

      {(config?.id || companyInfo?.ten_cong_ty) && (
        <div
          style={{
            padding: '12px 18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 0,
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {companyInfo?.ten_cong_ty && (
            <div>
              <strong style={{ color: '#0f172a', marginRight: 8 }}>Công ty Bên mua (chuẩn đối soát):</strong>
              <span style={{ color: '#1e293b' }}>
                <b>{companyInfo.ten_cong_ty}</b> — MST: <b>{companyInfo.mst}</b>
                {companyInfo.ma_cqt_quan_ly ? ` | Mã CQT quản lý: ${companyInfo.ma_cqt_quan_ly}` : ''}
              </span>
            </div>
          )}
          {config && config.id && (
            <div>
              <strong style={{ color: '#0f172a', marginRight: 10 }}>Tham số Dung sai đang áp dụng:</strong>
              <span style={{ color: '#475569' }}>
                Dung sai đơn giá: <b>{fmtNum(config.dung_sai_don_gia_pct)}%</b> | Ngưỡng lệch lớn: <b>{fmtNum(config.nguong_lech_lon_pct)}%</b> hoặc <b>{Number(config.nguong_lech_lon_tien).toLocaleString('vi-VN')} ₫</b> | Hạn mức duyệt ngoại lệ: <b>{Number(config.han_muc_duyet).toLocaleString('vi-VN')} ₫</b>
              </span>
            </div>
          )}
        </div>
      )}

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {/* PHẦN TRÊN: DANH SÁCH HÓA ĐƠN CẦN ĐỐI SOÁT */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Danh sách Hóa đơn cần Đối soát ({invoices.length})</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SỐ HÓA ĐƠN</th>
                <th>NHÀ CUNG CẤP</th>
                <th>ĐƠN VỊ MUA HÀNG</th>
                <th>PO THAM CHIẾU</th>
                <th>TỔNG TIỀN (₫)</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                    Không có hóa đơn nào.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isSelected = selectedDetail?.id === inv.id
                  const ncc = nccMap[inv.nha_cung_cap_id]
                  const po = poMap[inv.po_id]
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => viewInvoiceMatching(inv.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#f0f7ff' : undefined,
                      }}
                    >
                      <td>#{inv.id}</td>
                      <td>
                        <strong className="invoice-id">{inv.so_hoa_don}</strong>
                      </td>
                      <td>
                        <strong>{ncc ? ncc.ten : `NCC #${inv.nha_cung_cap_id}`}</strong>
                      </td>
                      <td>
                        {inv.ten_nguoi_mua ? (
                          <div>
                            <strong style={{ display: 'block', lineHeight: 1.35 }}>{inv.ten_nguoi_mua}</strong>
                            {inv.mst_nguoi_mua && (
                              <small style={{ color: '#64748b' }}>MST: {inv.mst_nguoi_mua}</small>
                            )}
                          </div>
                        ) : (
                          <span className="muted-cell">Chưa ghi</span>
                        )}
                      </td>
                      <td>
                        <span>{po ? po.so_po : `PO #${inv.po_id}`}</span>
                      </td>
                      <td className="amount-cell">{Number(inv.tong_thanh_toan).toLocaleString('vi-VN')}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            inv.trang_thai === 'MATCHED' || inv.trang_thai === 'RECONCILED'
                              ? 'success'
                              : inv.trang_thai === 'MISMATCH'
                              ? 'danger'
                              : 'warning'
                          }`}
                        >
                          {TRANG_THAI_LABEL[inv.trang_thai] || inv.trang_thai} {inv.theo_ngoai_le ? '(Ngoại lệ)' : ''}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        {canMatch && inv.trang_thai !== 'RECONCILED' && (
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ height: 32, padding: '0 12px', marginRight: 8, fontSize: 12.5 }}
                            onClick={() => runMatching(inv.id)}
                            disabled={matchingId === inv.id || isBatchMatching}
                          >
                            {matchingId === inv.id ? '⏳ Đang đối soát...' : '⇄ Chạy đối soát'}
                          </button>
                        )}
                        {canMatch && inv.trang_thai === 'MATCHED' && (
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                            onClick={() => confirmReconciled(inv.id)}
                            disabled={confirmingId === inv.id || isBatchMatching}
                          >
                            {confirmingId === inv.id ? '⏳ Đang khóa...' : '✓ Hoàn tất đối soát'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHẦN DƯỚI: CHI TIẾT KẾT QUẢ TỪNG BƯỚC KIỂM TRA */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Chi tiết Kết quả từng Bước Kiểm tra</h2>
          </div>
          {selectedDetail && (
            <div>
              <span
                className={`status-pill ${
                  selectedDetail.trang_thai === 'MATCHED' || selectedDetail.trang_thai === 'RECONCILED'
                    ? 'success'
                    : selectedDetail.trang_thai === 'MISMATCH'
                    ? 'danger'
                    : 'warning'
                }`}
                style={{ fontSize: 13, padding: '5px 12px' }}
              >
                {TRANG_THAI_LABEL[selectedDetail.trang_thai] || selectedDetail.trang_thai}
              </span>
            </div>
          )}
        </div>

        {!selectedDetail ? (
          <p className="muted-cell" style={{ padding: '20px 0', textAlign: 'center' }}>
            Hãy bấm vào một Hóa đơn ở bảng phía trên để xem kết quả đối soát.
          </p>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                padding: '12px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 0,
                marginBottom: 16,
              }}
            >
              <div style={{ lineHeight: 1.6 }}>
                <span className="muted-cell" style={{ marginRight: 6 }}>Hóa đơn đang xem:</span>
                <strong style={{ fontSize: 15, color: '#0f172a' }}>{selectedDetail.so_hoa_don}</strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span className="muted-cell" style={{ marginRight: 6 }}>PO tham chiếu:</span>
                <strong>{poMap[selectedDetail.po_id]?.so_po || `PO #${selectedDetail.po_id}`}</strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span className="muted-cell" style={{ marginRight: 6 }}>Nhà cung cấp:</span>
                <strong>{nccMap[selectedDetail.nha_cung_cap_id]?.ten || `NCC #${selectedDetail.nha_cung_cap_id}`}</strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span className="muted-cell" style={{ marginRight: 6 }}>Bên mua trên HĐ:</span>
                <strong>
                  {selectedDetail.ten_nguoi_mua || 'Chưa ghi'}
                  {selectedDetail.mst_nguoi_mua ? ` (MST: ${selectedDetail.mst_nguoi_mua})` : ''}
                </strong>
              </div>
              <div>
                <span className="muted-cell" style={{ marginRight: 6 }}>Tổng thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: 15 }}>
                  {Number(selectedDetail.tong_thanh_toan).toLocaleString('vi-VN')} ₫
                </strong>
              </div>
            </div>

            {!selectedDetail.lan_doi_soat?.length ? (
              <p className="muted-cell" style={{ padding: '24px 0', textAlign: 'center' }}>
                Hóa đơn này chưa chạy đối soát lần nào. Hãy bấm nút <strong>"⇄ Chạy đối soát"</strong> ở bảng trên để thực hiện đối chiếu tự động.
              </p>
            ) : (
              selectedDetail.lan_doi_soat.map((lan) => {
                const steps = Array.isArray(lan.chi_tiet_buoc)
                  ? lan.chi_tiet_buoc
                  : JSON.parse(lan.chi_tiet_buoc || '[]')
                return (
                  <div key={lan.id} className="detail-box" style={{ marginBottom: 18, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 0, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <strong style={{ fontSize: 14, color: '#0f172a' }}>
                          Lần chạy đối soát #{lan.id} — Kết quả:{' '}
                          <span style={{ color: lan.ket_qua === 'MATCHED' ? '#15803d' : lan.ket_qua === 'PARTIAL' ? '#b45309' : '#b91c1c' }}>
                            {TRANG_THAI_LABEL[lan.ket_qua] || lan.ket_qua}
                          </span>
                        </strong>
                      </div>
                      <span className="muted-cell">{new Date(lan.thoi_gian).toLocaleString('vi-VN')}</span>
                    </div>

                    {lan.lech_lon && (
                      <div className="alert-error" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 0, background: '#fff0ee', border: '1px solid #fecaca', color: '#b91c1c' }}>
                        ⚠️ Đánh dấu <strong>LỆCH LỚN</strong> — Tổng tiền lệch: <b>{Number(lan.muc_lech_tien).toLocaleString('vi-VN')} ₫</b>
                      </div>
                    )}

                    <div className="table-wrap">
                      <table style={{ tableLayout: 'fixed', width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '23%', whiteSpace: 'normal' }}>BƯỚC KIỂM TRA</th>
                            <th style={{ width: '24%', whiteSpace: 'normal' }}>DỮ LIỆU TRÊN HÓA ĐƠN</th>
                            <th style={{ width: '25%', whiteSpace: 'normal' }}>DỮ LIỆU THAM CHIẾU (PO / GRN / CÔNG TY)</th>
                            <th style={{ width: '9%', textAlign: 'center', whiteSpace: 'nowrap' }}>KẾT QUẢ</th>
                            <th style={{ width: '19%', whiteSpace: 'normal' }}>CHI TIẾT ĐỐI CHIẾU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((s) => {
                            const fmt = formatMatchingStep(s, selectedDetail, activePoDetail, activeGrns, nccMap, config)
                            return (
                              <tr key={s.ma_buoc}>
                                <td style={{ whiteSpace: 'normal', verticalAlign: 'top', lineHeight: 1.45 }}>
                                  <strong>{TEN_BUOC[s.ma_buoc] || s.ma_buoc}</strong>
                                </td>
                                <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top', lineHeight: 1.45 }}>
                                  {fmt.vHd}
                                </td>
                                <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top', lineHeight: 1.45 }}>
                                  {fmt.vRef}
                                </td>
                                <td style={{ textAlign: 'center', verticalAlign: 'top' }}>
                                  <span className={`status-pill ${s.dat ? 'success' : 'danger'}`}>
                                    {s.dat ? 'Đạt' : 'Không đạt'}
                                  </span>
                                </td>
                                <td style={{ whiteSpace: 'normal', wordBreak: 'break-word', verticalAlign: 'top', lineHeight: 1.45, color: s.dat ? '#15803d' : '#b91c1c', fontWeight: s.dat ? 500 : 600 }}>
                                  {fmt.lyDo}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </section>
  )
}
