import { Outlet } from 'react-router-dom'
import Sidebar from '../components/navigation/Sidebar'
import Topbar from '../components/navigation/Topbar'

export default function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-panel">
        <Topbar />
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>© 2026 Hệ thống Quản lý Hóa đơn Điện tử & Đối soát B2B Tự động</span>
          <span>CSDL: PostgreSQL 16 (ACID & Audit Trail Trigger)</span>
        </footer>
      </div>
    </div>
  )
}
