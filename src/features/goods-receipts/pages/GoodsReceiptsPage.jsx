import { useEffect, useRef, useState } from 'react'
import { apiFetch, DEFAULT_COMPANY_INFO, verifyCompanyBuyer } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import { validateGrnForm } from '../../../utils/validation'

export default function GoodsReceiptsPage() {
  const { user } = useAuth()
  const [grns, setGrns] = useState([])
  const [pos, setPos] = useState([])
  const [selectedGrn, setSelectedGrn] = useState(null)
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

  async function viewDetail(id) {
    try {
      const detail = await apiFetch(`/phieu-kho/${id}`)
      setSelectedGrn(detail)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

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
      if (grnList.length > 0) {
        const targetId =
          selectedGrn && grnList.some((g) => g.id === selectedGrn.id)
            ? selectedGrn.id
            : grnList[0].id
        await viewDetail(targetId)
      } else {
        setSelectedGrn(null)
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

      const mappedLines = detail.dong.map((d) => {
        const match =
          extractedByLineId.get(Number(d.id)) ||
          extractedBySku.get(String(d.ma_sku || '').toUpperCase())
        return {
          dong_po_id: d.id,
          ma_sku: d.ma_sku,
          ten_san_pham: d.ten_san_pham || d.mo_ta || `Sản phẩm ${d.ma_sku}`,
          so_luong_dat: Number(d.so_luong_dat || 0),
          don_gia: Number(d.don_gia || 0),
          so_nhan: match ? match.so_nhan : d.so_luong_dat,
          so_dat: match ? match.so_dat : d.so_luong_dat,
          so_tu_choi: match ? match.so_tu_choi : 0,
          ly_do: match?.ly_do || '',
        }
      })
      setDongKho(mappedLines)
      return mappedLines
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
      return []
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

      let enrichedLines = []
      if (res.po_id) {
        enrichedLines = await handleSelectPo(res.po_id, res.dong || [])
      } else if (poId && res.dong?.length) {
        enrichedLines = await handleSelectPo(poId, res.dong)
      }

      const skuPriceMap = new Map(
        (enrichedLines || []).map((l) => [String(l.ma_sku || '').toUpperCase(), { ten_san_pham: l.ten_san_pham, don_gia: Number(l.don_gia || 0) }])
      )
      const displayLines = (res.dong || []).map((d) => {
        const info = skuPriceMap.get(String(d.ma_sku || '').toUpperCase())
        const donGia = info ? info.don_gia : Number(d.don_gia || 0)
        return {
          ...d,
          ten_san_pham: d.ten_san_pham || info?.ten_san_pham || '',
          don_gia: donGia,
          thanh_tien: Number(d.so_dat || 0) * donGia,
        }
      })

      setExtractedData({
        so_phieu: res.so_phieu || null,
        ngay_nhap: res.ngay_nhap || null,
        so_po: res.so_po || null,
        po_id: res.po_id || null,
        ten_nguoi_mua: res.ten_nguoi_mua || null,
        mst_nguoi_mua: res.mst_nguoi_mua || null,
        kiem_tra_cong_ty: res.kiem_tra_cong_ty || verifyCompanyBuyer(res.ten_nguoi_mua, res.mst_nguoi_mua, companyInfo),
        so_dong: displayLines.length,
        dong: displayLines,
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
        text: `Đã lập Phiếu nhập kho #${res.id} (Trạng thái: ${res.trang_thai === 'CONFIRMED' ? 'Đủ hàng' : 'Nhập một phần'}) thành công!`,
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
      await viewDetail(res.id)
    } catch (err) {
      setModalError(err.message)
      setMsg({ type: 'error', text: err.message })
    }
  }

  const tongFormNhan = dongKho.reduce((s, d) => s + (Number(d.so_nhan) || 0), 0)
  const tongFormDat = dongKho.reduce((s, d) => s + (Number(d.so_dat) || 0), 0)
  const tongFormTuChoi = dongKho.reduce((s, d) => s + (Number(d.so_tu_choi) || 0), 0)
  const tongFormGiaTri = dongKho.reduce((s, d) => s + (Number(d.so_dat) || 0) * (Number(d.don_gia) || 0), 0)

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

      {/* BẢNG DANH SÁCH PHIẾU NHẬP KHO */}
      <div className="panel" style={{ marginBottom: 20 }}>
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
                <th>PO THAM CHIẾU</th>
                <th>NHÀ CUNG CẤP</th>
                <th>ĐƠN VỊ NHẬP KHO</th>
                <th>SẢN PHẨM</th>
                <th>SỐ LƯỢNG</th>
                <th>TỔNG GIÁ TRỊ ĐẠT (₫)</th>
                <th>NGÀY NHẬP</th>
                <th>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {grns.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                    Chưa có phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                grns.map((g) => {
                  const isSelected = selectedGrn?.id === g.id
                  const ktCty = verifyCompanyBuyer(g.ten_don_vi, g.mst_don_vi, companyInfo)
                  const rawItems = Array.isArray(g.dong_tom_tat) && g.dong_tom_tat.length > 0
                    ? g.dong_tom_tat
                    : Array.isArray(g.dong) && g.dong.length > 0
                    ? g.dong
                    : (g.mat_hang ? g.mat_hang.split(', ').map((name) => ({ ten_san_pham: name, so_dat: null, so_nhan: null })) : [])
                  const slDat = Number(g.tong_so_dat ?? 0)
                  const tongGia = Number(g.tong_gia_tri ?? 0)
                  return (
                    <tr
                      key={g.id}
                      onClick={() => viewDetail(g.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#f0f7ff' : undefined,
                      }}
                    >
                      <td>#{g.id}</td>
                      <td>
                        <strong className="invoice-id">{g.so_phieu}</strong>
                        {g.file_pdf && (
                          <div>
                            <span className="status-pill info" style={{ fontSize: 10.5, padding: '1px 6px', marginTop: 2 }}>
                              PDF đính kèm
                            </span>
                          </div>
                        )}
                      </td>
                      <td><strong>{g.so_po}</strong></td>
                      <td>
                        <strong>{g.ten_ncc}</strong>
                        {g.mst_ncc && <small style={{ display: 'block', color: '#64748b' }}>MST: {g.mst_ncc}</small>}
                      </td>
                      <td>
                        {g.ten_don_vi || g.mst_don_vi ? (
                          <div>
                            <strong style={{ display: 'block', lineHeight: 1.35 }}>{g.ten_don_vi || '—'}</strong>
                            {g.mst_don_vi && (
                              <small style={{ display: 'block', color: '#64748b' }}>MST: {g.mst_don_vi}</small>
                            )}
                            <span
                              className={`status-pill ${ktCty.dat ? 'success' : 'danger'}`}
                              style={{ marginTop: 3, display: 'inline-block', fontSize: 10.5, padding: '1px 7px' }}
                            >
                              {ktCty.dat ? '✓ Khớp hồ sơ' : '✕ Sai thông tin'}
                            </span>
                          </div>
                        ) : (
                          <span className="muted-cell">Chưa ghi trên phiếu</span>
                        )}
                      </td>
                      <td>
                        {rawItems.length > 0 ? (
                          <div>
                            {rawItems.map((item, idx) => (
                              <div key={idx} style={{ fontWeight: 600, lineHeight: 1.5 }}>
                                {item.ten_san_pham || item.ma_sku}
                                {item.ma_sku && item.ten_san_pham && item.ten_san_pham !== item.ma_sku && (
                                  <span className="muted-cell" style={{ fontWeight: 400, fontSize: 11.5 }}> ({item.ma_sku})</span>
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
                          <span>—</span>
                        )}
                      </td>
                      <td>
                        {rawItems.length > 0 ? (
                          <div>
                            {rawItems.map((item, idx) => {
                              const itemDat = item.so_dat != null ? Number(item.so_dat) : slDat
                              const itemNhan = item.so_nhan != null ? Number(item.so_nhan) : null
                              const hasDiff = itemNhan != null && itemNhan !== itemDat
                              return (
                                <div key={idx} style={{ lineHeight: 1.5, whiteSpace: 'nowrap' }}>
                                  <strong>{itemDat.toLocaleString('vi-VN')}</strong>
                                  {hasDiff && (
                                    <span className="muted-cell" style={{ fontSize: 11.5 }}>
                                      {' '}/ nhận {itemNhan.toLocaleString('vi-VN')}
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                            {rawItems.length > 1 && (
                              <small style={{ display: 'block', color: '#475569', marginTop: 2, fontWeight: 600 }}>
                                Tổng đạt: {slDat.toLocaleString('vi-VN')}
                              </small>
                            )}
                          </div>
                        ) : (
                          <span>{slDat.toLocaleString('vi-VN')}</span>
                        )}
                      </td>
                      <td className="amount-cell">
                        {tongGia.toLocaleString('vi-VN')}
                      </td>
                      <td>{g.ngay_nhap}</td>
                      <td>
                        <span className={`status-pill ${g.trang_thai === 'CONFIRMED' ? 'success' : 'warning'}`}>
                          {g.trang_thai === 'CONFIRMED' ? 'Đủ hàng' : 'Nhập một phần'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHI TIẾT PHIẾU NHẬP KHO ĐANG CHỌN (ĐỒNG BỘ VỚI TRANG HÓA ĐƠN) */}
      {selectedGrn && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>
                Chi tiết Phiếu nhập kho: {selectedGrn.so_phieu} (#{selectedGrn.id})
              </h2>
            </div>
            <div>
              <span
                className={`status-pill ${selectedGrn.trang_thai === 'CONFIRMED' ? 'success' : 'warning'}`}
                style={{ fontSize: 13, padding: '5px 12px' }}
              >
                {selectedGrn.trang_thai === 'CONFIRMED' ? 'Đủ hàng' : 'Nhập một phần'}
              </span>
            </div>
          </div>

          {(() => {
            const kt = verifyCompanyBuyer(selectedGrn.ten_don_vi, selectedGrn.mst_don_vi, companyInfo)
            const lines = selectedGrn.dong || []
            const soMatHang = Number(selectedGrn.so_mat_hang ?? lines.length)
            const tongDatPo = lines.reduce((s, d) => s + Number(d.so_luong_dat || 0), 0)
            const tongNhan = Number(
              selectedGrn.tong_so_nhan ?? lines.reduce((s, d) => s + Number(d.so_nhan || 0), 0)
            )
            const tongDat = Number(
              selectedGrn.tong_so_dat ?? lines.reduce((s, d) => s + Number(d.so_dat || 0), 0)
            )
            const tongTuChoi = Number(
              selectedGrn.tong_so_tu_choi ?? lines.reduce((s, d) => s + Number(d.so_tu_choi || 0), 0)
            )
            const tongGiaTri = Number(
              selectedGrn.tong_gia_tri ??
                lines.reduce((s, d) => s + Number(d.so_dat || 0) * Number(d.don_gia || 0), 0)
            )

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
                      Đơn vị nhập kho
                    </span>
                    <strong>{selectedGrn.ten_don_vi || 'Chưa ghi trên phiếu'}</strong>
                    {selectedGrn.mst_don_vi && (
                      <small style={{ display: 'block', color: '#64748b' }}>
                        MST: {selectedGrn.mst_don_vi}
                      </small>
                    )}
                    {(selectedGrn.ten_don_vi || selectedGrn.mst_don_vi) && (
                      <span
                        className={`status-pill ${kt.dat ? 'success' : 'danger'}`}
                        style={{ marginTop: 4, display: 'inline-block', fontSize: 11, padding: '2px 8px' }}
                      >
                        {kt.dat ? '✓ Khớp hồ sơ công ty' : '✕ Sai thông tin công ty'}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Nhà cung cấp giao hàng
                    </span>
                    <strong>{selectedGrn.ten_ncc || '—'}</strong>
                    {selectedGrn.mst_ncc && (
                      <small style={{ display: 'block', color: '#64748b' }}>
                        MST: {selectedGrn.mst_ncc}
                      </small>
                    )}
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Đơn đặt hàng (PO) tham chiếu
                    </span>
                    <strong>{selectedGrn.so_po}</strong>
                    {selectedGrn.tong_tien_po != null && (
                      <small style={{ display: 'block', color: '#64748b' }}>
                        Giá trị PO: {Number(selectedGrn.tong_tien_po).toLocaleString('vi-VN')} ₫
                      </small>
                    )}
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Ngày nhập kho
                    </span>
                    <strong>{selectedGrn.ngay_nhap}</strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Nguồn: {selectedGrn.file_pdf ? 'Tải file chứng từ' : 'Nhập thủ công'}
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Tổng sản phẩm nhập
                    </span>
                    <strong>{soMatHang} mặt hàng</strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Đặt trên PO: {tongDatPo.toLocaleString('vi-VN')} đơn vị
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Tổng số lượng hàng hóa
                    </span>
                    <strong>
                      Đạt: {tongDat.toLocaleString('vi-VN')} / Nhận: {tongNhan.toLocaleString('vi-VN')}
                    </strong>
                    <small style={{ display: 'block', color: tongTuChoi > 0 ? '#b91c1c' : '#64748b' }}>
                      Từ chối / lỗi: {tongTuChoi.toLocaleString('vi-VN')}
                    </small>
                  </div>

                  <div>
                    <span className="muted-cell" style={{ display: 'block', marginBottom: 2 }}>
                      Tổng giá trị nhập kho (Đạt)
                    </span>
                    <strong style={{ color: '#0f172a', fontSize: 16 }}>
                      {tongGiaTri.toLocaleString('vi-VN')} ₫
                    </strong>
                    <small style={{ display: 'block', color: '#64748b' }}>
                      Tính theo SL đạt × Đơn giá PO
                    </small>
                  </div>
                </div>

                <h3>Danh sách Dòng mặt hàng trên Phiếu nhập kho</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>SẢN PHẨM / MẶT HÀNG</th>
                        <th>SL ĐẶT PO</th>
                        <th>SL THỰC NHẬN</th>
                        <th>SL ĐẠT</th>
                        <th>SL TỪ CHỐI</th>
                        <th>ĐƠN GIÁ PO (₫)</th>
                        <th>THÀNH TIỀN ĐẠT (₫)</th>
                        <th>LÝ DO / GHI CHÚ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((d, idx) => {
                        const donGia = Number(d.don_gia || 0)
                        const thanhTien =
                          d.thanh_tien != null
                            ? Number(d.thanh_tien)
                            : Number(d.so_dat || 0) * donGia
                        return (
                          <tr key={d.id || idx}>
                            <td>#{idx + 1}</td>
                            <td>
                              <strong style={{ display: 'block' }}>
                                {d.ten_san_pham || `Sản phẩm ${d.ma_sku}`}
                              </strong>
                              <span className="muted-cell" style={{ fontSize: 12 }}>
                                Mã SKU: <strong className="invoice-id">{d.ma_sku}</strong>
                              </span>
                            </td>
                            <td>{Number(d.so_luong_dat || 0).toLocaleString('vi-VN')}</td>
                            <td>{Number(d.so_nhan || 0).toLocaleString('vi-VN')}</td>
                            <td><strong>{Number(d.so_dat || 0).toLocaleString('vi-VN')}</strong></td>
                            <td style={{ color: Number(d.so_tu_choi || 0) > 0 ? '#b91c1c' : undefined }}>
                              {Number(d.so_tu_choi || 0).toLocaleString('vi-VN')}
                            </td>
                            <td className="amount-cell">{donGia.toLocaleString('vi-VN')}</td>
                            <td className="amount-cell">{thanhTien.toLocaleString('vi-VN')}</td>
                            <td>{d.ly_do || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td colSpan="2">TỔNG CỘNG ({soMatHang} sản phẩm)</td>
                        <td>{tongDatPo.toLocaleString('vi-VN')}</td>
                        <td>{tongNhan.toLocaleString('vi-VN')}</td>
                        <td>{tongDat.toLocaleString('vi-VN')}</td>
                        <td>{tongTuChoi.toLocaleString('vi-VN')}</td>
                        <td>—</td>
                        <td className="amount-cell" style={{ color: '#2563eb' }}>
                          {tongGiaTri.toLocaleString('vi-VN')} ₫
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )
          })()}
        </div>
      )}

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

                  {!isUploading && extractedData && (() => {
                    const tongSlNhan = (extractedData.dong || []).reduce((s, d) => s + Number(d.so_nhan || 0), 0)
                    const tongSlDat = (extractedData.dong || []).reduce((s, d) => s + Number(d.so_dat || 0), 0)
                    const tongGiaTriTrichXuat = (extractedData.dong || []).reduce(
                      (s, d) => s + Number(d.so_dat || 0) * Number(d.don_gia || 0),
                      0
                    )
                    return (
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
                            <span>Đơn vị nhập kho (trên phiếu):</span>
                            {extractedData.ten_nguoi_mua || extractedData.mst_nguoi_mua ? (
                              <strong>
                                {extractedData.ten_nguoi_mua || '—'}
                                {extractedData.mst_nguoi_mua ? ` (MST: ${extractedData.mst_nguoi_mua})` : ''}
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
                              <span className="status-pill danger">✕ Sai thông tin công ty</span>
                            ) : (
                              <strong style={{ color: '#94a3b8' }}>Chưa nhận diện đơn vị trên phiếu</strong>
                            )}
                          </div>
                          <div className="extract-summary-item">
                            <span>Loại sản phẩm đã nhập:</span>
                            <strong>{extractedData.so_dong} loại sản phẩm</strong>
                          </div>
                          <div className="extract-summary-item">
                            <span>Tổng số lượng:</span>
                            <strong>
                              Đạt {tongSlDat.toLocaleString('vi-VN')} / Nhận {tongSlNhan.toLocaleString('vi-VN')}
                            </strong>
                          </div>
                          {tongGiaTriTrichXuat > 0 && (
                            <div className="extract-summary-item">
                              <span>Tổng giá trị nhập đạt (theo PO):</span>
                              <strong style={{ color: '#2563eb' }}>
                                {tongGiaTriTrichXuat.toLocaleString('vi-VN')} ₫
                              </strong>
                            </div>
                          )}
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
                                    <th>Nhận</th>
                                    <th>Đạt</th>
                                    <th>Từ chối</th>
                                    <th>Thành tiền đạt (₫)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {extractedData.dong.map((d, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <strong className="invoice-id" style={{ display: 'block' }}>{d.ma_sku}</strong>
                                        {d.ten_san_pham && (
                                          <span className="muted-cell" style={{ fontSize: 12 }}>{d.ten_san_pham}</span>
                                        )}
                                      </td>
                                      <td>{Number(d.so_nhan).toLocaleString('vi-VN')}</td>
                                      <td><strong>{Number(d.so_dat).toLocaleString('vi-VN')}</strong></td>
                                      <td>{Number(d.so_tu_choi || 0).toLocaleString('vi-VN')}</td>
                                      <td className="amount-cell">
                                        {d.don_gia > 0 ? (Number(d.so_dat || 0) * Number(d.don_gia)).toLocaleString('vi-VN') : '—'}
                                      </td>
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
                            <strong>Cảnh báo sai Đơn vị nhập kho:</strong> {extractedData.kiem_tra_cong_ty.thong_bao}
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
                        {p.so_po} — {p.ten_ncc} (Giá trị PO: {Number(p.tong_tien || 0).toLocaleString('vi-VN')} ₫ • {p.trang_thai})
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
                          <label>Đơn vị nhập kho</label>
                          <input
                            value={tenDonVi}
                            onChange={(e) => setTenDonVi(e.target.value)}
                            placeholder={companyInfo.ten_cong_ty}
                          />
                        </div>
                        <div className="form-group">
                          <label>MST đơn vị nhập kho</label>
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
                      {hasGrnCompanyInput && liveGrnCompanyCheck.trang_thai === 'KHOP' && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '6px 10px',
                            borderRadius: 0,
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            fontSize: 12,
                            color: '#15803d',
                          }}
                        >
                          ✓ Khớp hồ sơ công ty: <strong>{companyInfo.ten_cong_ty}</strong> (MST: <strong>{companyInfo.mst}</strong>)
                        </div>
                      )}
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
                          <strong>{companyInfo.ten_cong_ty}</strong> (MST: <strong>{companyInfo.mst}</strong>). Khi chạy đối soát bước kiểm tra đơn vị nhập kho sẽ báo Lệch.
                        </div>
                      )}
                      {!(tenDonVi || '').trim() && (
                        <div
                          style={{
                            marginTop: 6,
                            padding: '8px 10px',
                            borderRadius: 0,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            fontSize: 12,
                            color: '#92400e',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>
                            Chưa điền <strong>Đơn vị nhập kho</strong> — chuẩn đối soát hiện tại là{' '}
                            <strong>{companyInfo.ten_cong_ty}</strong> ({companyInfo.mst}).
                          </span>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                            onClick={() => {
                              setTenDonVi(companyInfo.ten_cong_ty || '')
                              setMstDonVi(companyInfo.mst || '')
                              clearError('mstDonVi')
                            }}
                          >
                            + Điền thông tin công ty
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}
                {formErrors.dongKho && <span className="field-error" style={{ marginBottom: 8 }}>{formErrors.dongKho}</span>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 14 }}>
                    Chi tiết Mặt hàng nhập kho ({dongKho.length} sản phẩm)
                  </h3>
                </div>

                {dongKho.map((d, idx) => {
                  const donGia = Number(d.don_gia || 0)
                  const thanhTienDong = (Number(d.so_dat) || 0) * donGia
                  return (
                    <div key={d.dong_po_id} className="grn-line-card">
                      <div
                        className="grn-line-header"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 12,
                          flexWrap: 'wrap',
                          marginBottom: 10,
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{d.ten_san_pham || d.ma_sku}</strong>
                          <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>
                            Mã SKU: <strong>{d.ma_sku}</strong> • Đơn giá PO: <strong>{donGia.toLocaleString('vi-VN')} ₫</strong>
                          </span>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: 13 }}>
                          <div>
                            Số lượng đặt trên PO: <b>{Number(d.so_luong_dat || 0).toLocaleString('vi-VN')}</b>
                          </div>
                          <div style={{ color: '#2563eb', fontWeight: 700 }}>
                            Thành tiền đạt: {thanhTienDong.toLocaleString('vi-VN')} ₫
                          </div>
                        </div>
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
                  )
                })}

                {/* TỔNG HỢP SỐ LƯỢNG, TỔNG SẢN PHẨM & TỔNG GIÁ TRỊ NHẬP KHO */}
                <div
                  className="total-preview"
                  style={{
                    marginTop: 14,
                    padding: 12,
                    background: '#f8fafc',
                    borderRadius: 0,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.6, flex: 1, minWidth: 260 }}>
                    <div>
                      Loại sản phẩm đã nhập: <strong>{dongKho.length} loại</strong>
                    </div>
                    {dongKho.length > 0 && (
                      <div style={{ margin: '4px 0', paddingLeft: 10, borderLeft: '2px solid #cbd5e1' }}>
                        {dongKho.map((d, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 420, gap: 12 }}>
                            <span>{d.ten_san_pham || d.ma_sku}</span>
                            <strong>SL đạt: {(Number(d.so_dat) || 0).toLocaleString('vi-VN')}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      Tổng số lượng: Thực nhận <strong>{tongFormNhan.toLocaleString('vi-VN')}</strong> • Đạt{' '}
                      <strong style={{ color: '#15803d' }}>{tongFormDat.toLocaleString('vi-VN')}</strong> • Từ chối{' '}
                      <strong style={{ color: tongFormTuChoi > 0 ? '#b91c1c' : undefined }}>
                        {tongFormTuChoi.toLocaleString('vi-VN')}
                      </strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
                      Tổng giá trị nhập kho (tính theo SL đạt):
                    </span>
                    <strong style={{ fontSize: 18, color: '#2563eb' }}>
                      {tongFormGiaTri.toLocaleString('vi-VN')} ₫
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
