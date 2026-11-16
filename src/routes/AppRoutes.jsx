import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import LoginPage from '../features/users/pages/LoginPage'
import { useAuth } from '../contexts/AuthContext'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
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
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="goods-receipts" element={<GoodsReceiptsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="matching" element={<MatchingPage />} />
        <Route path="exceptions" element={<ExceptionsPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="users" element={<UsersAuditPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
