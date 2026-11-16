import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'

const DEMO_ACCOUNTS = [
  { username: 'tester', role: 'Toàn quyền Kiểm thử (All-in-One)' },
  { username: 'ketoan', role: 'Kế toán AP' },
  { username: 'muahang', role: 'Mua hàng' },
  { username: 'thukho', role: 'Thủ kho' },
  { username: 'quanly', role: 'Quản lý (KTT)' },
  { username: 'admin', role: 'Quản trị HT' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [emailOrUser, setEmailOrUser] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoNotice, setInfoNotice] = useState(null)
  const [showDemoList, setShowDemoList] = useState(true)

  if (user) {
    const redirectTo = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfoNotice(null)

    const rawInput = emailOrUser.trim()
    if (!rawInput || !matKhau) {
      setError('Vui lòng nhập đầy đủ Tài khoản và Mật khẩu.')
      return
    }

    const username = rawInput.includes('@') ? rawInput.split('@')[0] : rawInput

    setLoading(true)
    try {
      await login(username, matKhau, remember)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Sai thông tin đăng nhập hoặc máy chủ chưa sẵn sàng.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelectDemo(acc) {
    setEmailOrUser(acc.username)
    setMatKhau('Matkhau@123')
    setError('')
    setInfoNotice(`Đã chọn tài khoản [${acc.role}]. Bấm "Đăng nhập" để tiếp tục.`)
  }

  return (
    <div className="single-login-page">
      <div className="single-login-card">
        <div className="single-login-header">
          <h1 className="single-login-title">Đăng nhập</h1>
          <p className="single-login-desc">Nhập thông tin để tiếp tục vào tài khoản của bạn.</p>
        </div>

        {error && (
          <div className="figma-alert-error" role="alert">
            <span>⚠️</span>
            <div>{error}</div>
          </div>
        )}

        {infoNotice && (
          <div className="figma-alert-info">
            <span>💡</span>
            <div>{infoNotice}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="figma-form" noValidate>
          <div className="figma-field">
            <label htmlFor="login-username">Tài khoản</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              placeholder="Nhập tài khoản"
              value={emailOrUser}
              onChange={(e) => setEmailOrUser(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="figma-field">
            <label htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="figma-actions-row">
            <label className="figma-checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>

            <button
              type="button"
              className="figma-link-btn"
              onClick={() => setInfoNotice('Để đặt lại mật khẩu, vui lòng liên hệ Kế toán trưởng hoặc Quản trị viên (admin).')}
            >
              Quên mật khẩu?
            </button>
          </div>

          <button
            type="submit"
            className="figma-submit-btn"
            disabled={loading}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          <div className="figma-help-row">
            <span>Gặp khó khăn khi đăng nhập?</span>
            <button
              type="button"
              className="figma-link-btn"
              onClick={() => setInfoNotice('Hỗ trợ kỹ thuật: Hotline 1900-6868 hoặc liên hệ IT qua cổng nội bộ.')}
            >
              Liên hệ hỗ trợ
            </button>
          </div>

          {/* Hộp chọn nhanh tài khoản mẫu */}
          <div className="figma-demo-box">
            <div className="figma-demo-head">
              <span>TÀI KHOẢN MẪU KIỂM THỬ:</span>
              <button
                type="button"
                className="figma-demo-toggle"
                onClick={() => setShowDemoList((v) => !v)}
              >
                {showDemoList ? 'Thu gọn' : 'Xem danh sách'}
              </button>
            </div>

            {showDemoList && (
              <div className="figma-demo-pills">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = emailOrUser === acc.username
                  return (
                    <button
                      key={acc.username}
                      type="button"
                      className={`figma-demo-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectDemo(acc)}
                      title={`Đăng nhập vai trò: ${acc.role}`}
                    >
                      <span className="chip-role">{acc.role}</span>
                      <span className="chip-user">({acc.username})</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
