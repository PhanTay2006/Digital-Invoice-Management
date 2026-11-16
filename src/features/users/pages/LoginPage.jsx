import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'

const DEMO_ACCOUNTS = [
  { username: 'tester', role: '⭐ Toàn quyền Kiểm thử (All-in-One)', desc: 'Thao tác được TẤT CẢ mọi nghiệp vụ (PO, Kho, Hóa đơn, Đối soát, Duyệt, Admin)' },
  { username: 'ketoan', role: 'Kế toán AP', desc: 'Hóa đơn, Đối soát 3 chiều, Tranh chấp' },
  { username: 'muahang', role: 'Nhân viên mua hàng', desc: 'Tạo PO, Nhà cung cấp, Ánh xạ SKU' },
  { username: 'thukho', role: 'Thủ kho', desc: 'Lập phiếu nhập kho (GRN)' },
  { username: 'quanly', role: 'Quản lý (Kế toán trưởng)', desc: 'Duyệt ngoại lệ lệch lớn, Báo cáo' },
  { username: 'admin', role: 'Quản trị hệ thống', desc: 'Tài khoản, Cấu hình dung sai, Audit Log' },
]

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [tenDangNhap, setTenDangNhap] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) {
    const redirectTo = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!tenDangNhap.trim() || !matKhau) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }
    setLoading(true)
    try {
      await login(tenDangNhap, matKhau, remember)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Không thể kết nối máy chủ xác thực (kiểm tra Backend cổng 8000).')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(username) {
    setTenDangNhap(username)
    setMatKhau('Matkhau@123')
    setError('')
  }

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-info-panel">
          <div className="brand">
            <div className="brand-mark">ĐS</div>
            <div>
              <div className="brand-name" style={{ color: '#fff' }}>B2B Reconcile</div>
              <div className="brand-caption" style={{ color: '#c5c4ff' }}>QUẢN LÝ HÓA ĐƠN & ĐỐI SOÁT 3 CHIỀU</div>
            </div>
          </div>

          <h1>Hệ thống Quản lý Hóa đơn Điện tử & Đối soát B2B Tự động</h1>
          <p className="login-lead">
            Tự động đối chiếu 3 chiều <strong>Đơn đặt hàng (PO) – Phiếu nhập kho (GRN) – Hóa đơn GTGT</strong> với cơ chế kiểm soát dung sai, phê duyệt ngoại lệ và lưu vết kiểm toán bất biến ở tầng CSDL.
          </p>

          <div className="security-badges">
            <div className="sec-badge">
              <span>🔒</span>
              <div>
                <strong>Băm mật khẩu Bcrypt + Salt (NF-08)</strong>
                <small>Không lưu mật khẩu dạng rõ trong PostgreSQL</small>
              </div>
            </div>
            <div className="sec-badge">
              <span>🛡️</span>
              <div>
                <strong>Xác thực JWT có thời hạn & RBAC (NF-09, NF-10)</strong>
                <small>Kiểm tra phân quyền 5 vai trò trực tiếp tại máy chủ API</small>
              </div>
            </div>
            <div className="sec-badge">
              <span>📋</span>
              <div>
                <strong>Audit Trail Trigger cấp CSDL (NF-12)</strong>
                <small>Mọi thao tác tài chính được ghi nhật ký bất biến</small>
              </div>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-header">
            <p className="eyebrow">XÁC THỰC HỆ THỐNG (UC01)</p>
            <h2>Đăng nhập tài khoản nội bộ</h2>
            <p>Nhập thông tin định danh theo vai trò được phân quyền</p>
          </div>

          {error && (
            <div className="alert-error" role="alert">
              <strong>⚠️ Lỗi xác thực:</strong> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            <div className="form-group">
              <label htmlFor="ten_dang_nhap">Tên đăng nhập</label>
              <input
                id="ten_dang_nhap"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Ví dụ: ketoan, muahang, thukho, quanly, admin"
                value={tenDangNhap}
                onChange={(e) => setTenDangNhap(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="mat_khau">Mật khẩu</label>
              <div className="password-input-wrap">
                <input
                  id="mat_khau"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu bảo mật"
                  value={matKhau}
                  onChange={(e) => setMatKhau(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="toggle-pw-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Duy trì phiên làm việc (JWT 8 giờ)</span>
              </label>
            </div>

            <button type="submit" className="button button-primary login-submit-btn" disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống →'}
            </button>
          </form>

          <div className="demo-accounts-box">
            <div className="demo-box-title">
              <strong>Chọn nhanh 5 Actor mẫu (Mật khẩu: <code>Matkhau@123</code>)</strong>
            </div>
            <div className="demo-list">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  className={`demo-item ${tenDangNhap === acc.username ? 'selected' : ''}`}
                  onClick={() => fillDemo(acc.username)}
                >
                  <div>
                    <strong>{acc.username}</strong> — <span>{acc.role}</span>
                  </div>
                  <small>{acc.desc}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
