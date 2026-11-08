import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import ModulePlaceholderPage from '../components/common/ModulePlaceholderPage'

const modules = [
  { path: 'invoices', title: 'Invoices', description: 'Upload, review and manage supplier invoices.' },
  { path: 'purchase-orders', title: 'Purchase Orders', description: 'Create and track purchase orders.' },
  { path: 'goods-receipts', title: 'Goods Receipts', description: 'Record received goods and delivery details.' },
  { path: 'matching', title: 'Three-Way Matching', description: 'Compare purchase orders, goods receipts and invoices.' },
  { path: 'exceptions', title: 'Exceptions', description: 'Review and resolve mismatches that need attention.' },
  { path: 'suppliers', title: 'Suppliers', description: 'Manage supplier profiles and related documents.' },
  { path: 'reports', title: 'Reports & Analytics', description: 'Explore reconciliation performance and trends.' },
  { path: 'users', title: 'Users & Access', description: 'Manage team members and access permissions.' },
]

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        {modules.map((module) => (
          <Route
            key={module.path}
            path={module.path}
            element={<ModulePlaceholderPage title={module.title} description={module.description} />}
          />
        ))}
        <Route path="*" element={<ModulePlaceholderPage title="Page not found" description="The page you are looking for does not exist." />} />
      </Route>
    </Routes>
  )
}
