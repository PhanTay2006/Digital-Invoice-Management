import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import PurchaseOrdersPage from '../features/purchase-orders/pages/PurchaseOrdersPage'
import GoodsReceiptsPage from '../features/goods-receipts/pages/GoodsReceiptsPage'
import InvoicesPage from '../features/invoices/pages/InvoicesPage'
import MatchingPage from '../features/matching/pages/MatchingPage'
import ExceptionsPage from '../features/exceptions/pages/ExceptionsPage'
import SuppliersPage from '../features/suppliers/pages/SuppliersPage'
import ReportsPage from '../features/reports/pages/ReportsPage'
import UsersAuditPage from '../features/users/pages/UsersAuditPage'
import CompanyProfilePage from '../features/company/pages/CompanyProfilePage'
import LoginPage from '../features/users/pages/LoginPage'
import { useAuth } from '../contexts/AuthContext'
import { canAccessRoute, getDefaultRouteForRole } from '../constants/permissions'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function RequireRole({ path, children }) {
  const { user } = useAuth()
  if (!canAccessRoute(user?.vai_tro, path)) {
    const home = getDefaultRouteForRole(user?.vai_tro)
    return (
      <section className="module-page">
        <div className="page-heading">
          <div>
            <h1>Không có quyền truy cập</h1>
          </div>
        </div>
        <div className="panel">
          <p style={{ marginBottom: 14, color: '#334155', fontSize: 13.5 }}>
            Vai trò hiện tại của bạn (<strong>{user?.ten_vai_tro || user?.vai_tro}</strong>) không được phép truy cập phân hệ này.
          </p>
          <Link to={home} className="button button-primary">
            Quay về trang được cấp quyền
          </Link>
        </div>
      </section>
    )
  }
  return children
}

function RoleDefaultRedirect() {
  const { user } = useAuth()
  return <Navigate to={getDefaultRouteForRole(user?.vai_tro)} replace />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RoleDefaultRedirect />} />
        <Route path="dashboard" element={<RequireRole path="/dashboard"><DashboardPage /></RequireRole>} />
        <Route path="purchase-orders" element={<RequireRole path="/purchase-orders"><PurchaseOrdersPage /></RequireRole>} />
        <Route path="goods-receipts" element={<RequireRole path="/goods-receipts"><GoodsReceiptsPage /></RequireRole>} />
        <Route path="invoices" element={<RequireRole path="/invoices"><InvoicesPage /></RequireRole>} />
        <Route path="matching" element={<RequireRole path="/matching"><MatchingPage /></RequireRole>} />
        <Route path="exceptions" element={<RequireRole path="/exceptions"><ExceptionsPage /></RequireRole>} />
        <Route path="suppliers" element={<RequireRole path="/suppliers"><SuppliersPage /></RequireRole>} />
        <Route path="reports" element={<RequireRole path="/reports"><ReportsPage /></RequireRole>} />
        <Route path="company" element={<RequireRole path="/company"><CompanyProfilePage /></RequireRole>} />
        <Route path="users" element={<RequireRole path="/users"><UsersAuditPage /></RequireRole>} />
        <Route path="*" element={<RoleDefaultRedirect />} />
      </Route>
    </Routes>
  )
}
