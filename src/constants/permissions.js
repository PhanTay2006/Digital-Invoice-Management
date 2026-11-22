export const ROUTE_PERMISSIONS = {
  '/dashboard': ['KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI'],
  '/invoices': ['KE_TOAN_AP', 'QUAN_LY'],
  '/purchase-orders': ['MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY'],
  '/goods-receipts': ['MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY'],
  '/matching': ['KE_TOAN_AP', 'QUAN_LY'],
  '/exceptions': ['KE_TOAN_AP', 'QUAN_LY'],
  '/suppliers': ['MUA_HANG', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI'],
  '/reports': ['KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI'],
  '/company': ['MUA_HANG', 'THU_KHO', 'KE_TOAN_AP', 'QUAN_LY', 'QUAN_TRI'],
  '/users': ['QUAN_TRI'],
}

export function canAccessRoute(role, path) {
  if (!role) return false
  if (role === 'TOAN_QUYEN') return true
  const allowed = ROUTE_PERMISSIONS[path]
  if (!allowed) return false
  return allowed.includes(role)
}

export function getDefaultRouteForRole(role) {
  if (role === 'MUA_HANG') return '/purchase-orders'
  if (role === 'THU_KHO') return '/goods-receipts'
  return '/dashboard'
}

export function canEditCompany(role) {
  return ['QUAN_TRI', 'TOAN_QUYEN'].includes(role)
}
