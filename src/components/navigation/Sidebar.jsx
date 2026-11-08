import { NavLink } from 'react-router-dom'

const primaryLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
]
const workflowLinks = [
  { to: '/invoices', label: 'Invoices', icon: '▤' },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: '▧' },
  { to: '/goods-receipts', label: 'Goods Receipts', icon: '▣' },
  { to: '/matching', label: 'Three-Way Matching', icon: '⇄' },
  { to: '/exceptions', label: 'Exceptions', icon: '⚑', badge: '4' },
]
const managementLinks = [
  { to: '/suppliers', label: 'Suppliers', icon: '♙' },
  { to: '/reports', label: 'Reports & Analytics', icon: '▥' },
  { to: '/users', label: 'Users & Access', icon: '♧' },
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
      <div className="brand">
        <div className="brand-mark">L</div>
        <div>
          <div className="brand-name">LedgerFlow</div>
          <div className="brand-caption">INVOICE OPERATIONS</div>
        </div>
      </div>

      <div className="workspace-switcher">
        <div className="workspace-avatar">AC</div>
        <div className="workspace-copy">
          <strong>Acme Corporation</strong>
          <span>Workspace</span>
        </div>
        <span className="switcher-chevron">⌄</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <LinkGroup title="OVERVIEW" links={primaryLinks} />
        <LinkGroup title="WORKFLOW" links={workflowLinks} />
        <LinkGroup title="MANAGEMENT" links={managementLinks} />
      </nav>

      <div className="sidebar-bottom">
        <div className="help-card">
          <div className="help-icon">?</div>
          <div>
            <strong>Need help?</strong>
            <span>Visit our help center</span>
          </div>
        </div>
        <div className="sidebar-version">VERSION 0.1.0</div>
      </div>
    </aside>
  )
}
