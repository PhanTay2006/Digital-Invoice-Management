import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import CurrencyInput from '../../../components/common/CurrencyInput'

const TRANG_THAI_HD = {
  CHUA_DOI_SOAT: { label: 'Chưa đối soát', tone: 'info' },
  MATCHED: { label: 'Khớp', tone: 'success' },
  PARTIAL: { label: 'Khớp một phần', tone: 'warning' },
  MISMATCH: { label: 'Lệch', tone: 'danger' },
  RECONCILED: { label: 'Đã đối soát', tone: 'success' },
}

export default function InvoicesPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pos, setPos] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [msg, setMsg] = useState(null)

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Form states
  const [soHoaDon, setSoHoaDon] = useState('')
  const [nccId, setNccId] = useState('')
  const [poId, setPoId] = useState('')
  const [ngayLap, setNgayLap] = useState(new Date().toISOString().slice(0, 10))
  const [maCqt, setMaCqt] = useState('')
  const [vat, setVat] = useState('1000000')
  const [tienCocTru, setTienCocTru] = useState('0')
  const [filePdf, setFilePdf] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dong, setDong] = useState([
    { ma_sku_ncc: 'ABC-01', ten_san_pham: 'Thiết bị 5G tiêu chuẩn', so_luong: 100, don_gia: 1000000 },
  ])
  const [extractedData, setExtractedData] = useState(null)

  const canEdit = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  const nccMap = Object.fromEntries(suppliers.map((s) => [s.id, s]))
  const poMap = Object.fromEntries(pos.map((p) => [p.id, p]))

  async function loadData(status = filterStatus) {
    try {
      const q = status ? `?trang_thai=${encodeURIComponent(status)}` : ''
      const [hdList, nccList, poList] = await Promise.all([
        apiFetch(`/hoa-don${q}`),
        apiFetch('/nha-cung-cap'),
        apiFetch('/po'),
      ])
      setInvoices(hdList)
      setSuppliers(nccList)
      setPos(poList)
      if (nccList.length > 0 && !nccId) setNccId(String(nccList[0].id))
      if (poList.length > 0 && !poId) setPoId(String(poList[0].id))
      if (hdList.length > 0 && !selectedInvoice) {
        viewDetail(hdList[0].id)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [filterStatus])

  async function viewDetail(id) {
    try {
      const detail = await apiFetch(`/hoa-don/${id}`)
      setSelectedInvoice(detail)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)

    const validExtensions = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      setMsg({ type: 'error', text: 'Định dạng file không hợp lệ. Vui lòng chọn file hóa đơn hợp lệ.' })
      e.target.value = ''
      return
    }

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setPreviewUrl(URL.createObjectURL(file))
    } else {
      setPreviewUrl(null)
    }
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await apiFetch('/hoa-don/upload', { method: 'POST', body: fd })
      setFilePdf(res.file_pdf)
      if (res.so_hoa_don) setSoHoaDon(res.so_hoa_don)
      if (res.nha_cung_cap_id) setNccId(String(res.nha_cung_cap_id))
      if (res.po_id) setPoId(String(res.po_id))
      if (res.ngay_lap) setNgayLap(res.ngay_lap)
      if (res.ma_cqt) setMaCqt(res.ma_cqt)
      if (res.vat) setVat(String(res.vat))
      if (res.tien_coc_tru) setTienCocTru(String(res.tien_coc_tru))
      if (res.dong?.length) {
        setDong(
          res.dong.map((d) => ({
            ma_sku_ncc: d.ma_sku_ncc,
            ten_san_pham: d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku_ncc}`,
            so_luong: d.so_luong,
            don_gia: d.don_gia,
          }))
        )
      }
      setExtractedData({
        so_hoa_don: res.so_hoa_don || 'Đã nhận diện',
        ngay_lap: res.ngay_lap || ngayLap,
        ncc_id: res.nha_cung_cap_id || nccId,
        po_id: res.po_id || poId,
        so_dong: res.dong?.length || 1,
      })
      setMsg({
        type: 'success',
        text: 'Đã trích xuất dữ liệu hóa đơn thành công! Hãy kiểm tra thông tin bên dưới.',
      })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleCreateInvoice(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch('/hoa-don', {
        method: 'POST',
        body: JSON.stringify({
          so_hoa_don: soHoaDon.trim(),
          nha_cung_cap_id: Number(nccId),
          po_id: Number(poId),
          ngay_lap: ngayLap,
          ma_cqt: maCqt.trim() || undefined,
          vat: Number(vat || 0),
          tien_coc_tru: Number(tienCocTru || 0),
          file_pdf: filePdf,
          dong: dong.map((d) => ({
            ma_sku_ncc: d.ma_sku_ncc.trim(),
            ten_san_pham: (d.ten_san_pham || '').trim(),
            so_luong: Number(d.so_luong),
            don_gia: Number(d.don_gia),
          })),
        }),
      })
      setMsg({
        type: 'success',
        text: `Đã lưu Hóa đơn #${res.id} thành công! Tổng thanh toán: ${Number(res.tong_thanh_toan).toLocaleString('vi-VN')} ₫`,
      })
      setSoHoaDon('')
      setFilePdf(null)
      setPreviewUrl(null)
      setExtractedData(null)
      setIsCreateModalOpen(false)
      setIsUploadModalOpen(false)
      await loadData()
      await viewDetail(res.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  function handleAddLine() {
    setDong([
      ...dong,
      {
        ma_sku_ncc: `SKU-${dong.length + 1}`,
        ten_san_pham: `Sản phẩm ${dong.length + 1}`,
        so_luong: 1,
        don_gia: 100000,
      },
    ])
  }

  function handleRemoveLine(index) {
    if (dong.length === 1) return
    setDong(dong.filter((_, i) => i !== index))
  }

  function handleLineChange(index, field, value) {
    const next = [...dong]
    next[index] = { ...next[index], [field]: value }
    setDong(next)
  }

  const truocVat = dong.reduce((s, d) => s + (Number(d.so_luong) || 0) * (Number(d.don_gia) || 0), 0)
  const tongThanhToan = truocVat + Number(vat || 0) - Number(tienCocTru || 0)

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PHÂN HỆ HÓA ĐƠN B2B</p>
          <h1>Quản lý Hóa đơn</h1>
          <p className="page-description">
            Quản lý danh sách hóa đơn mua hàng B2B và hỗ trợ trích xuất dữ liệu chứng từ tự động.
          </p>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="period-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="CHUA_DOI_SOAT">Chưa đối soát</option>
            <option value="MATCHED">Khớp</option>
            <option value="PARTIAL">Khớp một phần</option>
            <option value="MISMATCH">Lệch</option>
            <option value="RECONCILED">Đã đối soát</option>
          </select>

          <button className="button button-secondary" type="button" onClick={() => loadData()}>
            ↻ Làm mới
          </button>

          {canEdit && (
            <>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setExtractedData(null)
                  setIsUploadModalOpen(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>⇪</span> Tải Hóa đơn lên
              </button>

              <button
                className="button button-primary"
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>+</span> Tạo Hóa đơn mới
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {/* DANH SÁCH HÓA ĐƠN B2B */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <div>
            <h2>Danh sách Hóa đơn B2B ({invoices.length})</h2>
            <p>Bấm vào từng dòng để xem chi tiết đầy đủ thông tin hóa đơn và lịch sử đối soát 3 chiều</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SỐ HÓA ĐƠN</th>
                <th>NHÀ CUNG CẤP</th>
                <th>PO THAM CHIẾU</th>
                <th>NGÀY LẬP</th>
                <th>MÃ CQT</th>
                <th>TỔNG THANH TOÁN (₫)</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                    Không có hóa đơn nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const st = TRANG_THAI_HD[inv.trang_thai] || { label: inv.trang_thai, tone: 'info' }
                  const isSelected = selectedInvoice?.id === inv.id
                  const ncc = nccMap[inv.nha_cung_cap_id]
                  const po = poMap[inv.po_id]
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => viewDetail(inv.id)}
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
                        <span>{po ? po.so_po : `PO #${inv.po_id}`}</span>
                      </td>
                      <td>{inv.ngay_lap}</td>
                      <td>
                        <span>{inv.ma_cqt || '—'}</span>
                      </td>
                      <td className="amount-cell">
                        {Number(inv.tong_thanh_toan).toLocaleString('vi-VN')}
                      </td>
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
      </div>

      {/* CHI TIẾT HÓA ĐƠN ĐANG CHỌN */}
      {selectedInvoice && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Chi tiết Hóa đơn: {selectedInvoice.so_hoa_don} (#{selectedInvoice.id})
              </h2>
              <p>Thông tin chứng từ đầy đủ theo chuẩn đề tài và kết quả dòng hàng đối soát</p>
            </div>
            <div>
              <span
                className={`status-pill ${
                  TRANG_THAI_HD[selectedInvoice.trang_thai]?.tone || 'info'
                }`}
                style={{ fontSize: 13, padding: '5px 12px' }}
              >
                {TRANG_THAI_HD[selectedInvoice.trang_thai]?.label || selectedInvoice.trang_thai}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
              marginBottom: 20,
              padding: 16,
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Nhà cung cấp
              </span>
              <strong>
                {nccMap[selectedInvoice.nha_cung_cap_id]?.ten || `NCC #${selectedInvoice.nha_cung_cap_id}`}
              </strong>
              {nccMap[selectedInvoice.nha_cung_cap_id]?.mst && (
                <small style={{ display: 'block', color: '#64748b' }}>
                  MST: {nccMap[selectedInvoice.nha_cung_cap_id].mst}
                </small>
              )}
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Đơn đặt hàng (PO)
              </span>
              <strong>
                {poMap[selectedInvoice.po_id]?.so_po || `PO #${selectedInvoice.po_id}`}
              </strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Ngày lập hóa đơn
              </span>
              <strong>{selectedInvoice.ngay_lap}</strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Mã Cơ quan Thuế (CQT)
              </span>
              <strong>{selectedInvoice.ma_cqt || 'Chưa cấp'}</strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Tổng trước thuế
              </span>
              <strong>{Number(selectedInvoice.tong_truoc_vat || 0).toLocaleString('vi-VN')} ₫</strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Tiền thuế VAT
              </span>
              <strong>{Number(selectedInvoice.vat || 0).toLocaleString('vi-VN')} ₫</strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Khoản cọc đã trừ
              </span>
              <strong>{Number(selectedInvoice.tien_coc_tru || 0).toLocaleString('vi-VN')} ₫</strong>
            </div>
            <div>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Tổng thanh toán
              </span>
              <strong style={{ color: '#0f172a', fontSize: 16 }}>
                {Number(selectedInvoice.tong_thanh_toan || 0).toLocaleString('vi-VN')} ₫
              </strong>
            </div>
          </div>

          <h3>Danh sách Dòng mặt hàng trên Hóa đơn</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>MÃ SKU BÊN BÁN</th>
                  <th>TÊN SẢN PHẨM / HÀNG HÓA</th>
                  <th>SỐ LƯỢNG</th>
                  <th>ĐƠN GIÁ (₫)</th>
                  <th>THÀNH TIỀN (₫)</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.dong?.map((d, idx) => (
                  <tr key={d.id || idx}>
                    <td>#{idx + 1}</td>
                    <td>
                      <strong className="invoice-id">{d.ma_sku_ncc}</strong>
                    </td>
                    <td>
                      <strong>{d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku_ncc}`}</strong>
                    </td>
                    <td>{Number(d.so_luong).toLocaleString('vi-VN')}</td>
                    <td className="amount-cell">
                      {Number(d.don_gia).toLocaleString('vi-VN')}
                    </td>
                    <td className="amount-cell">
                      {Number(d.thanh_tien).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POPUP 1: TẢI HÓA ĐƠN LÊN */}
      {isUploadModalOpen && (
        <div className="modal-overlay" onClick={() => setIsUploadModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Tải lên File Hóa đơn</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsUploadModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-pdf-box">
                <label>Chọn file chứng từ hóa đơn</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                  onChange={handlePdfUpload}
                />
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    title="Xem trước Hóa đơn"
                    style={{
                      width: '100%',
                      height: 240,
                      border: '1px solid #dcdfe8',
                      borderRadius: 8,
                      marginTop: 10,
                    }}
                  />
                )}
              </div>

              {extractedData && (
                <div className="extract-summary-card">
                  <div className="extract-summary-title">✓ Dữ liệu trích xuất tự động:</div>
                  <div className="extract-summary-grid">
                    <div className="extract-summary-item">
                      <span>Số hóa đơn:</span>
                      <strong>{soHoaDon}</strong>
                    </div>
                    <div className="extract-summary-item">
                      <span>Ngày lập:</span>
                      <strong>{ngayLap}</strong>
                    </div>
                    <div className="extract-summary-item">
                      <span>Nhà cung cấp:</span>
                      <strong>{nccMap[nccId]?.ten || 'Đã chọn'}</strong>
                    </div>
                    <div className="extract-summary-item">
                      <span>PO tham chiếu:</span>
                      <strong>{poMap[poId]?.so_po || 'Đã chọn'}</strong>
                    </div>
                    <div className="extract-summary-item">
                      <span>Tiền thuế VAT:</span>
                      <strong>{Number(vat).toLocaleString('vi-VN')} ₫</strong>
                    </div>
                    <div className="extract-summary-item">
                      <span>Số dòng hàng:</span>
                      <strong>{dong.length} mặt hàng</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsUploadModalOpen(false)}
              >
                Đóng
              </button>
              {extractedData && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setIsUploadModalOpen(false)
                    setIsCreateModalOpen(true)
                  }}
                >
                  Kiểm tra & Lưu Hóa đơn →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: TẠO HÓA ĐƠN MỚI */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Tạo Hóa đơn Mới</h2>
                <small style={{ color: '#64748b' }}>Quyền hạn: Kế toán AP</small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateInvoice}>
              <div className="modal-body">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Số hóa đơn *</label>
                    <input
                      value={soHoaDon}
                      onChange={(e) => setSoHoaDon(e.target.value)}
                      placeholder="VD: HD-0458"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Ngày lập hóa đơn *</label>
                    <input
                      type="date"
                      value={ngayLap}
                      onChange={(e) => setNgayLap(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Nhà cung cấp *</label>
                    <select
                      value={nccId}
                      onChange={(e) => setNccId(e.target.value)}
                      required
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.ten} (MST: {s.mst})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Đơn đặt hàng (PO) tham chiếu *</label>
                    <select
                      value={poId}
                      onChange={(e) => setPoId(e.target.value)}
                      required
                    >
                      {pos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.so_po} — {p.ten_ncc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Mã Cơ quan Thuế (Mã CQT)</label>
                    <input
                      value={maCqt}
                      onChange={(e) => setMaCqt(e.target.value)}
                      placeholder="VD: 00E4A1B2C3D4..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Tiền thuế VAT (₫) *</label>
                    <CurrencyInput
                      value={vat}
                      onChange={(val) => setVat(val)}
                      placeholder="VD: 1.000.000"
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Khoản cọc đã trừ (₫)</label>
                    <CurrencyInput
                      value={tienCocTru}
                      onChange={(val) => setTienCocTru(val)}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>File chứng từ liên kết</label>
                    <input
                      type="text"
                      value={filePdf || ''}
                      readOnly
                      placeholder="Chưa có file (Tải lên qua nút Tải Hóa đơn)"
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
                      onClick={handleAddLine}
                      style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                    >
                      + Thêm mặt hàng
                    </button>
                  </div>

                  <div className="line-items-table">
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr 1.3fr auto', gap: 8, marginBottom: 6, fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                      <span>MÃ SKU NCC *</span>
                      <span>TÊN SẢN PHẨM *</span>
                      <span>SỐ LƯỢNG *</span>
                      <span>ĐƠN GIÁ (₫) *</span>
                      <span>THÀNH TIỀN (₫)</span>
                      <span></span>
                    </div>
                    {dong.map((d, index) => (
                      <div key={index} className="line-item-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr 1.3fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                        <input
                          placeholder="VD: ABC-01"
                          value={d.ma_sku_ncc}
                          onChange={(e) => handleLineChange(index, 'ma_sku_ncc', e.target.value)}
                          required
                        />
                        <input
                          placeholder="VD: Thiết bị 5G tiêu chuẩn"
                          value={d.ten_san_pham || ''}
                          onChange={(e) => handleLineChange(index, 'ten_san_pham', e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          min="1"
                          placeholder="Số lượng"
                          value={d.so_luong}
                          onChange={(e) => handleLineChange(index, 'so_luong', e.target.value)}
                          required
                        />
                        <CurrencyInput
                          placeholder="Đơn giá"
                          value={d.don_gia}
                          onChange={(val) => handleLineChange(index, 'don_gia', val)}
                          required
                        />
                        <div style={{ padding: '0 8px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                          {((Number(d.so_luong) || 0) * (Number(d.don_gia) || 0)).toLocaleString('vi-VN')} ₫
                        </div>
                        <button
                          type="button"
                          className="button-icon-danger"
                          onClick={() => handleRemoveLine(index)}
                          title="Xóa dòng này"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, padding: '4px 8px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="total-preview" style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Tổng thanh toán dự kiến:</span>
                  <strong style={{ fontSize: 18, color: '#2563eb' }}>
                    {tongThanhToan.toLocaleString('vi-VN')} ₫
                  </strong>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="button button-primary">
                  ✓ Lưu Hóa đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
