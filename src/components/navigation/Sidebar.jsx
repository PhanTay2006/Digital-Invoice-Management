import { NavLink } from 'react-router-dom'
import logoImg from '../../assets/logo.png'

const workflowLinks = [
  { to: '/invoices', label: 'Hóa đơn B2B', icon: '▤' },
  { to: '/purchase-orders', label: 'Đơn đặt hàng (PO)', icon: '▧' },
  { to: '/goods-receipts', label: 'Phiếu nhập kho (GRN)', icon: '▣' },
  { to: '/matching', label: 'Đối soát 3 chiều', icon: '⇄' },
  { to: '/exceptions', label: 'Tranh chấp & Ngoại lệ', icon: '⚑' },
]

const managementLinks = [
  { to: '/suppliers', label: 'Nhà cung cấp & SKU', icon: '♙' },
  { to: '/reports', label: 'Báo cáo & Thống kê', icon: '▥' },
  { to: '/users', label: 'Quản trị & Phân quyền', icon: '♧' },
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
  return (
    <aside className="sidebar">
      {/* Brand với Logo và tên B2B Invoice cân đối */}
      <div className="brand">
        <img src={logoImg} alt="B2B Logo" className="brand-logo-img" />
        <span className="brand-name">B2B Invoice</span>
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        {/* Mục Tổng quan trực tiếp - Không còn tiêu đề mờ và không còn khung vai trò */}
        <div className="nav-group" style={{ marginBottom: 18 }}>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon" aria-hidden="true">▦</span>
            <span>Tổng quan</span>
          </NavLink>
        </div>

        <LinkGroup title="NGHIỆP VỤ ĐỐI SOÁT 3 CHIỀU" links={workflowLinks} />
        <LinkGroup title="DANH MỤC & QUẢN TRỊ" links={managementLinks} />
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-version">HỆ THỐNG ĐỐI SOÁT HÓA ĐƠN B2B — v1.0</div>
      </div>
    </aside>
  )
}
