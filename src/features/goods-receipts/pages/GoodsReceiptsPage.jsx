import { useEffect, useRef, useState } from 'react'
import { apiFetch, DEFAULT_COMPANY_INFO, verifyCompanyBuyer } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import { validateGrnForm } from '../../../utils/validation'

export default function GoodsReceiptsPage() {
  const { user } = useAuth()
  const [grns, setGrns] = useState([])
  const [pos, setPos] = useState([])
  const [msg, setMsg] = useState(null)

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Form states
  const [companyInfo, setCompanyInfo] = useState({ ...DEFAULT_COMPANY_INFO })
  const [soPhieu, setSoPhieu] = useState('')
  const [poId, setPoId] = useState('')
  const [ngayNhap, setNgayNhap] = useState(new Date().toISOString().slice(0, 10))
  const [tenDonVi, setTenDonVi] = useState('')
  const [mstDonVi, setMstDonVi] = useState('')
  const [dongKho, setDongKho] = useState([])
  const [filePdf, setFilePdf] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [extractedData, setExtractedData] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadElapsed, setUploadElapsed] = useState(0)
  const [previewType, setPreviewType] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [modalError, setModalError] = useState(null)
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

  const canCreate = ['THU_KHO', 'TOAN_QUYEN'].includes(user?.vai_tro)
  const poMap = Object.fromEntries(pos.map((p) => [String(p.id), p]))

  async function loadData() {
    try {
      const [grnList, poList, cty] = await Promise.all([
        apiFetch('/phieu-kho'),
        apiFetch('/po'),
        apiFetch('/cong-ty').catch(() => null),
      ])
      setGrns(grnList)
      if (cty?.ten_cong_ty) setCompanyInfo(cty)
      const hangHoaPos = poList.filter((p) => p.loai_po === 'HANG_HOA')
      setPos(hangHoaPos)
      if (hangHoaPos.length > 0 && !poId) {
        await handleSelectPo(hangHoaPos[0].id)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSelectPo(id, extractedLines = null) {
    setPoId(String(id))
    try {
      const detail = await apiFetch(`/po/${id}`)
      const extractedByLineId = new Map(
        (extractedLines || [])
          .filter((l) => l.dong_po_id != null)
          .map((l) => [Number(l.dong_po_id), l])
      )
      const extractedBySku = new Map(
        (extractedLines || [])
          .filter((l) => l.ma_sku)
          .map((l) => [String(l.ma_sku).toUpperCase(), l])
      )

      setDongKho(
        detail.dong.map((d) => {
          const match =
            extractedByLineId.get(Number(d.id)) ||
            extractedBySku.get(String(d.ma_sku || '').toUpperCase())
          return {
            dong_po_id: d.id,
            ma_sku: d.ma_sku,
            ten_san_pham: d.mo_ta || `Sản phẩm ${d.ma_sku}`,
            so_luong_dat: d.so_luong_dat,
            so_nhan: match ? match.so_nhan : d.so_luong_dat,
            so_dat: match ? match.so_dat : d.so_luong_dat,
            so_tu_choi: match ? match.so_tu_choi : 0,
            ly_do: match?.ly_do || '',
          }
        })
      )
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  function updateLine(idx, field, val) {
    setDongKho((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )
    clearError(`dong_${idx}_so_nhan`)
    clearError(`dong_${idx}_so_dat`)
    clearError(`dong_${idx}_so_tu_choi`)
    clearError('dongKho')
  }

  function resetManualForm() {
    setSoPhieu('')
    setNgayNhap(new Date().toISOString().slice(0, 10))
    setTenDonVi(companyInfo.ten_cong_ty || '')
    setMstDonVi(companyInfo.mst || '')
    setFilePdf(null)
    setPreviewUrl(null)
    setExtractedData(null)
    setFormErrors({})
    setModalError(null)
    if (pos.length > 0) {
      handleSelectPo(pos[0].id)
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
      const errText = 'Định dạng file không hợp lệ. Vui lòng chọn file phiếu kho hợp lệ (.pdf, .docx, .xlsx, .png, .jpg).'
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
      const res = await apiFetch('/phieu-kho/upload', { method: 'POST', body: fd, signal: controller.signal })
      setFilePdf(res.file_pdf)
      setSoPhieu(res.so_phieu || '')
      if (res.ngay_nhap) setNgayNhap(res.ngay_nhap)
      setTenDonVi(res.ten_nguoi_mua || '')
      setMstDonVi(res.mst_nguoi_mua || '')

      if (res.po_id) {
        await handleSelectPo(res.po_id, res.dong || [])
      } else if (poId && res.dong?.length) {
        await handleSelectPo(poId, res.dong)
      }

      setExtractedData({
        so_phieu: res.so_phieu || null,
        ngay_nhap: res.ngay_nhap || null,
        so_po: res.so_po || null,
        po_id: res.po_id || null,
        ten_nguoi_mua: res.ten_nguoi_mua || null,
        mst_nguoi_mua: res.mst_nguoi_mua || null,
        kiem_tra_cong_ty: res.kiem_tra_cong_ty || verifyCompanyBuyer(res.ten_nguoi_mua, res.mst_nguoi_mua, companyInfo),
        so_dong: res.dong?.length || 0,
        dong: res.dong || [],
        loai_file: res.loai_file,
        phuong_phap: res.phuong_phap,
        so_trang: res.so_trang,
        van_ban_trich_xuat: res.van_ban_trich_xuat || '',
        canh_bao: res.canh_bao || [],
      })

      setMsg({
        type: 'success',
        text: 'Đã trích xuất dữ liệu phiếu kho thành công! Hãy kiểm tra thông tin trước khi lưu.',
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

  async function handleCreateGrn(e) {
    e.preventDefault()
    setMsg(null)
    setModalError(null)
    const check = validateGrnForm({ soPhieu, poId, ngayNhap, mstDonVi, dongKho })
    if (!check.valid) {
      setFormErrors(check.errors)
      setModalError(check.summary)
      return
    }
    setFormErrors({})
    try {
      const res = await apiFetch('/phieu-kho', {
        method: 'POST',
        body: JSON.stringify({
          so_phieu: soPhieu.trim(),
          po_id: Number(poId),
          ngay_nhap: ngayNhap,
          file_pdf: filePdf || null,
          ten_don_vi: tenDonVi.trim() || undefined,
          mst_don_vi: mstDonVi.trim() || undefined,
          dong: dongKho.map((d) => ({
            dong_po_id: d.dong_po_id,
            so_nhan: Number(d.so_nhan),
            so_dat: Number(d.so_dat),
            so_tu_choi: Number(d.so_tu_choi || 0),
            ly_do: d.ly_do || null,
          })),
        }),
      })
      setMsg({
        type: 'success',
        text: `Đã lập Phiếu nhập kho #${res.id} (Trạng thái: ${res.trang_thai}) vào bảng phieu_kho & dong_phieu_kho!`,
      })
      setSoPhieu('')
      setTenDonVi('')
      setMstDonVi('')
      setFilePdf(null)
      setPreviewUrl(null)
      setExtractedData(null)
      setFormErrors({})
      setModalError(null)
      setIsCreateModalOpen(false)
      setIsUploadModalOpen(false)
      await loadData()
    } catch (err) {
      setModalError(err.message)
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý Phiếu nhập kho (GRN)</h1>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="button button-secondary" type="button" onClick={loadData}>
            ↻ Làm mới
          </button>

          {canCreate && (
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
                <span>⇪</span> Tải Phiếu kho lên
              </button>

              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  resetManualForm()
                  setIsCreateModalOpen(true)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>+</span> Tạo Phiếu kho mới
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

      {!canCreate && (
        <div className="role-notice" style={{ marginBottom: 16 }}>
          Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong>. Để tải lên hoặc lập phiếu nhập kho (GRN), hãy đăng nhập bằng tài khoản <code>thukho</code> (Thủ kho).
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Danh sách Phiếu nhập kho ({grns.length})</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SỐ PHIẾU GRN</th>
                <th>SỐ PO THAM CHIẾU</th>
                <th>NHÀ CUNG CẤP</th>
                <th>SẢN PHẨM / MẶT HÀNG</th>
                <th>NGÀY NHẬP</th>
                <th>CHỨNG TỪ</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {grns.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                    Chưa có phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                grns.map((g) => (
                  <tr key={g.id}>
                    <td>#{g.id}</td>
                    <td><strong className="invoice-id">{g.so_phieu}</strong></td>
                    <td>{g.so_po}</td>
                    <td>{g.ten_ncc}</td>
                    <td>
                      {g.mat_hang ? (
                        g.mat_hang.split(', ').map((item, idx) => (
                          <div key={idx} style={{ fontWeight: 600, lineHeight: 1.4 }}>{item}</div>
                        ))
                      ) : '—'}
                    </td>
                    <td>{g.ngay_nhap}</td>
                    <td>
                      {g.file_pdf ? (
                        <span className="status-pill info">PDF đính kèm</span>
                      ) : (
                        <span className="muted-cell">Nhập tay</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${g.trang_thai === 'CONFIRMED' ? 'success' : 'warning'}`}>
                        {g.trang_thai === 'CONFIRMED' ? 'Đủ hàng' : 'Nhập một phần'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP 1: TẢI PHIẾU NHẬP KHO LÊN */}
      {isUploadModalOpen && (
        <div className="modal-overlay" onClick={closeUploadModal}>
          <div className="modal-container modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Tải lên File Phiếu nhập kho (GRN)</h2>
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
                    <label>Chọn file phiếu kho (PDF / DOCX / XLSX / Ảnh)</label>
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
                      <iframe src={`${previewUrl}#view=Fit&navpanes=0`} title="Xem trước Phiếu nhập kho" />
                    ) : previewUrl && previewType === 'image' ? (
                      <img src={previewUrl} alt="Xem trước Phiếu nhập kho" />
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
                          <span>Chọn file PDF hoặc ảnh chứng từ phiếu nhập kho để xem trước tại đây.</span>
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
                            Đang đọc và trích xuất dữ liệu phiếu kho...
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
                        Thông tin trích xuất tự động từ phiếu nhập kho sẽ hiển thị tại đây để bạn đối chiếu trực tiếp với chứng từ bên trái.
                      </div>
                    </div>
                  )}

                  {!isUploading && extractedData && (
                    <div className="extract-summary-card">
                      <div className="extract-summary-title">✓ Dữ liệu trích xuất tự động</div>
                      <div className="extract-summary-list">
                        <div className="extract-summary-item">
                          <span>Số phiếu kho:</span>
                          {extractedData.so_phieu ? (
                            <strong>{extractedData.so_phieu}</strong>
                          ) : (
                            <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                          )}
                        </div>
                        <div className="extract-summary-item">
                          <span>Ngày nhập:</span>
                          {extractedData.ngay_nhap ? (
                            <strong>{extractedData.ngay_nhap}</strong>
                          ) : (
                            <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                          )}
                        </div>
                        <div className="extract-summary-item">
                          <span>PO tham chiếu:</span>
                          {(extractedData.so_po || (extractedData.po_id ? poMap[extractedData.po_id]?.so_po : null)) ? (
                            <strong>{extractedData.so_po || poMap[extractedData.po_id]?.so_po}</strong>
                          ) : (
                            <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                          )}
                        </div>
                        <div className="extract-summary-item">
                          <span>Đơn vị lập phiếu:</span>
                          {extractedData.ten_nguoi_mua || extractedData.mst_nguoi_mua ? (
                            <strong>
                              {extractedData.ten_nguoi_mua || '—'}
                              {extractedData.mst_nguoi_mua ? ` (MST: ${extractedData.mst_nguoi_mua})` : ''}
                            </strong>
                          ) : (
                            <strong style={{ color: '#94a3b8' }}>Chưa nhận diện</strong>
                          )}
                        </div>
                        {extractedData.kiem_tra_cong_ty && extractedData.kiem_tra_cong_ty.trang_thai !== 'CHUA_NHAN_DIEN' && (
                          <div className="extract-summary-item">
                            <span>Đối chiếu Công ty mình:</span>
                            <span className={`status-pill ${extractedData.kiem_tra_cong_ty.dat ? 'success' : 'danger'}`}>
                              {extractedData.kiem_tra_cong_ty.dat ? '✓ Khớp hồ sơ công ty' : '✕ Sai thông tin công ty'}
                            </span>
                          </div>
                        )}
                        <div className="extract-summary-item">
                          <span>Số dòng trích xuất:</span>
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
                                  <th>SKU</th>
                                  <th>Nhận</th>
                                  <th>Đạt</th>
                                  <th>Từ chối</th>
                                </tr>
                              </thead>
                              <tbody>
                                {extractedData.dong.map((d, idx) => (
                                  <tr key={idx}>
                                    <td><strong className="invoice-id">{d.ma_sku}</strong></td>
                                    <td>{Number(d.so_nhan).toLocaleString('vi-VN')}</td>
                                    <td>{Number(d.so_dat).toLocaleString('vi-VN')}</td>
                                    <td>{Number(d.so_tu_choi || 0).toLocaleString('vi-VN')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                  )}
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
                  Kiểm tra & Lưu Phiếu kho →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: TẠO / XÁC NHẬN PHIẾU NHẬP KHO */}
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
                  {filePdf ? 'Kiểm tra & Lưu Phiếu nhập kho (GRN)' : 'Tạo Phiếu nhập kho (GRN) mới'}
                </h2>
                <small style={{ color: '#64748b' }}>
                  Quyền hạn: Thủ kho (THU_KHO){filePdf ? ' • Đính kèm chứng từ PDF' : ' • Nhập thủ công'}
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
            <form onSubmit={handleCreateGrn} noValidate>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-banner alert-error">{modalError}</div>
                )}
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Số phiếu nhập kho *</label>
                    <input
                      className={formErrors.soPhieu ? 'input-error' : ''}
                      value={soPhieu}
                      onChange={(e) => {
                        setSoPhieu(e.target.value)
                        clearError('soPhieu')
                      }}
                      placeholder="VD: GRN-002"
                    />
                    {formErrors.soPhieu && <span className="field-error">{formErrors.soPhieu}</span>}
                  </div>
                  <div className="form-group">
                    <label>Ngày nhập kho *</label>
                    <input
                      type="date"
                      className={formErrors.ngayNhap ? 'input-error' : ''}
                      value={ngayNhap}
                      onChange={(e) => {
                        setNgayNhap(e.target.value)
                        clearError('ngayNhap')
                      }}
                    />
                    {formErrors.ngayNhap && <span className="field-error">{formErrors.ngayNhap}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label>Chọn PO Hàng hóa tham chiếu *</label>
                  <select
                    className={formErrors.poId ? 'input-error' : ''}
                    value={poId}
                    onChange={(e) => {
                      handleSelectPo(e.target.value)
                      clearError('poId')
                      clearError('dongKho')
                    }}
                  >
                    {pos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.so_po} — {p.ten_ncc} ({p.trang_thai})
                      </option>
                    ))}
                  </select>
                  {formErrors.poId && <span className="field-error">{formErrors.poId}</span>}
                </div>

                {(() => {
                  const liveGrnCompanyCheck = verifyCompanyBuyer(tenDonVi, mstDonVi, companyInfo)
                  const hasGrnCompanyInput = Boolean((tenDonVi || '').trim() || (mstDonVi || '').trim())
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div className="form-row-2">
                        <div className="form-group">
                          <label>Đơn vị lập phiếu (Công ty mình)</label>
                          <input
                            value={tenDonVi}
                            onChange={(e) => setTenDonVi(e.target.value)}
                            placeholder={companyInfo.ten_cong_ty}
                          />
                        </div>
                        <div className="form-group">
                          <label>MST đơn vị lập phiếu</label>
                          <input
                            className={formErrors.mstDonVi ? 'input-error' : ''}
                            value={mstDonVi}
                            onChange={(e) => {
                              setMstDonVi(e.target.value)
                              clearError('mstDonVi')
                            }}
                            placeholder={companyInfo.mst}
                          />
                          {formErrors.mstDonVi && <span className="field-error">{formErrors.mstDonVi}</span>}
                        </div>
                      </div>
                      {hasGrnCompanyInput && liveGrnCompanyCheck.trang_thai === 'KHONG_KHOP' && (
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
                          <strong>⚠ {liveGrnCompanyCheck.thong_bao}</strong> — Hồ sơ hiện tại:{' '}
                          <strong>{companyInfo.ten_cong_ty}</strong> (MST: <strong>{companyInfo.mst}</strong>).
                        </div>
                      )}
                    </div>
                  )
                })()}
                {formErrors.dongKho && <span className="field-error" style={{ marginBottom: 8 }}>{formErrors.dongKho}</span>}

                {dongKho.map((d, idx) => (
                  <div key={d.dong_po_id} className="grn-line-card">
                    <div className="grn-line-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <strong style={{ fontSize: 14, color: '#0f172a' }}>{d.ten_san_pham || d.ma_sku}</strong>
                        <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Mã SKU: {d.ma_sku}</span>
                      </div>
                      <span>Số lượng đặt trên PO: <b>{d.so_luong_dat}</b></span>
                    </div>
                    <div className="form-row-3">
                      <div className="form-group">
                        <label>Số thực nhận</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={formErrors[`dong_${idx}_so_nhan`] ? 'input-error' : ''}
                          value={d.so_nhan}
                          onChange={(e) => updateLine(idx, 'so_nhan', e.target.value)}
                        />
                        {formErrors[`dong_${idx}_so_nhan`] && (
                          <span className="field-error">{formErrors[`dong_${idx}_so_nhan`]}</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Số lượng đạt *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={formErrors[`dong_${idx}_so_dat`] ? 'input-error' : ''}
                          value={d.so_dat}
                          onChange={(e) => updateLine(idx, 'so_dat', e.target.value)}
                        />
                        {formErrors[`dong_${idx}_so_dat`] && (
                          <span className="field-error">{formErrors[`dong_${idx}_so_dat`]}</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Số từ chối</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={formErrors[`dong_${idx}_so_tu_choi`] ? 'input-error' : ''}
                          value={d.so_tu_choi}
                          onChange={(e) => updateLine(idx, 'so_tu_choi', e.target.value)}
                        />
                        {formErrors[`dong_${idx}_so_tu_choi`] && (
                          <span className="field-error">{formErrors[`dong_${idx}_so_tu_choi`]}</span>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Lý do chênh lệch / từ chối (nếu có)</label>
                      <input
                        value={d.ly_do}
                        onChange={(e) => updateLine(idx, 'ly_do', e.target.value)}
                        placeholder="VD: Hư hỏng bao bì khi vận chuyển"
                      />
                    </div>
                  </div>
                ))}
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
                  Xác nhận & Lưu Phiếu nhập kho vào DB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
