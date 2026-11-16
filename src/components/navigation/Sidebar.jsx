import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const primaryLinks = [
  { to: '/dashboard', label: 'Bảng điều khiển', icon: '▦' },
]
const workflowLinks = [
  { to: '/purchase-orders', label: 'Đơn đặt hàng (PO)', icon: '▧' },
  { to: '/goods-receipts', label: 'Phiếu nhập kho (GRN)', icon: '▣' },
  { to: '/invoices', label: 'Hóa đơn B2B', icon: '▤' },
  { to: '/matching', label: 'Đối soát 3 chiều', icon: '⇄' },
  { to: '/exceptions', label: 'Tranh chấp & Ngoại lệ', icon: '⚑' },
]
const managementLinks = [
  { to: '/suppliers', label: 'Nhà cung cấp & SKU', icon: '♙' },
  { to: '/reports', label: 'Báo cáo & Xuất file', icon: '▥' },
  { to: '/users', label: 'Quản trị & Audit Log', icon: '♧' },
]

function LinkGroup({ title, links }) {
  return (
    <div className="nav-group">
      <p className="nav-group-title">{title}</p>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">{link.icon}</span>
          <span>{link.label}</span>
          {link.badge && <span className="nav-badge">{link.badge}</span>}
        </NavLink>
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">ĐS</div>
        <div>
          <div className="brand-name">B2B Reconcile</div>
          <div className="brand-caption">QUẢN LÝ & ĐỐI SOÁT HÓA ĐƠN</div>
        </div>
      </div>

      <div className="workspace-switcher">
        <div className="workspace-avatar">{user?.ten_dang_nhap?.slice(0, 2).toUpperCase() || 'VN'}</div>
        <div className="workspace-copy">
          <strong>{user?.ho_ten || 'Người dùng'}</strong>
          <span>{user?.ten_vai_tro || 'Phân quyền vai trò'}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        <LinkGroup title="TỔNG QUAN" links={primaryLinks} />
        <LinkGroup title="NGHIỆP VỤ ĐỐI SOÁT 3 CHIỀU" links={workflowLinks} />
        <LinkGroup title="DANH MỤC & QUẢN TRỊ" links={managementLinks} />
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">DB</div>
          <div>
            <strong>PostgreSQL: doisoat</strong>
            <span>Audit Trail Trigger: Đang bật</span>
          </div>
        </div>
        <div className="sidebar-version">PHIÊN BẢN 1.0 — TIẾNG VIỆT</div>
      </div>
    </aside>
  )
}
