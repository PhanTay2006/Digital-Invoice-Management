import { useLocation } from 'react-router-dom'

const pageNames = {
  dashboard: 'Dashboard',
  invoices: 'Invoices',
  'purchase-orders': 'Purchase Orders',
  'goods-receipts': 'Goods Receipts',
  matching: 'Three-Way Matching',
  exceptions: 'Exceptions',
  suppliers: 'Suppliers',
  reports: 'Reports & Analytics',
  users: 'Users & Access',
}

export default function Topbar() {
  const location = useLocation()
  const current = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard'
  const pageName = pageNames[current] || 'Dashboard'

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Workspace</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{pageName}</strong>
      </div>
      <div className="topbar-actions">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search anything..." aria-label="Search" />
          <kbd>⌘ K</kbd>
        </label>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          ♧<i />
        </button>
        <div className="topbar-divider" />
        <button className="profile-button" type="button">
          <div className="profile-avatar">PT</div>
          <div className="profile-copy">
            <strong>Phan Van Tay</strong>
            <span>Administrator</span>
          </div>
          <span className="profile-chevron">⌄</span>
        </button>
      </div>
    </header>
  )
}
