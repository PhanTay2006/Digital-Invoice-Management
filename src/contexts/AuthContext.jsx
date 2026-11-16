import { createContext, useContext, useEffect, useState } from 'react'
import {
  apiFetch,
  clearStoredToken,
  createLocalToken,
  getStoredToken,
  parseJwt,
  setRoleTokens,
  setStoredToken,
} from '../services/api'

const AuthContext = createContext(null)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const ROLE_LABELS = {
  TOAN_QUYEN: 'Toàn quyền Kiểm thử (All-in-One)',
  MUA_HANG: 'Nhân viên mua hàng',
  THU_KHO: 'Thủ kho',
  KE_TOAN_AP: 'Kế toán AP',
  QUAN_LY: 'Quản lý (Kế toán trưởng)',
  QUAN_TRI: 'Quản trị hệ thống',
}

const DEFAULT_ACCOUNTS = {
  tester: { id: 6, ten_dang_nhap: 'tester', ho_ten: 'Kiểm thử Toàn quyền', vai_tro: 'TOAN_QUYEN' },
  admin: { id: 1, ten_dang_nhap: 'admin', ho_ten: 'Quản trị hệ thống', vai_tro: 'QUAN_TRI' },
  muahang: { id: 2, ten_dang_nhap: 'muahang', ho_ten: 'Nhân viên Mua hàng', vai_tro: 'MUA_HANG' },
  thukho: { id: 3, ten_dang_nhap: 'thukho', ho_ten: 'Thủ kho', vai_tro: 'THU_KHO' },
  ketoan: { id: 4, ten_dang_nhap: 'ketoan', ho_ten: 'Kế toán AP', vai_tro: 'KE_TOAN_AP' },
  quanly: { id: 5, ten_dang_nhap: 'quanly', ho_ten: 'Quản lý (Kế toán trưởng)', vai_tro: 'QUAN_LY' },
}

function userFromToken(token) {
  const payload = parseJwt(token)
  if (!payload) return null
  return {
    id: payload.id,
    ten_dang_nhap: payload.ten_dang_nhap || `user_${payload.id}`,
    ho_ten: payload.ho_ten || ROLE_LABELS[payload.vai_tro] || 'Người dùng',
    vai_tro: payload.vai_tro,
    ten_vai_tro: ROLE_LABELS[payload.vai_tro] || payload.vai_tro,
    exp: payload.exp,
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = getStoredToken()
    return token ? userFromToken(token) : null
  })

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  async function login(ten_dang_nhap, mat_khau, remember = true) {
    const username = ten_dang_nhap.trim()

    // 1. Thử đăng nhập trực tiếp vào Backend PostgreSQL
    try {
      const data = await apiFetch('/dang-nhap', {
        method: 'POST',
        body: JSON.stringify({ ten_dang_nhap: username, mat_khau }),
      })
      const basePayload = parseJwt(data.token) || {}
      const defaultAcc = DEFAULT_ACCOUNTS[username]
      const enrichedToken = createLocalToken({
        id: basePayload.id || defaultAcc?.id || 1,
        ten_dang_nhap: username,
        ho_ten: basePayload.ho_ten || defaultAcc?.ho_ten || username,
        vai_tro: basePayload.vai_tro || defaultAcc?.vai_tro || 'KE_TOAN_AP',
      })
      setStoredToken(data.token, remember)
      const parsed = userFromToken(data.token) || userFromToken(enrichedToken)
      parsed.ten_dang_nhap = username
      parsed.ho_ten = defaultAcc?.ho_ten || parsed.ho_ten
      setUser(parsed)
      return parsed
    } catch (err) {
      // 2. Nếu đăng nhập bằng "tester" nhưng container Backend chưa restart (chưa có user tester trong DB)
      // thì tự động lấy token của cả 5 vai trò trong DB (admin, muahang, thukho, ketoan, quanly) để gộp thành TOAN_QUYEN!
      if (username === 'tester' && mat_khau === 'Matkhau@123') {
        const roleMap = {}
        const accounts = [
          ['QUAN_TRI', 'admin'],
          ['MUA_HANG', 'muahang'],
          ['THU_KHO', 'thukho'],
          ['KE_TOAN_AP', 'ketoan'],
          ['QUAN_LY', 'quanly'],
        ]
        await Promise.all(
          accounts.map(async ([role, acc]) => {
            try {
              const r = await fetch(`${API_BASE}/dang-nhap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ten_dang_nhap: acc, mat_khau: 'Matkhau@123' }),
              })
              if (r.ok) {
                const j = await r.json()
                roleMap[role] = j.token
              }
            } catch {
              // ignore network error
            }
          })
        )
        setRoleTokens(roleMap)
        const localTesterToken = createLocalToken(DEFAULT_ACCOUNTS.tester)
        setStoredToken(localTesterToken, remember)
        const parsed = userFromToken(localTesterToken)
        setUser(parsed)
        return parsed
      }

      // 3. Nếu Docker Backend chưa bật (Failed to fetch), cho phép đăng nhập chế độ kiểm thử với 6 tài khoản mẫu
      if (
        (err instanceof TypeError || String(err.message).includes('Failed to fetch')) &&
        DEFAULT_ACCOUNTS[username] &&
        mat_khau === 'Matkhau@123'
      ) {
        const token = createLocalToken(DEFAULT_ACCOUNTS[username])
        setStoredToken(token, remember)
        const parsed = userFromToken(token)
        setUser(parsed)
        return parsed
      }

      throw err
    }
  }

  function logout() {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
