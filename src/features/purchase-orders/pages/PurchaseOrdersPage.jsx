import { useEffect, useState } from 'react'
import { apiFetch, DEFAULT_COMPANY_INFO } from '../../../services/api'
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
  const [companyInfo, setCompanyInfo] = useState({ ...DEFAULT_COMPANY_INFO })
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedPo, setSelectedPo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Form states
  const [soPo, setSoPo] = useState('')
  const [nccId, setNccId] = useState('')
  const [ngayDat, setNgayDat] = useState(new Date().toISOString().slice(0, 10))
  const [loaiPo, setLoaiPo] = useState('HANG_HOA')
  const [dieuKhoan, setDieuKhoan] = useState('Net 30')
  const [tienCoc, setTienCoc] = useState('0')
  const [dong, setDong] = useState([
    { ma_sku: 'SKU-01', mo_ta: 'Mặt hàng tiêu chuẩn', so_luong_dat: 10, don_gia: 1000000 },
  ])
  const [formErrors, setFormErrors] = useState({})
  const [modalError, setModalError] = useState(null)

  function clearError(key) {
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const canCreate = ['MUA_HANG', 'TOAN_QUYEN'].includes(user?.vai_tro)
  const nccMap = Object.fromEntries(suppliers.map((s) => [Number(s.id), s]))

  async function viewDetail(id) {
    try {
      const detail = await apiFetch(`/po/${id}`)
      setSelectedPo(detail)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [poList, nccList, cty] = await Promise.all([
        apiFetch('/po'),
        apiFetch('/nha-cung-cap'),
        apiFetch('/cong-ty').catch(() => null),
      ])
      setPos(poList)
      setSuppliers(nccList)
      if (cty?.ten_cong_ty) setCompanyInfo(cty)
      if (nccList.length > 0 && !nccId) {
        setNccId(String(nccList[0].id))
      }
      if (poList.length > 0) {
        const targetId =
          selectedPo && poList.some((p) => p.id === selectedPo.id)
            ? selectedPo.id
            : poList[0].id
        await viewDetail(targetId)
      } else {
        setSelectedPo(null)
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

  function resetManualForm() {
    setSoPo('')
    setNgayDat(new Date().toISOString().slice(0, 10))
    if (suppliers.length > 0 && !nccId) setNccId(String(suppliers[0].id))
    setLoaiPo('HANG_HOA')
    setDieuKhoan('Net 30')
    setTienCoc('0')
    setDong([{ ma_sku: 'SKU-01', mo_ta: 'Mặt hàng tiêu chuẩn', so_luong_dat: 10, don_gia: 1000000 }])
    setFormErrors({})
    setModalError(null)
  }

  function addLine() {
    setDong([
      ...dong,
      {
        ma_sku: `SKU-0${dong.length + 1}`,
        mo_ta: '',
        so_luong_dat: 1,
        don_gia: 0,
      },
    ])
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

  const tongTamTinh = dong.reduce(
    (sum, d) => sum + (Number(d.so_luong_dat) || 0) * (Number(d.don_gia) || 0),
    0
  )
  const tongSoLuongForm = dong.reduce((sum, d) => sum + (Number(d.so_luong_dat) || 0), 0)

  async function handleCreatePo(e) {
    e.preventDefault()
    setMsg(null)
    setModalError(null)
    const check = validatePoForm({ soPo, nccId, ngayDat, loaiPo, tienCoc, dong })
    if (!check.valid) {
      setFormErrors(check.errors)
      setModalError(check.summary)
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
            mo_ta: (d.mo_ta || '').trim() || null,
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
      setModalError(null)
      setIsCreateModalOpen(false)
      await loadData()
      await viewDetail(res.id)
    } catch (err) {
      setModalError(err.message)
      setMsg({ type: 'error', text: err.message })
    }
  }

  const filteredPos = filterStatus ? pos.filter((p) => p.trang_thai === filterStatus) : pos

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý Đơn đặt hàng (PO)</h1>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="period-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Đang mở</option>
            <option value="PARTIALLY_RECEIVED">Nhận một phần</option>
            <option value="CLOSED">Đã nhận đủ</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <button className="button button-secondary" type="button" onClick={loadData}>
            ↻ Làm mới
          </button>

          {canCreate && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                resetManualForm()
                setIsCreateModalOpen(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>+</span> Tạo Đơn hàng mới
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {!canCreate && (
        <div className="role-notice" style={{ marginBottom: 16 }}>
          Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong>. Để tạo Đơn đặt hàng (PO) mới, hãy đăng nhập bằng tài khoản <code>muahang</code> (Nhân viên mua hàng).
        </div>
      )}

      {/* BẢNG DANH SÁCH ĐƠN ĐẶT HÀNG (FULL WIDTH RỘNG RÃI NHƯ HÓA ĐƠN) */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Danh sách Đơn đặt hàng ({filteredPos.length})</h2>
          </div>
        </div>

        {loading ? (
          <p className="muted-cell" style={{ padding: '20px 0', textAlign: 'center' }}>
            Đang tải dữ liệu...
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SỐ PO</th>
                  <th>NHÀ CUNG CẤP</th>
                  <th>SẢN PHẨM</th>
                  <th>SỐ LƯỢNG</th>
                  <th>LOẠI PO</th>
                  <th>NGÀY ĐẶT</th>
                  <th>TỔNG TIỀN (₫)</th>
                  <th>TIỀN CỌC (₫)</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {filteredPos.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                      Không có đơn đặt hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredPos.map((po) => {
                    const st = TRANG_THAI_PO[po.trang_thai] || { label: po.trang_thai, tone: 'info' }
                    const isSelected = selectedPo?.id === po.id
                    const rawItems =
                      Array.isArray(po.dong_tom_tat) && po.dong_tom_tat.length > 0
                        ? po.dong_tom_tat
                        : Array.isArray(po.dong) && po.dong.length > 0
                        ? po.dong
                        : po.mat_hang
                        ? po.mat_hang.split(', ').map((name) => ({ ten_san_pham: name, so_luong_dat: null }))
                        : []
                    const tongSl = Number(po.tong_so_luong_dat ?? rawItems.reduce((s, x) => s + Number(x.so_luong_dat || 0), 0))
                    return (
                      <tr
                        key={po.id}
                        onClick={() => viewDetail(po.id)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#f0f7ff' : undefined,
                        }}
                      >
                        <td>#{po.id}</td>
                        <td>
                          <strong className="invoice-id">{po.so_po}</strong>
                        </td>
                        <td>
                          <strong>{po.ten_ncc}</strong>
                          {po.mst_ncc && (
                            <small style={{ display: 'block', color: '#64748b' }}>MST: {po.mst_ncc}</small>
                          )}
                        </td>
                        <td>
                          {rawItems.length > 0 ? (
                            <div>
                              {rawItems.map((item, idx) => (
                                <div key={idx} style={{ fontWeight: 600, lineHeight: 1.5 }}>
                                  {item.ten_san_pham || item.mo_ta || item.ma_sku}
                                  {item.ma_sku &&
                                    (item.ten_san_pham || item.mo_ta) &&
                                    (item.ten_san_pham || item.mo_ta) !== item.ma_sku && (
                                      <span className="muted-cell" style={{ fontWeight: 400, fontSize: 11.5 }}>
                                        {' '}({item.ma_sku})
                                      </span>
                                    )}
                                </div>
                              ))}
                              {rawItems.length > 1 && (
                                <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>
                                  Tổng: {rawItems.length} loại sản phẩm
                                </small>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {rawItems.length > 0 ? (
                            <div>
                              {rawItems.map((item, idx) => (
                                <div key={idx} style={{ lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                                  <strong>
                                    {item.so_luong_dat != null
                                      ? Number(item.so_luong_dat).toLocaleString('vi-VN')
                                      : '—'}
                                  </strong>
                                </div>
                              ))}
                              {rawItems.length > 1 && (
                                <small style={{ display: 'block', color: '#475569', marginTop: 2, fontWeight: 600 }}>
                                  Tổng đặt: {tongSl.toLocaleString('vi-VN')}
                                </small>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{po.loai_po === 'HANG_HOA' ? 'Hàng hóa' : 'Dịch vụ'}</td>
                        <td>{po.ngay_dat}</td>
                        <td className="amount-cell">{Number(po.tong_tien).toLocaleString('vi-VN')}</td>
                        <td className="amount-cell">{Number(po.tien_coc).toLocaleString('vi-VN')}</td>
                        <td>
                          <span className={`status-pill ${st.tone}`}>{st.label}</span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHI TIẾT ĐƠN ĐẶT HÀNG ĐANG CHỌN (ĐỒNG BỘ VỚI TRANG HÓA ĐƠN) */}
      {selectedPo && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Chi tiết Đơn đặt hàng: {selectedPo.so_po} (#{selectedPo.id})
              </h2>
            </div>
            <div>
              <span
                className={`status-pill ${TRANG_THAI_PO[selectedPo.trang_thai]?.tone || 'info'}`}
                style={{ fontSize: 13, padding: '5px 12px' }}
              >
                {TRANG_THAI_PO[selectedPo.trang_thai]?.label || selectedPo.trang_thai}
              </span>
            </div>
          </div>

          {(() => {
            const ncc = nccMap[Number(selectedPo.nha_cung_cap_id)]
            const lines = selectedPo.dong || []
            const tongSlDat = lines.reduce((s, d) => s + Number(d.so_luong_dat || 0), 0)
            return (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14,
                    marginBottom: 20,
                    padding: 16,
                    background: '#f8fafc',
                    borderRadius: 0,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Nhà cung cấp
                    </span>
                    <strong>{ncc?.ten || selectedPo.ten_ncc || `NCC #${selectedPo.nha_cung_cap_id}`}</strong>
                    {(ncc?.mst || selectedPo.mst_ncc) && (
                      <small style={{ display: 'block', color: '#64748b' }}>
                        MST: {ncc?.mst || selectedPo.mst_ncc}
                      </small>
                    )}
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Đơn vị mua hàng
                    </span>
                    <strong>{companyInfo.ten_cong_ty}</strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      MST: {companyInfo.mst}
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Loại đơn hàng & Điều khoản
                    </span>
                    <strong>
                      {selectedPo.loai_po === 'HANG_HOA' ? 'Hàng hóa (Đối soát 3 chiều)' : 'Dịch vụ (Đối soát 2 chiều)'}
                    </strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Thanh toán: {selectedPo.dieu_khoan_tt || 'Không có'}
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Ngày đặt hàng
                    </span>
                    <strong>{selectedPo.ngay_dat}</strong>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Loại sản phẩm & Tổng số lượng
                    </span>
                    <strong>{lines.length} loại sản phẩm</strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Tổng SL đặt: {tongSlDat.toLocaleString('vi-VN')} đơn vị
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Khoản cọc đã trả
                    </span>
                    <strong>{Number(selectedPo.tien_coc || 0).toLocaleString('vi-VN')} ₫</strong>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Tổng giá trị PO
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: 16 }}>
                      {Number(selectedPo.tong_tien || 0).toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                </div>

                <h3>Danh sách Dòng mặt hàng trên Đơn đặt hàng</h3>
                <div className="table-wrap">
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
                      {lines.map((d, idx) => (
                        <tr key={d.id || idx}>
                          <td>#{idx + 1}</td>
                          <td>
                            <strong style={{ display: 'block' }}>
                              {d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku}`}
                            </strong>
                            <span className="muted-cell" style={{ fontSize: 12 }}>
                              SKU nội bộ: <strong className="invoice-id">{d.ma_sku}</strong>
                            </span>
                          </td>
                          <td>
                            <strong>{Number(d.so_luong_dat).toLocaleString('vi-VN')}</strong>
                          </td>
                          <td className="amount-cell">{Number(d.don_gia).toLocaleString('vi-VN')}</td>
                          <td className="amount-cell">
                            {(Number(d.so_luong_dat) * Number(d.don_gia)).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan="2">TỔNG CỘNG ({lines.length} loại sản phẩm)</td>
                        <td>{tongSlDat.toLocaleString('vi-VN')}</td>
                        <td>—</td>
                        <td className="amount-cell" style={{ color: '#2563eb' }}>
                          {Number(selectedPo.tong_tien || 0).toLocaleString('vi-VN')} ₫
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* POPUP: TẠO ĐƠN ĐẶT HÀNG MỚI (TÁCH RIÊNG NHƯ HÓA ĐƠN) */}
      {isCreateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setFormErrors({})
            setModalError(null)
            setIsCreateModalOpen(false)
          }}
        >
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Tạo Đơn đặt hàng (PO) mới</h2>
                <small style={{ color: '#64748b' }}>
                  Quyền hạn: Nhân viên Mua hàng (MUA_HANG) • Đơn vị mua: {companyInfo.ten_cong_ty}
                </small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setFormErrors({})
                  setModalError(null)
                  setIsCreateModalOpen(false)
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePo} noValidate>
              <div className="modal-body">
                {modalError && <div className="alert-banner alert-error">{modalError}</div>}

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
                    <label>Ngày đặt hàng *</label>
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

                <div className="form-row-2">
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

                  <div className="form-group">
                    <label>Loại PO</label>
                    <select value={loaiPo} onChange={(e) => setLoaiPo(e.target.value)}>
                      <option value="HANG_HOA">Hàng hóa (Đối soát 3 chiều)</option>
                      <option value="DICH_VU">Dịch vụ (Đối soát 2 chiều)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
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

                  <div className="form-group">
                    <label>Điều khoản thanh toán</label>
                    <input
                      value={dieuKhoan}
                      onChange={(e) => setDieuKhoan(e.target.value)}
                      placeholder="VD: Net 30, Chuyển khoản"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 14 }}>Dòng mặt hàng chi tiết</h3>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={addLine}
                      style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                    >
                      + Thêm mặt hàng
                    </button>
                  </div>
                  {formErrors.dong && (
                    <span className="field-error" style={{ marginBottom: 8 }}>
                      {formErrors.dong}
                    </span>
                  )}

                  <div className="line-items-table">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr 1.3fr auto',
                        gap: 8,
                        marginBottom: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#64748b',
                      }}
                    >
                      <span>MÃ SKU *</span>
                      <span>TÊN SẢN PHẨM *</span>
                      <span>SỐ LƯỢNG *</span>
                      <span>ĐƠN GIÁ (₫) *</span>
                      <span>THÀNH TIỀN (₫)</span>
                      <span></span>
                    </div>

                    {dong.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: 8 }}>
                        <div
                          className="line-item-row"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr 1.3fr auto',
                            gap: 8,
                            alignItems: 'center',
                          }}
                        >
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
                          <div style={{ padding: '0 8px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                            {((Number(item.so_luong_dat) || 0) * (Number(item.don_gia) || 0)).toLocaleString('vi-VN')} ₫
                          </div>
                          <button
                            type="button"
                            className="button-icon-danger"
                            onClick={() => removeLine(idx)}
                            disabled={dong.length <= 1}
                            title={dong.length <= 1 ? 'Cần tối thiểu 1 dòng hàng' : 'Xóa dòng này'}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: dong.length <= 1 ? 'not-allowed' : 'pointer',
                              color: dong.length <= 1 ? '#cbd5e1' : '#ef4444',
                              fontSize: 16,
                              padding: '4px 8px',
                            }}
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
                </div>

                <div
                  className="total-preview"
                  style={{
                    marginTop: 16,
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 0,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    Loại sản phẩm: <strong>{dong.length} loại</strong> • Tổng số lượng đặt:{' '}
                    <strong>{tongSoLuongForm.toLocaleString('vi-VN')}</strong>
                  </div>
                  <div>
                    <span style={{ marginRight: 8 }}>Tổng giá trị PO dự kiến:</span>
                    <strong style={{ fontSize: 18, color: '#2563eb' }}>
                      {tongTamTinh.toLocaleString('vi-VN')} ₫
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setFormErrors({})
                    setModalError(null)
                    setIsCreateModalOpen(false)
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="button button-primary">
                  ✓ Lưu Đơn đặt hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
