import { useState } from 'react'
import { getStoredToken } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export default function ReportsPage() {
  const { user } = useAuth()
  const canExport = ['KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI', 'TOAN_QUYEN'].includes(user?.vai_tro)
  const [trangThai, setTrangThai] = useState('')
  const [tuNgay, setTuNgay] = useState('')
  const [denNgay, setDenNgay] = useState('')
  const [msg, setMsg] = useState(null)

  if (!canExport) {
    return (
      <section className="module-page">
        <div className="page-heading">
          <div>
            <h1>Báo cáo Đối soát & Xuất File (Excel / CSV)</h1>
          </div>
        </div>
        <div className="role-notice">
          Chức năng Báo cáo &amp; Kết xuất dữ liệu chỉ dành cho <strong>Kế toán AP</strong>, <strong>Quản lý (Kế toán trưởng)</strong> và <strong>Quản trị hệ thống</strong>.
        </div>
      </section>
    )
  }

  async function downloadReport(ext) {
    setMsg(null)
    const params = new URLSearchParams()
    if (trangThai) params.set('trang_thai', trangThai)
    if (tuNgay) params.set('tu_ngay', tuNgay)
    if (denNgay) params.set('den_ngay', denNgay)
    const qs = params.toString() ? `?${params.toString()}` : ''

    try {
      const res = await fetch(`${API_BASE}/bao-cao/hoa-don.${ext}${qs}`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      })
      if (!res.ok) throw new Error(`Không thể xuất báo cáo (HTTP ${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bao-cao-hoa-don.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      setMsg({ type: 'success', text: `Đã tải xuống báo cáo định dạng .${ext.toUpperCase()} chuẩn tiếng Việt!` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Báo cáo Đối soát & Xuất File (Excel / CSV)</h1>
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      <div className="panel" style={{ maxWidth: 680 }}>
        <div className="panel-heading">
          <div>
            <h2>Bộ lọc Báo cáo Hóa đơn B2B</h2>
          </div>
        </div>
        <div className="crud-form">
          <div className="form-group">
            <label>Trạng thái đối soát</label>
            <select value={trangThai} onChange={(e) => setTrangThai(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="CHUA_DOI_SOAT">Chưa đối soát</option>
              <option value="MATCHED">Khớp</option>
              <option value="PARTIAL">Khớp một phần</option>
              <option value="MISMATCH">Lệch</option>
              <option value="RECONCILED">Đã đối soát</option>
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Từ ngày</label>
              <input type="date" value={tuNgay} onChange={(e) => setTuNgay(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Đến ngày</label>
              <input type="date" value={denNgay} onChange={(e) => setDenNgay(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="button button-primary" onClick={() => downloadReport('xlsx')}>
              ↓ Xuất file Excel (.xlsx)
            </button>
            <button type="button" className="button button-secondary" onClick={() => downloadReport('csv')}>
              ↓ Xuất file CSV (.csv UTF-8 BOM)
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
