import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth, ROLE_LABELS } from '../../../contexts/AuthContext'

export default function UsersAuditPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [audits, setAudits] = useState([])
  const [config, setConfig] = useState({
    dung_sai_don_gia_pct: 2,
    nguong_lech_lon_pct: 5,
    nguong_lech_lon_tien: 5000000,
    han_muc_duyet: 10000000,
  })
  const [msg, setMsg] = useState(null)

  const [tenDangNhap, setTenDangNhap] = useState('')
  const [matKhau, setMatKhau] = useState('')
  const [hoTen, setHoTen] = useState('')
  const [vaiTro, setVaiTro] = useState('MUA_HANG')

  const isAdmin = ['QUAN_TRI', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    try {
      const cfg = await apiFetch('/cau-hinh/hien-hanh').catch(() => null)
      if (cfg && cfg.id) {
        setConfig({
          dung_sai_don_gia_pct: cfg.dung_sai_don_gia_pct,
          nguong_lech_lon_pct: cfg.nguong_lech_lon_pct,
          nguong_lech_lon_tien: cfg.nguong_lech_lon_tien,
          han_muc_duyet: cfg.han_muc_duyet,
        })
      }
      if (isAdmin) {
        const [uList, aList] = await Promise.all([
          apiFetch('/nguoi-dung'),
          apiFetch('/audit-log?limit=50'),
        ])
        setUsers(uList)
        setAudits(aList)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [isAdmin])

  async function handleCreateUser(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch('/nguoi-dung', {
        method: 'POST',
        body: JSON.stringify({
          ten_dang_nhap: tenDangNhap.trim(),
          mat_khau: matKhau,
          ho_ten: hoTen.trim(),
          vai_tro: vaiTro,
        }),
      })
      setMsg({ type: 'success', text: `Đã tạo tài khoản mới #${res.id} (Mật khẩu đã băm Bcrypt + Salt theo NF-08)!` })
      setTenDangNhap('')
      setMatKhau('')
      setHoTen('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch('/cau-hinh', {
        method: 'POST',
        body: JSON.stringify({
          dung_sai_don_gia_pct: Number(config.dung_sai_don_gia_pct),
          nguong_lech_lon_pct: Number(config.nguong_lech_lon_pct),
          nguong_lech_lon_tien: Number(config.nguong_lech_lon_tien),
          han_muc_duyet: Number(config.han_muc_duyet),
        }),
      })
      setMsg({ type: 'success', text: `Đã lưu phiên bản cấu hình dung sai mới #${res.id} vào bảng cau_hinh_doi_soat!` })
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN TRỊ HỆ THỐNG & KIỂM TOÁN (F-12, F-13, F-17)</p>
          <h1>Tài khoản, Cấu hình Dung sai & Audit Log</h1>
          <p className="page-description">
            Quản lý phân quyền 5 vai trò, thiết lập tham số dung sai và tra cứu nhật ký kiểm toán bất biến (Trigger <code>fn_ghi_audit_log</code>).
          </p>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={loadData}>↻ Làm mới</button>
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {!isAdmin ? (
        <div className="role-notice">
          Chức năng Quản trị Tài khoản, Cấu hình Dung sai và Xem Audit Log chỉ dành cho vai trò <strong>Quản trị hệ thống (QUAN_TRI)</strong>. Hãy đăng nhập bằng tài khoản <code>admin</code>.
        </div>
      ) : (
        <>
          <div className="dashboard-columns" style={{ marginBottom: 20 }}>
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Danh sách Tài khoản Người dùng ({users.length})</h2>
                  <p>Bảng <code>nguoi_dung</code> trong PostgreSQL</p>
                </div>
              </div>
              <div className="table-wrap" style={{ marginBottom: 18 }}>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>TÊN ĐĂNG NHẬP</th>
                      <th>HỌ TÊN</th>
                      <th>VAI TRÒ</th>
                      <th>TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>#{u.id}</td>
                        <td><strong>{u.ten_dang_nhap}</strong></td>
                        <td>{u.ho_ten}</td>
                        <td><span className="status-pill info">{ROLE_LABELS[u.vai_tro] || u.vai_tro}</span></td>
                        <td>
                          <span className={`status-pill ${u.hoat_dong ? 'success' : 'danger'}`}>
                            {u.hoat_dong ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleCreateUser} className="crud-form">
                <h3>Tạo Tài khoản mới (UC02)</h3>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Tên đăng nhập *</label>
                    <input value={tenDangNhap} onChange={(e) => setTenDangNhap(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu (tối thiểu 8 ký tự) *</label>
                    <input type="password" minLength={8} value={matKhau} onChange={(e) => setMatKhau(e.target.value)} required />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Họ và tên *</label>
                    <input value={hoTen} onChange={(e) => setHoTen(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Vai trò *</label>
                    <select value={vaiTro} onChange={(e) => setVaiTro(e.target.value)}>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="button button-primary">Tạo tài khoản</button>
              </form>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Cấu hình Dung sai & Ngưỡng Đối soát (F-17 / UC11)</h2>
                  <p>Bảng <code>cau_hinh_doi_soat</code> (Lưu lịch sử phiên bản, không ghi đè hóa đơn cũ)</p>
                </div>
              </div>
              <form onSubmit={handleSaveConfig} className="crud-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Dung sai đơn giá cho phép (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={config.dung_sai_don_gia_pct}
                      onChange={(e) => setConfig({ ...config, dung_sai_don_gia_pct: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Ngưỡng đánh dấu lệch lớn (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={config.nguong_lech_lon_pct}
                      onChange={(e) => setConfig({ ...config, nguong_lech_lon_pct: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Ngưỡng đánh dấu lệch lớn (Số tiền ₫)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.nguong_lech_lon_tien}
                      onChange={(e) => setConfig({ ...config, nguong_lech_lon_tien: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hạn mức tối đa Quản lý được duyệt ngoại lệ (₫)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.han_muc_duyet}
                      onChange={(e) => setConfig({ ...config, han_muc_duyet: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="button button-primary">Lưu Cấu hình Mới</button>
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Nhật ký Kiểm toán Bất biến — Audit Trail ({audits.length} bản ghi gần nhất)</h2>
                <p>Bảng <code>audit_log</code> được tự động ghi bởi Trigger CSDL mỗi khi bạn tạo/sửa PO, GRN, Hóa đơn, Đối soát...</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>THỜI GIAN</th>
                    <th>USER ID</th>
                    <th>HÀNH ĐỘNG</th>
                    <th>BẢNG DỮ LIỆU (ĐỐI TƯỢNG)</th>
                    <th>ID BẢN GHI</th>
                    <th>DỮ LIỆU MỚI (JSONB)</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td>{new Date(a.thoi_gian).toLocaleString('vi-VN')}</td>
                      <td>{a.nguoi_dung_id ? `User #${a.nguoi_dung_id}` : 'Hệ thống'}</td>
                      <td><span className="status-pill info">{a.hanh_dong}</span></td>
                      <td><code>{a.doi_tuong}</code></td>
                      <td>#{a.doi_tuong_id}</td>
                      <td style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <code>{JSON.stringify(a.du_lieu_moi)}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
