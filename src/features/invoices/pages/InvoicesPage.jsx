import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TRANG_THAI_HD = {
  CHUA_DOI_SOAT: { label: 'Chưa đối soát', tone: 'info' },
  MATCHED: { label: 'Khớp (Matched)', tone: 'success' },
  PARTIAL: { label: 'Chờ đủ kho (Partial)', tone: 'warning' },
  MISMATCH: { label: 'Lệch (Mismatch)', tone: 'danger' },
  RECONCILED: { label: 'Đã đối soát (Reconciled)', tone: 'success' },
}

export default function InvoicesPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pos, setPos] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [msg, setMsg] = useState(null)

  const [soHoaDon, setSoHoaDon] = useState('')
  const [nccId, setNccId] = useState('')
  const [poId, setPoId] = useState('')
  const [ngayLap, setNgayLap] = useState(new Date().toISOString().slice(0, 10))
  const [vat, setVat] = useState('1000000')
  const [tienCocTru, setTienCocTru] = useState('0')
  const [filePdf, setFilePdf] = useState(null)
  const [uploadMeta, setUploadMeta] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dong, setDong] = useState([{ ma_sku_ncc: 'ABC-01', so_luong: 100, don_gia: 1000000 }])

  const canEdit = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

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
      setUploadMeta({
        loai_file: res.loai_file || 'PDF',
        phuong_phap: res.phuong_phap || 'pdfplumber / PaddleOCR',
        so_trang: res.so_trang || 1,
      })
      if (res.so_hoa_don) setSoHoaDon(res.so_hoa_don)
      if (res.nha_cung_cap_id) setNccId(String(res.nha_cung_cap_id))
      if (res.po_id) setPoId(String(res.po_id))
      if (res.ngay_lap) setNgayLap(res.ngay_lap)
      if (res.vat) setVat(String(res.vat))
      if (res.tien_coc_tru) setTienCocTru(String(res.tien_coc_tru))
      if (res.dong?.length) {
        setDong(res.dong.map((d) => ({ ma_sku_ncc: d.ma_sku_ncc, so_luong: d.so_luong, don_gia: d.don_gia })))
      }
      setMsg({
        type: 'success',
        text: `Đã trích xuất tự động bằng [${res.phuong_phap || 'pdfplumber'}] (${res.loai_file || 'PDF'}, ${res.so_trang || 1} trang)! ${res.canh_bao?.length ? 'Lưu ý: ' + res.canh_bao.join('; ') : 'Hãy đối chiếu bản xem trước và bấm Lưu xác nhận.'}`,
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
          vat: Number(vat || 0),
          tien_coc_tru: Number(tienCocTru || 0),
          file_pdf: filePdf,
          dong: dong.map((d) => ({
            ma_sku_ncc: d.ma_sku_ncc.trim(),
            so_luong: Number(d.so_luong),
            don_gia: Number(d.don_gia),
          })),
        }),
      })
      setMsg({
        type: 'success',
        text: `Đã lưu Hóa đơn #${res.id} vào bảng hoa_don & dong_hoa_don! Tổng thanh toán: ${Number(res.tong_thanh_toan).toLocaleString('vi-VN')} ₫`,
      })
      setSoHoaDon('')
      setFilePdf(null)
      await loadData()
      await viewDetail(res.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const truocVat = dong.reduce((s, d) => s + (Number(d.so_luong) || 0) * (Number(d.don_gia) || 0), 0)
  const tongThanhToan = truocVat + Number(vat || 0) - Number(tienCocTru || 0)

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PHÂN HỆ HÓA ĐƠN B2B (F-01, F-05, F-06)</p>
          <h1>Quản lý Hóa đơn & Bóc tách PDF</h1>
          <p className="page-description">
            Lưu trữ trong bảng <code>hoa_don</code> và <code>dong_hoa_don</code>. Chống trùng số hóa đơn trong cùng một Nhà cung cấp (BR-01).
          </p>
        </div>
        <div className="heading-actions">
          <select
            className="period-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="CHUA_DOI_SOAT">Chưa đối soát</option>
            <option value="MATCHED">Khớp (Matched)</option>
            <option value="PARTIAL">Chờ đủ kho (Partial)</option>
            <option value="MISMATCH">Lệch (Mismatch)</option>
            <option value="RECONCILED">Đã khóa (Reconciled)</option>
          </select>
          <button className="button button-secondary" type="button" onClick={() => loadData()}>↻ Làm mới</button>
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
              <h2>Danh sách Hóa đơn B2B ({invoices.length})</h2>
              <p>Bấm vào từng dòng để xem chi tiết dòng hàng và lịch sử các lần chạy đối soát</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SỐ HÓA ĐƠN</th>
                  <th>PO ID</th>
                  <th>NGÀY LẬP</th>
                  <th>TỔNG THANH TOÁN (₫)</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = TRANG_THAI_HD[inv.trang_thai] || { label: inv.trang_thai, tone: 'info' }
                  return (
                    <tr key={inv.id} onClick={() => viewDetail(inv.id)} style={{ cursor: 'pointer' }}>
                      <td>#{inv.id}</td>
                      <td><strong className="invoice-id">{inv.so_hoa_don}</strong></td>
                      <td>PO #{inv.po_id}</td>
                      <td>{inv.ngay_lap}</td>
                      <td className="amount-cell">{Number(inv.tong_thanh_toan).toLocaleString('vi-VN')}</td>
                      <td>
                        <span className={`status-pill ${st.tone}`}>
                          {st.label} {inv.theo_ngoai_le ? '(Ngoại lệ)' : ''}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {selectedInvoice && (
            <div className="detail-box">
              <h3>Chi tiết Hóa đơn: {selectedInvoice.so_hoa_don} (ID #{selectedInvoice.id})</h3>
              <p className="muted-cell">
                Trước thuế: <b>{Number(selectedInvoice.tong_truoc_vat).toLocaleString('vi-VN')} ₫</b> | VAT: <b>{Number(selectedInvoice.vat).toLocaleString('vi-VN')} ₫</b> | Trừ cọc: <b>{Number(selectedInvoice.tien_coc_tru).toLocaleString('vi-VN')} ₫</b>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>MÃ SKU NCC</th>
                    <th>DÒNG PO ÁNH XẠ</th>
                    <th>SỐ LƯỢNG</th>
                    <th>ĐƠN GIÁ (₫)</th>
                    <th>THÀNH TIỀN (₫)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.dong?.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.ma_sku_ncc}</strong></td>
                      <td>{d.dong_po_id ? `Dòng PO #${d.dong_po_id}` : '⚠️ Chưa ánh xạ SKU'}</td>
                      <td>{Number(d.so_luong).toLocaleString('vi-VN')}</td>
                      <td>{Number(d.don_gia).toLocaleString('vi-VN')}</td>
                      <td className="amount-cell">{Number(d.thanh_tien).toLocaleString('vi-VN')}</td>
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
              <h2>Tạo Hóa đơn mới / Upload PDF (UC05, UC06)</h2>
              <p>Quyền hạn: <strong>Kế toán AP (KE_TOAN_AP)</strong></p>
            </div>
          </div>

          {!canEdit ? (
            <div className="role-notice">
              Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong>. Để nhập hoặc upload hóa đơn, hãy đăng nhập bằng tài khoản <code>ketoan</code> (Kế toán AP).
            </div>
          ) : (
            <form onSubmit={handleCreateInvoice} className="crud-form">
              <div className="upload-pdf-box">
                <label>📄 Tải lên Chứng từ Hóa đơn (.pdf điện tử, .pdf scan, .docx, .xlsx) — Tự động chọn <code>pdfplumber</code> hoặc <code>PaddleOCR</code>:</label>
                <input type="file" accept=".pdf,.docx,.xlsx" onChange={handlePdfUpload} />
                {uploadMeta && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    <span className="status-pill info">Loại file: {uploadMeta.loai_file}</span>
                    <span className="status-pill success">Engine: {uploadMeta.phuong_phap}</span>
                    <span className="status-pill warning">Số trang: {uploadMeta.so_trang}</span>
                  </div>
                )}
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    title="Xem trước PDF Hóa đơn"
                    style={{ width: '100%', height: 220, border: '1px solid #dcdfe8', borderRadius: 8, marginTop: 6 }}
                  />
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Số hóa đơn *</label>
                  <input value={soHoaDon} onChange={(e) => setSoHoaDon(e.target.value)} placeholder="VD: HD-0458" required />
                </div>
                <div className="form-group">
                  <label>Ngày lập hóa đơn *</label>
                  <input type="date" value={ngayLap} onChange={(e) => setNgayLap(e.target.value)} required />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Nhà cung cấp *</label>
                  <select value={nccId} onChange={(e) => setNccId(e.target.value)} required>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.ten} ({s.mst})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Đơn đặt hàng (PO) tham chiếu *</label>
                  <select value={poId} onChange={(e) => setPoId(e.target.value)} required>
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>{p.so_po} — {p.ten_ncc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Tiền thuế VAT (₫) *</label>
                  <input type="number" min="0" value={vat} onChange={(e) => setVat(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Khoản cọc đã trừ (₫)</label>
                  <input type="number" min="0" value={tienCocTru} onChange={(e) => setTienCocTru(e.target.value)} />
                </div>
              </div>

              <div className="line-items-header">
                <strong>Dòng hàng trên Hóa đơn (Mã SKU của NCC)</strong>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setDong([...dong, { ma_sku_ncc: 'ABC-01', so_luong: 1, don_gia: 0 }])}
                >
                  + Thêm dòng
                </button>
              </div>

              {dong.map((item, idx) => (
                <div key={idx} className="line-item-row">
                  <input
                    placeholder="Mã SKU NCC (VD: ABC-01)"
                    value={item.ma_sku_ncc}
                    onChange={(e) => setDong(dong.map((x, i) => (i === idx ? { ...x, ma_sku_ncc: e.target.value } : x)))}
                    required
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="Số lượng"
                    value={item.so_luong}
                    onChange={(e) => setDong(dong.map((x, i) => (i === idx ? { ...x, so_luong: e.target.value } : x)))}
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Đơn giá"
                    value={item.don_gia}
                    onChange={(e) => setDong(dong.map((x, i) => (i === idx ? { ...x, don_gia: e.target.value } : x)))}
                    required
                  />
                </div>
              ))}

              <div className="total-preview">
                Tổng thanh toán tự tính (BR-02): <strong>{tongThanhToan.toLocaleString('vi-VN')} ₫</strong>
              </div>

              <button type="submit" className="button button-primary" style={{ width: '100%' }}>
                Lưu Hóa đơn vào PostgreSQL
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
