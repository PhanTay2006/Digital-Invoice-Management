import { useEffect, useRef, useState } from 'react'
import { apiFetch, DEFAULT_COMPANY_INFO, verifyCompanyBuyer } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import CurrencyInput from '../../../components/common/CurrencyInput'
import { validateInvoiceForm } from '../../../utils/validation'

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
  const [companyInfo, setCompanyInfo] = useState({ ...DEFAULT_COMPANY_INFO })
  const [soHoaDon, setSoHoaDon] = useState('')
  const [nccId, setNccId] = useState('')
  const [poId, setPoId] = useState('')
  const [ngayLap, setNgayLap] = useState(new Date().toISOString().slice(0, 10))
  const [maCqt, setMaCqt] = useState('')
  const [tenNguoiMua, setTenNguoiMua] = useState('')
  const [mstNguoiMua, setMstNguoiMua] = useState('')
  const [vat, setVat] = useState('1000000')
  const [tienCocTru, setTienCocTru] = useState('0')
  const [filePdf, setFilePdf] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dong, setDong] = useState([
    { ma_sku_ncc: 'ABC-01', ten_san_pham: 'Thiết bị 5G tiêu chuẩn', so_luong: 100, don_gia: 1000000 },
  ])
  const [extractedData, setExtractedData] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadElapsed, setUploadElapsed] = useState(0)
  const [previewType, setPreviewType] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [modalError, setModalError] = useState(null)
  const [isQuickAddingSupplier, setIsQuickAddingSupplier] = useState(false)
  const uploadAbortRef = useRef(null)
  const fileInputRef = useRef(null)

  function clearError(key) {
    setFormErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const canEdit = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  const nccMap = Object.fromEntries(suppliers.map((s) => [s.id, s]))
  const poMap = Object.fromEntries(pos.map((p) => [p.id, p]))

  async function loadData(status = filterStatus) {
    try {
      const q = status ? `?trang_thai=${encodeURIComponent(status)}` : ''
      const [hdList, nccList, poList, cty] = await Promise.all([
        apiFetch(`/hoa-don${q}`),
        apiFetch('/nha-cung-cap'),
        apiFetch('/po'),
        apiFetch('/cong-ty').catch(() => null),
      ])
      setInvoices(hdList)
      setSuppliers(nccList)
      setPos(poList)
      if (cty?.ten_cong_ty) setCompanyInfo(cty)
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

  useEffect(() => {
    if (!isUploading) {
      setUploadElapsed(0)
      return undefined
    }
    setUploadElapsed(0)
    const timer = setInterval(() => setUploadElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [isUploading])

  useEffect(() => () => uploadAbortRef.current?.abort(), [])

  function handleCancelUpload(silent = false) {
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
      uploadAbortRef.current = null
    }
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!silent) {
      setUploadError('Đã hủy quá trình trích xuất chứng từ. Bạn có thể chọn file khác hoặc nhập thủ công.')
    }
  }

  function closeUploadModal() {
    handleCancelUpload(true)
    setIsUploadModalOpen(false)
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort()
      uploadAbortRef.current = null
    }
    setMsg(null)
    setUploadError(null)

    const validExtensions = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg']
    const lowerName = file.name.toLowerCase()
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext))
    if (!hasValidExt) {
      const errText = 'Định dạng file không hợp lệ. Vui lòng chọn file hóa đơn hợp lệ (.pdf, .docx, .xlsx, .png, .jpg).'
      setUploadError(errText)
      setMsg({ type: 'error', text: errText })
      e.target.value = ''
      return
    }

    setUploadedFileName(file.name)
    if (lowerName.endsWith('.pdf')) {
      setPreviewUrl(URL.createObjectURL(file))
      setPreviewType('pdf')
    } else if (['.png', '.jpg', '.jpeg'].some((ext) => lowerName.endsWith(ext))) {
      setPreviewUrl(URL.createObjectURL(file))
      setPreviewType('image')
    } else {
      setPreviewUrl(null)
      setPreviewType(null)
    }

    const fd = new FormData()
    fd.append('file', file)
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setIsUploading(true)
    try {
      const res = await apiFetch('/hoa-don/upload', { method: 'POST', body: fd, signal: controller.signal })
      setFilePdf(res.file_pdf)
      setSoHoaDon(res.so_hoa_don || '')
      if (res.nha_cung_cap_id) setNccId(String(res.nha_cung_cap_id))
      if (res.nha_cung_cap_id) {
        setNccId(String(res.nha_cung_cap_id))
      } else if (res.mst) {
        const matchedSup = suppliers.find((s) => s.mst === res.mst)
        if (matchedSup) setNccId(String(matchedSup.id))
      }
      if (res.po_id) setPoId(String(res.po_id))
      if (res.ngay_lap) setNgayLap(res.ngay_lap)
      setMaCqt(res.ma_cqt || '')
      setTenNguoiMua(res.ten_nguoi_mua || '')
      setMstNguoiMua(res.mst_nguoi_mua || '')
      setVat(res.vat != null ? String(res.vat) : '0')
      setTienCocTru(res.tien_coc_tru != null ? String(res.tien_coc_tru) : '0')
      if (res.dong?.length) {
        setDong(
          res.dong.map((d) => ({
            ma_sku_ncc: d.ma_sku_ncc,
            ten_san_pham: d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku_ncc}`,
            so_luong: d.so_luong,
            don_gia: d.don_gia,
          }))
        )
      } else {
        setDong([{ ma_sku_ncc: '', ten_san_pham: '', so_luong: 1, don_gia: 0 }])
      }
      setExtractedData({
        so_hoa_don: res.so_hoa_don || null,
        ngay_lap: res.ngay_lap || null,
        ncc_id: res.nha_cung_cap_id || null,
        ten_ncc_raw: res.ten_ncc || null,
        mst_raw: res.mst || null,
        ten_nguoi_mua_raw: res.ten_nguoi_mua || null,
        mst_nguoi_mua_raw: res.mst_nguoi_mua || null,
        kiem_tra_cong_ty:
          res.kiem_tra_cong_ty || verifyCompanyBuyer(res.ten_nguoi_mua, res.mst_nguoi_mua, companyInfo),
        ma_cqt_raw: res.ma_cqt || null,
        po_id: res.po_id || null,
        so_po_raw: res.so_po || null,
        vat_raw: res.vat != null ? Number(res.vat) : null,
        tien_coc_tru_raw: res.tien_coc_tru != null ? Number(res.tien_coc_tru) : 0,
        so_dong: res.dong?.length || 0,
        dong: res.dong || [],
        tong_thanh_toan_raw: res.tong_thanh_toan != null ? Number(res.tong_thanh_toan) : null,
        loai_file: res.loai_file,
        phuong_phap: res.phuong_phap,
        so_trang: res.so_trang,
        van_ban_trich_xuat: res.van_ban_trich_xuat || '',
        canh_bao: res.canh_bao || [],
      })
      setMsg({
        type: 'success',
        text: 'Đã trích xuất dữ liệu hóa đơn thành công! Hãy kiểm tra thông tin trước khi lưu.',
      })
    } catch (err) {
      if (err?.name === 'AbortError') return
      setUploadError(err.message)
      setMsg({ type: 'error', text: err.message })
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null
        setIsUploading(false)
      }
    }
  }

  async function handleQuickAddSupplier() {
    if (!extractedData?.mst_raw || isQuickAddingSupplier) return
    setIsQuickAddingSupplier(true)
    setModalError(null)
    try {
      const tenMoi = extractedData.ten_ncc_raw || `Nhà cung cấp ${extractedData.mst_raw}`
      const created = await apiFetch('/nha-cung-cap', {
        method: 'POST',
        body: JSON.stringify({ ten: tenMoi, mst: extractedData.mst_raw }),
      })
      const nccList = await apiFetch('/nha-cung-cap')
      setSuppliers(nccList)
      if (created?.id) {
        setNccId(String(created.id))
        clearError('nccId')
      }
    } catch (err) {
      setModalError(`Không thêm nhanh được NCC: ${err.message}`)
    } finally {
      setIsQuickAddingSupplier(false)
    }
  }

  async function handleCreateInvoice(e) {
    e.preventDefault()
    setMsg(null)
    setModalError(null)
    const check = validateInvoiceForm({
      soHoaDon,
      nccId,
      poId,
      ngayLap,
      maCqt,
      mstNguoiMua,
      vat,
      tienCocTru,
      dong,
    })
    if (!check.valid) {
      setFormErrors(check.errors)
      setModalError(check.summary)
      return
    }
    setFormErrors({})
    try {
      const res = await apiFetch('/hoa-don', {
        method: 'POST',
        body: JSON.stringify({
          so_hoa_don: soHoaDon.trim(),
          nha_cung_cap_id: Number(nccId),
          po_id: Number(poId),
          ngay_lap: ngayLap,
          ma_cqt: maCqt.trim() || undefined,
          ten_nguoi_mua: tenNguoiMua.trim() || undefined,
          mst_nguoi_mua: mstNguoiMua.trim() || undefined,
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
      setTenNguoiMua('')
      setMstNguoiMua('')
      setFilePdf(null)
      setPreviewUrl(null)
      setExtractedData(null)
      setFormErrors({})
      setModalError(null)
      setIsCreateModalOpen(false)
      setIsUploadModalOpen(false)
      await loadData()
      await viewDetail(res.id)
    } catch (err) {
      setModalError(err.message)
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
    clearError(`dong_${index}_${field}`)
    clearError('dong')
    clearError('tienCocTru')
  }

  const truocVat = dong.reduce((s, d) => s + (Number(d.so_luong) || 0) * (Number(d.don_gia) || 0), 0)
  const tongThanhToan = truocVat + Number(vat || 0) - Number(tienCocTru || 0)

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý Hóa đơn</h1>
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
                  setPreviewUrl(null)
                  setPreviewType(null)
                  setUploadedFileName('')
                  setUploadError(null)
                  setFilePdf(null)
                  setIsUploadModalOpen(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>⇪</span> Tải Hóa đơn lên
              </button>

              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setFilePdf(null)
                  setPreviewUrl(null)
                  setExtractedData(null)
                  setTenNguoiMua(companyInfo.ten_cong_ty || '')
                  setMstNguoiMua(companyInfo.mst || '')
                  if (!dong.length || !dong[0]?.ma_sku_ncc) {
                    setDong([{ ma_sku_ncc: 'ABC-01', ten_san_pham: 'Thiết bị 5G tiêu chuẩn', so_luong: 100, don_gia: 1000000 }])
                    setVat('1000000')
                  }
                  setFormErrors({})
                  setModalError(null)
                  setIsCreateModalOpen(true)
                }}
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
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SỐ HÓA ĐƠN</th>
                <th>NHÀ CUNG CẤP</th>
                <th>MÃ SỐ THUẾ</th>
                <th>PO THAM CHIẾU</th>
                <th>SẢN PHẨM / MẶT HÀNG</th>
                <th>NGÀY LẬP</th>
                <th>MÃ CQT</th>
                <th>TỔNG THANH TOÁN (₫)</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
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
                        <span style={{ whiteSpace: 'nowrap' }}>{inv.mst_ncc || ncc?.mst || '—'}</span>
                      </td>
                      <td>
                        <span>{po ? po.so_po : `PO #${inv.po_id}`}</span>
                      </td>
                      <td>
                        {inv.mat_hang ? (
                          inv.mat_hang.split(', ').map((item, idx) => (
                            <div key={idx} style={{ fontWeight: 600, lineHeight: 1.4 }}>{item}</div>
                          ))
                        ) : '—'}
                      </td>
                      <td>{inv.ngay_lap}</td>
                      <td style={{ maxWidth: 160 }}>
                        <span
                          title={inv.ma_cqt || ''}
                          style={{
                            display: 'block',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {inv.ma_cqt || '—'}
                        </span>
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
              borderRadius: 0,
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
            {(() => {
              const kt = verifyCompanyBuyer(selectedInvoice.ten_nguoi_mua, selectedInvoice.mst_nguoi_mua, companyInfo)
              return (
                <div>
                  <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                    Đơn vị mua hàng (trên HĐ)
                  </span>
                  <strong>{selectedInvoice.ten_nguoi_mua || 'Chưa ghi trên HĐ'}</strong>
                  {selectedInvoice.mst_nguoi_mua && (
                    <small style={{ display: 'block', color: '#64748b' }}>
                      MST: {selectedInvoice.mst_nguoi_mua}
                    </small>
                  )}
                  {(selectedInvoice.ten_nguoi_mua || selectedInvoice.mst_nguoi_mua) && (
                    <span
                      className={`status-pill ${kt.dat ? 'success' : 'danger'}`}
                      style={{ marginTop: 4, display: 'inline-block', fontSize: 11, padding: '2px 8px' }}
                    >
                      {kt.dat ? '✓ Khớp hồ sơ công ty' : '✕ Sai thông tin công ty'}
                    </span>
                  )}
                </div>
              )
            })()}
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
            <div style={{ minWidth: 0 }}>
              <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                Mã Cơ quan Thuế (CQT)
              </span>
              <strong style={{ display: 'block', overflowWrap: 'anywhere', wordBreak: 'break-all', fontSize: 13.5, lineHeight: 1.4 }}>
                {selectedInvoice.ma_cqt || 'Chưa cấp'}
              </strong>
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
                  <th>SẢN PHẨM / MẶT HÀNG</th>
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
                      <strong style={{ display: 'block' }}>{d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku_ncc}`}</strong>
                      <span className="muted-cell" style={{ fontSize: 12 }}>
                        SKU NCC: <strong className="invoice-id">{d.ma_sku_ncc}</strong>
                      </span>
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
        <div className="modal-overlay" onClick={closeUploadModal}>
          <div className="modal-container modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Tải lên File Hóa đơn</h2>
                <small style={{ color: '#64748b' }}>
                  Đối chiếu trực tiếp chứng từ bên trái với dữ liệu trích xuất tự động bên phải
                </small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeUploadModal}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-split-layout">
                {/* CỘT TRÁI: FILE PDF / ẢNH TẢI LÊN */}
                <div className="upload-split-left">
                  <div className="upload-pdf-box upload-pdf-box-compact">
                    <label>Chọn file hóa đơn (PDF / DOCX / XLSX / Ảnh)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                        onChange={handlePdfUpload}
                        disabled={isUploading}
                      />
                      {previewUrl && (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="button button-secondary"
                          style={{ padding: '4px 10px', fontSize: 12, textDecoration: 'none' }}
                        >
                          ↗ Mở full trang
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="upload-preview-pane">
                    {previewUrl && previewType === 'pdf' ? (
                      <iframe src={`${previewUrl}#view=Fit&navpanes=0`} title="Xem trước Hóa đơn" />
                    ) : previewUrl && previewType === 'image' ? (
                      <img src={previewUrl} alt="Xem trước Hóa đơn" />
                    ) : (
                      <div className="upload-placeholder">
                        {uploadedFileName ? (
                          <>
                            <strong style={{ display: 'block', color: '#0f172a', marginBottom: 4 }}>
                              {uploadedFileName}
                            </strong>
                            <span>Định dạng này không hỗ trợ xem trước trực tiếp trên trình duyệt, dữ liệu đã được gửi để trích xuất.</span>
                          </>
                        ) : (
                          <span>Chọn file PDF hoặc ảnh chứng từ hóa đơn để xem trước tại đây.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI: THÔNG TIN TRÍCH XUẤT */}
                <div className="upload-split-right">
                  {uploadError && (
                    <div className="alert-banner alert-error" style={{ marginBottom: 0 }}>
                      {uploadError}
                    </div>
                  )}

                  {isUploading && (
                    <div className="extract-summary-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <div>
                          <div className="extract-summary-title">Đang xử lý chứng từ... ({uploadElapsed}s)</div>
                          <p className="muted-cell" style={{ margin: 0, fontSize: 13 }}>
                            Đang đọc và trích xuất dữ liệu hóa đơn...
                          </p>
                        </div>
                        <button
                          type="button"
                          className="button"
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', flexShrink: 0 }}
                          onClick={() => handleCancelUpload(false)}
                        >
                          ✕ Hủy trích xuất
                        </button>
                      </div>
                    </div>
                  )}

                  {!isUploading && !extractedData && (
                    <div className="extract-summary-card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div className="upload-placeholder">
                        Thông tin trích xuất tự động từ hóa đơn sẽ hiển thị tại đây để bạn đối chiếu trực tiếp với chứng từ bên trái.
                      </div>
                    </div>
                  )}

                  {!isUploading && extractedData && (() => {
                    const tongDongTrichXuat = (extractedData.dong || []).reduce(
                      (s, d) => s + (Number(d.so_luong) || 0) * (Number(d.don_gia) || 0),
                      0
                    )
                    const tongTienTrichXuat =
                      extractedData.tong_thanh_toan_raw != null
                        ? extractedData.tong_thanh_toan_raw
                        : extractedData.dong?.length > 0
                          ? tongDongTrichXuat + (extractedData.vat_raw || 0) - (extractedData.tien_coc_tru_raw || 0)
                          : null
                    const tenNccHienThi =
                      extractedData.ten_ncc_raw || (extractedData.ncc_id ? nccMap[extractedData.ncc_id]?.ten : null)
                    const soPoHienThi =
                      extractedData.so_po_raw || (extractedData.po_id ? poMap[extractedData.po_id]?.so_po : null)

                    return (
                      <div className="extract-summary-card">
                        <div className="extract-summary-title">✓ Dữ liệu trích xuất tự động</div>
                        <div className="extract-summary-list">
                          <div className="extract-summary-item">
                            <span>Số hóa đơn:</span>
                            {extractedData.so_hoa_don ? (
                              <strong>{extractedData.so_hoa_don}</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Ngày lập:</span>
                            {extractedData.ngay_lap ? (
                              <strong>{extractedData.ngay_lap}</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Nhà cung cấp:</span>
                            {tenNccHienThi ? (
                              <strong>{tenNccHienThi}</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Mã số thuế NCC:</span>
                            {extractedData.mst_raw ? (
                              <strong>{extractedData.mst_raw}</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Đơn vị mua (Bên mua):</span>
                            {extractedData.ten_nguoi_mua_raw || extractedData.mst_nguoi_mua_raw ? (
                              <strong>
                                {extractedData.ten_nguoi_mua_raw || '—'}
                                {extractedData.mst_nguoi_mua_raw ? ` (MST: ${extractedData.mst_nguoi_mua_raw})` : ''}
                              </strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Đối chiếu thông tin công ty:</span>
                            {extractedData.kiem_tra_cong_ty?.trang_thai === 'KHOP' ? (
                              <span className="status-pill success">✓ Khớp {companyInfo.ten_cong_ty}</span>
                            ) : extractedData.kiem_tra_cong_ty?.trang_thai === 'KHONG_KHOP' ? (
                              <span className="status-pill danger">✕ Sai đơn vị mua hàng</span>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện bên mua</strong>
                            )}
                          </div>
                          {extractedData.ma_cqt_raw && (
                            <div className="extract-summary-item">
                              <span>Mã CQT:</span>
                              <strong style={{ fontSize: 12, wordBreak: 'break-all' }}>{extractedData.ma_cqt_raw}</strong>
                            </div>
                          )}
                          <div className="extract-summary-item">
                            <span>PO tham chiếu:</span>
                            {soPoHienThi ? (
                              <strong>{soPoHienThi}</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Thuế VAT:</span>
                            {extractedData.vat_raw != null ? (
                              <strong>{extractedData.vat_raw.toLocaleString('vi-VN')} ₫</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Tổng tiền thanh toán:</span>
                            {tongTienTrichXuat != null ? (
                              <strong style={{ color: '#2563eb' }}>{tongTienTrichXuat.toLocaleString('vi-VN')} ₫</strong>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Số dòng hàng:</span>
                            <strong>{extractedData.so_dong} mặt hàng</strong>
                          </div>
                        </div>

                      {extractedData.dong?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                            Dòng hàng nhận diện ({extractedData.dong.length})
                          </div>
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>SKU / Sản phẩm</th>
                                  <th>SL</th>
                                  <th>Đơn giá (₫)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {extractedData.dong.map((d, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <strong className="invoice-id" style={{ display: 'block' }}>{d.ma_sku_ncc}</strong>
                                      {d.ten_san_pham && (
                                        <span className="muted-cell" style={{ fontSize: 12 }}>{d.ten_san_pham}</span>
                                      )}
                                    </td>
                                    <td>{Number(d.so_luong).toLocaleString('vi-VN')}</td>
                                    <td className="amount-cell">{Number(d.don_gia).toLocaleString('vi-VN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {extractedData.kiem_tra_cong_ty?.trang_thai === 'KHONG_KHOP' && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: '8px 10px',
                            borderRadius: 0,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            fontSize: 12.5,
                            color: '#b91c1c',
                          }}
                        >
                          <strong>Cảnh báo sai Công ty Bên mua:</strong> {extractedData.kiem_tra_cong_ty.thong_bao}
                          <div style={{ marginTop: 2, color: '#7f1d1d' }}>
                            Chuẩn hồ sơ: <strong>{companyInfo.ten_cong_ty}</strong> (MST: <strong>{companyInfo.mst}</strong>)
                          </div>
                        </div>
                      )}

                      {extractedData.canh_bao?.length > 0 && (
                        <div style={{ marginTop: 12, fontSize: 13, color: '#b45309' }}>
                          <strong>Lưu ý khi trích xuất:</strong>
                          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                            {extractedData.canh_bao.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {extractedData.van_ban_trich_xuat && (
                        <details style={{ marginTop: 12 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: '#475569' }}>
                            Xem văn bản OCR / PDF đọc được
                          </summary>
                          <pre
                            style={{
                              margin: '8px 0 0',
                              padding: 10,
                              borderRadius: 0,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              fontSize: 11.5,
                              whiteSpace: 'pre-wrap',
                              maxHeight: 180,
                              overflowY: 'auto',
                            }}
                          >
                            {extractedData.van_ban_trich_xuat}
                          </pre>
                        </details>
                      )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {isUploading && (
                <button
                  type="button"
                  className="button"
                  style={{ background: '#dc2626', color: '#ffffff', border: '1px solid #dc2626' }}
                  onClick={() => handleCancelUpload(false)}
                >
                  ✕ Hủy trích xuất
                </button>
              )}
              <button
                type="button"
                className="button button-secondary"
                onClick={closeUploadModal}
              >
                Đóng
              </button>
              {extractedData && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setFormErrors({})
                    setModalError(null)
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
                <h2 className="modal-title">
                  {filePdf ? 'Kiểm tra & Lưu Hóa đơn' : 'Tạo Hóa đơn Mới'}
                </h2>
                <small style={{ color: '#64748b' }}>
                  Quyền hạn: Kế toán AP (KE_TOAN_AP){filePdf ? ' • Đính kèm chứng từ PDF' : ' • Nhập thủ công'}
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
            <form onSubmit={handleCreateInvoice} noValidate>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-banner alert-error">{modalError}</div>
                )}

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Số hóa đơn *</label>
                    <input
                      className={formErrors.soHoaDon ? 'input-error' : ''}
                      value={soHoaDon}
                      onChange={(e) => {
                        setSoHoaDon(e.target.value)
                        clearError('soHoaDon')
                      }}
                      placeholder="VD: HD-0458"
                    />
                    {formErrors.soHoaDon && <span className="field-error">{formErrors.soHoaDon}</span>}
                  </div>
                  <div className="form-group">
                    <label>Ngày lập hóa đơn *</label>
                    <input
                      type="date"
                      className={formErrors.ngayLap ? 'input-error' : ''}
                      value={ngayLap}
                      onChange={(e) => {
                        setNgayLap(e.target.value)
                        clearError('ngayLap')
                      }}
                    />
                    {formErrors.ngayLap && <span className="field-error">{formErrors.ngayLap}</span>}
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
                    {extractedData?.mst_raw &&
                      (nccId ? nccMap[Number(nccId)]?.mst : null) !== extractedData.mst_raw && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '8px 10px',
                            borderRadius: 0,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            fontSize: 12,
                            color: '#92400e',
                          }}
                        >
                          <div>
                            Hóa đơn trích xuất NCC: <strong>{extractedData.ten_ncc_raw || 'Chưa rõ tên'}</strong> — MST:{' '}
                            <strong>{extractedData.mst_raw}</strong> (khác với NCC đang chọn / chưa có trong danh mục).
                          </div>
                          {!suppliers.some((s) => s.mst === extractedData.mst_raw) && (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ marginTop: 6, height: 28, padding: '0 10px', fontSize: 12 }}
                              onClick={handleQuickAddSupplier}
                              disabled={isQuickAddingSupplier}
                            >
                              {isQuickAddingSupplier ? '⏳ Đang thêm NCC...' : '+ Thêm nhanh & chọn NCC này'}
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                  <div className="form-group">
                    <label>Đơn đặt hàng (PO) tham chiếu *</label>
                    <select
                      className={formErrors.poId ? 'input-error' : ''}
                      value={poId}
                      onChange={(e) => {
                        setPoId(e.target.value)
                        clearError('poId')
                      }}
                    >
                      {pos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.so_po} — {p.ten_ncc}
                        </option>
                      ))}
                    </select>
                    {formErrors.poId && <span className="field-error">{formErrors.poId}</span>}
                  </div>
                </div>

                {(() => {
                  const liveBuyerCheck = verifyCompanyBuyer(tenNguoiMua, mstNguoiMua, companyInfo)
                  const hasBuyerInput = Boolean((tenNguoiMua || '').trim() || (mstNguoiMua || '').trim())
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div className="form-row-2">
                        <div className="form-group">
                          <label>Đơn vị mua hàng trên HĐ</label>
                          <input
                            value={tenNguoiMua}
                            onChange={(e) => setTenNguoiMua(e.target.value)}
                            placeholder={companyInfo.ten_cong_ty}
                          />
                        </div>
                        <div className="form-group">
                          <label>MST bên mua trên HĐ</label>
                          <input
                            className={formErrors.mstNguoiMua ? 'input-error' : ''}
                            value={mstNguoiMua}
                            onChange={(e) => {
                              setMstNguoiMua(e.target.value)
                              clearError('mstNguoiMua')
                            }}
                            placeholder={companyInfo.mst}
                          />
                          {formErrors.mstNguoiMua && <span className="field-error">{formErrors.mstNguoiMua}</span>}
                        </div>
                      </div>
                      {hasBuyerInput && liveBuyerCheck.trang_thai === 'KHONG_KHOP' && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '8px 10px',
                            borderRadius: 0,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            fontSize: 12,
                            color: '#b91c1c',
                          }}
                        >
                          <strong>⚠ {liveBuyerCheck.thong_bao}</strong> — Hồ sơ hiện tại:{' '}
                          <strong>{companyInfo.ten_cong_ty}</strong> (MST: <strong>{companyInfo.mst}</strong>). Khi chạy đối soát bước kiểm tra bên mua sẽ báo Lệch.
                        </div>
                      )}
                      {!(tenNguoiMua || '').trim() && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '8px 10px',
                            borderRadius: 0,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            fontSize: 12,
                            color: '#92400e',
                          }}
                        >
                          Chưa có <strong>Tên Đơn vị mua hàng trên HĐ</strong> — khi đối soát sẽ đối chiếu với{' '}
                          <strong>{companyInfo.ten_cong_ty}</strong> và báo Không đạt nếu thiếu tên đơn vị mua hàng.
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Mã Cơ quan Thuế (Mã CQT)</label>
                    <input
                      className={formErrors.maCqt ? 'input-error' : ''}
                      value={maCqt}
                      onChange={(e) => {
                        setMaCqt(e.target.value)
                        clearError('maCqt')
                      }}
                      placeholder="VD: 00E4A1B2C3D4..."
                    />
                    {formErrors.maCqt && <span className="field-error">{formErrors.maCqt}</span>}
                  </div>
                  <div className="form-group">
                    <label>Tiền thuế VAT (₫) *</label>
                    <CurrencyInput
                      className={formErrors.vat ? 'input-error' : ''}
                      value={vat}
                      onChange={(val) => {
                        setVat(val)
                        clearError('vat')
                        clearError('tienCocTru')
                      }}
                      placeholder="VD: 1.000.000"
                    />
                    {formErrors.vat && <span className="field-error">{formErrors.vat}</span>}
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Khoản cọc đã trừ (₫)</label>
                    <CurrencyInput
                      className={formErrors.tienCocTru ? 'input-error' : ''}
                      value={tienCocTru}
                      onChange={(val) => {
                        setTienCocTru(val)
                        clearError('tienCocTru')
                      }}
                      placeholder="0"
                    />
                    {formErrors.tienCocTru && <span className="field-error">{formErrors.tienCocTru}</span>}
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
                  {formErrors.dong && <span className="field-error" style={{ marginBottom: 8 }}>{formErrors.dong}</span>}

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
                      <div key={index} style={{ marginBottom: 8 }}>
                        <div className="line-item-row" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.3fr 1.3fr auto', gap: 8, alignItems: 'center' }}>
                          <input
                            className={formErrors[`dong_${index}_ma_sku_ncc`] ? 'input-error' : ''}
                            placeholder="VD: ABC-01"
                            value={d.ma_sku_ncc}
                            onChange={(e) => handleLineChange(index, 'ma_sku_ncc', e.target.value)}
                          />
                          <input
                            placeholder="VD: Thiết bị 5G tiêu chuẩn"
                            value={d.ten_san_pham || ''}
                            onChange={(e) => handleLineChange(index, 'ten_san_pham', e.target.value)}
                          />
                          <input
                            type="number"
                            min="1"
                            step="any"
                            className={formErrors[`dong_${index}_so_luong`] ? 'input-error' : ''}
                            placeholder="Số lượng"
                            value={d.so_luong}
                            onChange={(e) => handleLineChange(index, 'so_luong', e.target.value)}
                          />
                          <CurrencyInput
                            className={formErrors[`dong_${index}_don_gia`] ? 'input-error' : ''}
                            placeholder="Đơn giá"
                            value={d.don_gia}
                            onChange={(val) => handleLineChange(index, 'don_gia', val)}
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
                        {(formErrors[`dong_${index}_ma_sku_ncc`] ||
                          formErrors[`dong_${index}_so_luong`] ||
                          formErrors[`dong_${index}_don_gia`]) && (
                          <span className="field-error">
                            {[
                              formErrors[`dong_${index}_ma_sku_ncc`],
                              formErrors[`dong_${index}_so_luong`],
                              formErrors[`dong_${index}_don_gia`],
                            ]
                              .filter(Boolean)
                              .join(' • ')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="total-preview" style={{ marginTop: 16, padding: 12, background: '#f8fafc', borderRadius: 0, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  onClick={() => {
                    setFormErrors({})
                    setModalError(null)
                    setIsCreateModalOpen(false)
                  }}
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
