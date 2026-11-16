import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'

const pageNames = {
  dashboard: 'Tổng quan',
  invoices: 'Quản lý Hóa đơn B2B',
  'purchase-orders': 'Đơn đặt hàng (PO)',
  'goods-receipts': 'Phiếu nhập kho (GRN)',
  matching: 'Đối soát 3 chiều (3-Way Matching)',
  exceptions: 'Tranh chấp & Duyệt ngoại lệ',
  suppliers: 'Nhà cung cấp & Ánh xạ SKU',
  reports: 'Báo cáo & Kết xuất dữ liệu',
  users: 'Quản trị Hệ thống & Phân quyền',
}

export default function Topbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [unread, setUnread] = useState(0)

  const current = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard'
  const pageName = pageNames[current] || 'Tổng quan'

  useEffect(() => {
    apiFetch('/thong-bao?chua_doc=true')
      .then((list) => setUnread(Array.isArray(list) ? list.length : 0))
      .catch(() => {})
  }, [location.pathname])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Hệ thống Đối soát Hóa đơn B2B</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{pageName}</strong>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-button notification-button"
          type="button"
          title={`Thông báo chưa đọc: ${unread}`}
          onClick={() => navigate('/exceptions')}
        >
          🔔{unread > 0 && <span className="notif-count">{unread}</span>}
        </button>

        <div className="topbar-divider" />

        <div className="profile-button">
          <div className="profile-avatar">
            {user?.ten_dang_nhap?.slice(0, 2).toUpperCase() || 'ND'}
          </div>
          <div className="profile-copy">
            <strong>{user?.ho_ten || 'Người dùng'}</strong>
            <span>@{user?.ten_dang_nhap || 'user'}</span>
          </div>
        </div>

        <button
          type="button"
          className="button button-secondary"
          style={{ height: 32, padding: '0 12px' }}
          onClick={handleLogout}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  )
}
