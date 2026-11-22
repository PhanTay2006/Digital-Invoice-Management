import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import CurrencyInput from '../../../components/common/CurrencyInput'
import { validatePoForm } from '../../../utils/validation'

const TRANG_THAI_PO = {
  OPEN: { label: 'Đang mở', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Nhận một phần', tone: 'warning' },
  CLOSED: { label: 'Đã nhận đủ', tone: 'success' },
  CANCELLED: { label: 'Đã hủy', tone: 'danger' },
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth()
  const [pos, setPos] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [selectedPo, setSelectedPo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  const [soPo, setSoPo] = useState('')
  const [nccId, setNccId] = useState('')
  const [ngayDat, setNgayDat] = useState(new Date().toISOString().slice(0, 10))
  const [loaiPo, setLoaiPo] = useState('HANG_HOA')
  const [dieuKhoan, setDieuKhoan] = useState('Net 30')
  const [tienCoc, setTienCoc] = useState('0')
  const [dong, setDong] = useState([{ ma_sku: 'SKU-01', mo_ta: 'Mặt hàng tiêu chuẩn', so_luong_dat: 10, don_gia: 1000000 }])
  const [formErrors, setFormErrors] = useState({})

  function clearError(key) {
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const canCreate = ['MUA_HANG', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    setLoading(true)
    try {
      const [poList, nccList] = await Promise.all([
        apiFetch('/po'),
        apiFetch('/nha-cung-cap'),
      ])
      setPos(poList)
      setSuppliers(nccList)
      if (nccList.length > 0 && !nccId) {
        setNccId(String(nccList[0].id))
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function viewDetail(id) {
    try {
      const detail = await apiFetch(`/po/${id}`)
      setSelectedPo(detail)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  function addLine() {
    setDong([...dong, { ma_sku: '', mo_ta: '', so_luong_dat: 1, don_gia: 0 }])
  }

  function updateLine(idx, field, val) {
    setDong(dong.map((item, i) => (i === idx ? { ...item, [field]: val } : item)))
    clearError(`dong_${idx}_${field}`)
    clearError('dong')
    clearError('tienCoc')
  }

  function removeLine(idx) {
    if (dong.length <= 1) return
    setDong(dong.filter((_, i) => i !== idx))
    setFormErrors({})
  }

  const tongTamTinh = dong.reduce((sum, d) => sum + (Number(d.so_luong_dat) || 0) * (Number(d.don_gia) || 0), 0)

  async function handleCreatePo(e) {
    e.preventDefault()
    setMsg(null)
    const check = validatePoForm({ soPo, nccId, ngayDat, loaiPo, tienCoc, dong })
    if (!check.valid) {
      setFormErrors(check.errors)
      setMsg({ type: 'error', text: check.summary })
      return
    }
    setFormErrors({})
    try {
      const res = await apiFetch('/po', {
        method: 'POST',
        body: JSON.stringify({
          so_po: soPo.trim(),
          nha_cung_cap_id: Number(nccId),
          ngay_dat: ngayDat,
          loai_po: loaiPo,
          dieu_khoan_tt: dieuKhoan,
          tien_coc: Number(tienCoc || 0),
          dong: dong.map((d) => ({
            ma_sku: d.ma_sku.trim(),
            mo_ta: d.mo_ta,
            so_luong_dat: Number(d.so_luong_dat),
            don_gia: Number(d.don_gia),
          })),
        }),
      })
      setMsg({
        type: 'success',
        text: `Đã lưu Đơn đặt hàng mới (ID #${res.id}) thành công! Tổng tiền: ${Number(res.tong_tien).toLocaleString('vi-VN')} ₫`,
      })
      setSoPo('')
      setFormErrors({})
      await loadData()
      await viewDetail(res.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý Đơn đặt hàng (PO)</h1>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={loadData}>↻ Làm mới</button>
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      <div className="dashboard-columns">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Danh sách Đơn đặt hàng ({pos.length})</h2>
            </div>
          </div>

          {loading ? (
            <p className="muted-cell">Đang tải dữ liệu...</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>SỐ PO</th>
                    <th>NHÀ CUNG CẤP</th>
                    <th>SẢN PHẨM / MẶT HÀNG</th>
                    <th>LOẠI PO</th>
                    <th>NGÀY ĐẶT</th>
                    <th>TỔNG TIỀN (₫)</th>
                    <th>TIỀN CỌC (₫)</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po) => {
                    const st = TRANG_THAI_PO[po.trang_thai] || { label: po.trang_thai, tone: 'info' }
                    return (
                      <tr key={po.id} onClick={() => viewDetail(po.id)} style={{ cursor: 'pointer' }}>
                        <td>#{po.id}</td>
                        <td><strong className="invoice-id">{po.so_po}</strong></td>
                        <td>{po.ten_ncc} <small className="muted-cell">({po.mst_ncc})</small></td>
                        <td>
                          {po.mat_hang ? (
                            po.mat_hang.split(', ').map((item, idx) => (
                              <div key={idx} style={{ fontWeight: 600, lineHeight: 1.4 }}>{item}</div>
                            ))
                          ) : '—'}
                        </td>
                        <td>{po.loai_po === 'HANG_HOA' ? 'Hàng hóa' : 'Dịch vụ'}</td>
                        <td>{po.ngay_dat}</td>
                        <td className="amount-cell">{Number(po.tong_tien).toLocaleString('vi-VN')}</td>
                        <td>{Number(po.tien_coc).toLocaleString('vi-VN')}</td>
                        <td><span className={`status-pill ${st.tone}`}>{st.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selectedPo && (
            <div className="detail-box">
              <h3>Chi tiết Đơn đặt hàng: {selectedPo.so_po} (ID #{selectedPo.id})</h3>
              <p className="muted-cell">
                Điều khoản thanh toán: <strong>{selectedPo.dieu_khoan_tt || 'Không có'}</strong> | Trạng thái: <strong>{selectedPo.trang_thai}</strong>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>SẢN PHẨM / MẶT HÀNG</th>
                    <th>SỐ LƯỢNG ĐẶT</th>
                    <th>ĐƠN GIÁ (₫)</th>
                    <th>THÀNH TIỀN (₫)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPo.dong.map((d, idx) => (
                    <tr key={d.id || idx}>
                      <td>#{idx + 1}</td>
                      <td>
                        <strong style={{ display: 'block' }}>{d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku}`}</strong>
                        <span className="muted-cell" style={{ fontSize: 12 }}>
                          SKU: <strong className="invoice-id">{d.ma_sku}</strong>
                        </span>
                      </td>
                      <td>{Number(d.so_luong_dat).toLocaleString('vi-VN')}</td>
                      <td>{Number(d.don_gia).toLocaleString('vi-VN')}</td>
                      <td className="amount-cell">
                        {(Number(d.so_luong_dat) * Number(d.don_gia)).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Tạo Đơn đặt hàng (PO) mới</h2>
            </div>
          </div>

          {!canCreate ? (
            <div className="role-notice">
              Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong>. Để tạo PO mới, hãy đăng xuất và chọn tài khoản <code>muahang</code> (Nhân viên mua hàng).
            </div>
          ) : (
            <form onSubmit={handleCreatePo} className="crud-form" noValidate>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Số PO *</label>
                  <input
                    className={formErrors.soPo ? 'input-error' : ''}
                    value={soPo}
                    onChange={(e) => {
                      setSoPo(e.target.value)
                      clearError('soPo')
                    }}
                    placeholder="VD: PO-2026-002"
                  />
                  {formErrors.soPo && <span className="field-error">{formErrors.soPo}</span>}
                </div>
                <div className="form-group">
                  <label>Ngày đặt *</label>
                  <input
                    type="date"
                    className={formErrors.ngayDat ? 'input-error' : ''}
                    value={ngayDat}
                    onChange={(e) => {
                      setNgayDat(e.target.value)
                      clearError('ngayDat')
                    }}
                  />
                  {formErrors.ngayDat && <span className="field-error">{formErrors.ngayDat}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Nhà cung cấp *</label>
                <select
                  className={formErrors.nccId ? 'input-error' : ''}
                  value={nccId}
                  onChange={(e) => {
                    setNccId(e.target.value)
                    clearError('nccId')
                  }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.ten} (MST: {s.mst})
                    </option>
                  ))}
                </select>
                {formErrors.nccId && <span className="field-error">{formErrors.nccId}</span>}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Loại PO</label>
                  <select value={loaiPo} onChange={(e) => setLoaiPo(e.target.value)}>
                    <option value="HANG_HOA">Hàng hóa (Đối soát 3 chiều)</option>
                    <option value="DICH_VU">Dịch vụ (Đối soát 2 chiều)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Khoản cọc đã trả (₫)</label>
                  <CurrencyInput
                    className={formErrors.tienCoc ? 'input-error' : ''}
                    value={tienCoc}
                    onChange={(val) => {
                      setTienCoc(val)
                      clearError('tienCoc')
                    }}
                    placeholder="VD: 5.000.000"
                  />
                  {formErrors.tienCoc && <span className="field-error">{formErrors.tienCoc}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Điều khoản thanh toán</label>
                <input
                  value={dieuKhoan}
                  onChange={(e) => setDieuKhoan(e.target.value)}
                  placeholder="VD: Net 30, Chuyển khoản"
                />
              </div>

              <div className="line-items-block">
                <div className="line-items-header">
                  <strong>Dòng hàng chi tiết (Line Items)</strong>
                  <button type="button" className="button button-secondary" onClick={addLine}>+ Thêm dòng</button>
                </div>
                {formErrors.dong && <span className="field-error" style={{ marginBottom: 8 }}>{formErrors.dong}</span>}

                <div className="line-items-grid-header" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr auto', gap: 8, fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                  <span>MÃ SKU *</span>
                  <span>TÊN SẢN PHẨM *</span>
                  <span>SỐ LƯỢNG *</span>
                  <span>ĐƠN GIÁ (₫) *</span>
                  <span>XÓA</span>
                </div>

                {dong.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: 8 }}>
                    <div className="line-item-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        className={formErrors[`dong_${idx}_ma_sku`] ? 'input-error' : ''}
                        placeholder="VD: SKU-01"
                        value={item.ma_sku}
                        onChange={(e) => updateLine(idx, 'ma_sku', e.target.value)}
                      />
                      <input
                        placeholder="VD: Thiết bị 5G tiêu chuẩn"
                        value={item.mo_ta || ''}
                        onChange={(e) => updateLine(idx, 'mo_ta', e.target.value)}
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        className={formErrors[`dong_${idx}_so_luong_dat`] ? 'input-error' : ''}
                        placeholder="Số lượng"
                        value={item.so_luong_dat}
                        onChange={(e) => updateLine(idx, 'so_luong_dat', e.target.value)}
                      />
                      <CurrencyInput
                        className={formErrors[`dong_${idx}_don_gia`] ? 'input-error' : ''}
                        placeholder="VD: 100.000"
                        value={item.don_gia}
                        onChange={(val) => updateLine(idx, 'don_gia', val)}
                      />
                      <button
                        type="button"
                        className="remove-line-btn"
                        onClick={() => removeLine(idx)}
                        disabled={dong.length <= 1}
                        title={dong.length <= 1 ? 'Cần tối thiểu 1 dòng hàng' : 'Xóa dòng này'}
                      >
                        ✕
                      </button>
                    </div>
                    {(formErrors[`dong_${idx}_ma_sku`] ||
                      formErrors[`dong_${idx}_so_luong_dat`] ||
                      formErrors[`dong_${idx}_don_gia`]) && (
                      <span className="field-error">
                        {[
                          formErrors[`dong_${idx}_ma_sku`],
                          formErrors[`dong_${idx}_so_luong_dat`],
                          formErrors[`dong_${idx}_don_gia`],
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="total-preview">
                Tổng giá trị PO tự tính: <strong>{tongTamTinh.toLocaleString('vi-VN')} ₫</strong>
              </div>

              <button type="submit" className="button button-primary" style={{ width: '100%' }}>
                Lưu Đơn đặt hàng
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
