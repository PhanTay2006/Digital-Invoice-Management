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
          <span>© 2026 LedgerFlow</span>
          <span>Digital Invoice Management</span>
        </footer>
      </div>
    </div>
  )
}
