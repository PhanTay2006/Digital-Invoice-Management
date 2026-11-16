import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TRANG_THAI_MAP = {
  CHUA_DOI_SOAT: { label: 'Chưa đối soát', tone: 'info' },
  MATCHED: { label: 'Khớp (Matched)', tone: 'success' },
  PARTIAL: { label: 'Chờ đủ kho (Partial)', tone: 'warning' },
  MISMATCH: { label: 'Lệch (Mismatch)', tone: 'danger' },
  RECONCILED: { label: 'Đã đối soát (Reconciled)', tone: 'success' },
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [recentInvoices, setRecentInvoices] = useState([])
  const [pos, setPos] = useState([])

  useEffect(() => {
    apiFetch('/hoa-don?limit=6').then(setRecentInvoices).catch(() => {})
    apiFetch('/po').then(setPos).catch(() => {})
    apiFetch('/dashboard').then(setStats).catch(() => {})
  }, [])

  const theoTt = stats?.theo_trang_thai || {}
  const tongHd = Object.values(theoTt).reduce((a, b) => a + b, 0) || recentInvoices.length
  const soMatched = (theoTt.MATCHED || 0) + (theoTt.RECONCILED || 0)
  const soMismatch = theoTt.MISMATCH || 0
  const soPartial = (theoTt.PARTIAL || 0) + (theoTt.CHUA_DOI_SOAT || 0)

  const metrics = [
    { label: 'Tổng số Hóa đơn B2B', value: String(tongHd), change: 'PostgreSQL', note: 'Từ bảng hoa_don', icon: '▤', tone: 'blue' },
    { label: 'Chờ đối soát / Đủ kho', value: String(soPartial), change: 'Cần xử lý', note: 'Chưa đối soát & Partial', icon: '⇄', tone: 'violet' },
    { label: 'Đã khớp / Reconciled', value: String(soMatched), change: `${stats?.ty_le_reconciled_pct ?? 0}%`, note: 'Tỷ lệ hoàn tất đối soát', icon: '✓', tone: 'green' },
    { label: 'Hóa đơn Lệch (Mismatch)', value: String(soMismatch), change: `${stats?.tranh_chap_dang_mo ?? 0} tranh chấp`, note: `${stats?.yeu_cau_cho_duyet ?? 0} chờ duyệt ngoại lệ`, icon: '⚑', tone: 'orange' },
  ]

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">TỔNG QUAN VẬN HÀNH (F-08, F-14 / UC17, UC18)</p>
          <h1>Xin chào, {user?.ho_ten || 'Người dùng'} <span className="wave">✦</span></h1>
          <p className="page-description">
            Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong> (Tài khoản: <code>{user?.ten_dang_nhap}</code>). Số liệu bên dưới được truy vấn trực tiếp từ PostgreSQL.
          </p>
        </div>
        <div className="heading-actions">
          <Link className="button button-secondary" to="/reports" style={{ display: 'inline-flex', alignItems: 'center' }}>↓ Xuất báo cáo</Link>
          <Link className="button button-primary" to="/invoices" style={{ display: 'inline-flex', alignItems: 'center' }}><span>＋</span> Nhập / Upload Hóa đơn</Link>
        </div>
      </div>

      <div className="date-banner">
        <div className="date-banner-icon">◷</div>
        <div>
          <strong>Kết nối Cơ sở dữ liệu PostgreSQL (Database: doisoat)</strong>
          <span>Tổng số Đơn đặt hàng (PO) hiện có: <b>{pos.length}</b> | Tổng số Hóa đơn: <b>{tongHd}</b></span>
        </div>
        <span className="live-indicator"><i /> ĐỒNG BỘ THỜI GIAN THỰC</span>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span className={`metric-icon ${metric.tone}`}>{metric.icon}</span>
            </div>
            <p className="metric-label">{metric.label}</p>
            <div className="metric-value-row">
              <strong>{metric.value}</strong>
              <span className={`metric-change ${metric.tone}`}>{metric.change}</span>
            </div>
            <p className="metric-note">{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Hóa đơn B2B gần nhất trong Database</h2>
              <p>Dữ liệu thời gian thực từ bảng <code>hoa_don</code></p>
            </div>
            <Link to="/invoices">Xem tất cả <span>→</span></Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SỐ HÓA ĐƠN</th>
                  <th>ĐƠN HÀNG (PO)</th>
                  <th>NGÀY LẬP</th>
                  <th>TỔNG THANH TOÁN (₫)</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => {
                  const st = TRANG_THAI_MAP[inv.trang_thai] || { label: inv.trang_thai, tone: 'info' }
                  return (
                    <tr key={inv.id}>
                      <td><strong className="invoice-id">{inv.so_hoa_don}</strong></td>
                      <td>PO #{inv.po_id}</td>
                      <td className="muted-cell">{inv.ngay_lap}</td>
                      <td className="amount-cell">{Number(inv.tong_thanh_toan).toLocaleString('vi-VN')} ₫</td>
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
        </section>

        <section className="panel matching-panel">
          <div className="panel-heading">
            <div>
              <h2>Tình trạng Đối soát 3 Chiều</h2>
              <p>Tỷ lệ khớp tự động & xử lý ngoại lệ</p>
            </div>
          </div>
          <div className="matching-score">
            <div className="score-ring">
              <div>
                <strong>{stats?.ty_le_reconciled_pct ?? 0}%</strong>
                <span>Đã Reconciled</span>
              </div>
            </div>
          </div>
          <div className="match-legend">
            <div><span className="legend-dot matched-dot" /><span>Đã khớp / Reconciled</span><strong>{soMatched}</strong></div>
            <div><span className="legend-dot pending-dot" /><span>Chưa đối soát / Partial</span><strong>{soPartial}</strong></div>
            <div><span className="legend-dot exception-dot" /><span>Lệch (Mismatch)</span><strong>{soMismatch}</strong></div>
          </div>
          <Link className="panel-link" to="/matching">Mở Trung tâm Đối soát 3 chiều <span>→</span></Link>
        </section>
      </div>
    </section>
  )
}
