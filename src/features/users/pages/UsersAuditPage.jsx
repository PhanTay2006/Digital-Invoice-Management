import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth, ROLE_LABELS } from '../../../contexts/AuthContext'
import CurrencyInput from '../../../components/common/CurrencyInput'
import { ACTION_META, ENTITY_META, formatAuditRecord } from '../../../utils/auditFormat'
import { validateCreateUserForm, validateEditUserForm } from '../../../utils/validation'

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
  const [editingUser, setEditingUser] = useState(null)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditEntityFilter, setAuditEntityFilter] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [selectedAudit, setSelectedAudit] = useState(null)
  const [createUserErrors, setCreateUserErrors] = useState({})
  const [editUserErrors, setEditUserErrors] = useState({})
  const [editModalError, setEditModalError] = useState(null)

  const isAdmin = ['QUAN_TRI', 'TOAN_QUYEN'].includes(user?.vai_tro)

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users]
  )

  const formattedAudits = useMemo(
    () => audits.map((a) => formatAuditRecord(a, usersById)),
    [audits, usersById]
  )

  const filteredAudits = useMemo(() => {
    const q = auditSearch.trim().toLowerCase()
    return formattedAudits.filter((item) => {
      if (auditEntityFilter && item.doi_tuong !== auditEntityFilter) return false
      if (auditActionFilter && item.hanh_dong !== auditActionFilter) return false
      if (!q) return true
      const haystack = [
        item.documentCode,
        item.entityLabel,
        item.actionMeta.label,
        item.summary,
        item.actor.name,
        item.actor.username,
        `#${item.doi_tuong_id}`,
        `#${item.id}`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [formattedAudits, auditSearch, auditEntityFilter, auditActionFilter])

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
          apiFetch('/audit-log?limit=100'),
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
    const check = validateCreateUserForm({ tenDangNhap, matKhau, hoTen })
    if (!check.valid) {
      setCreateUserErrors(check.errors)
      setMsg({ type: 'error', text: check.summary })
      return
    }
    setCreateUserErrors({})
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
      setMsg({ type: 'success', text: `Đã tạo tài khoản mới #${res.id} thành công!` })
      setTenDangNhap('')
      setMatKhau('')
      setHoTen('')
      setCreateUserErrors({})
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  function handleOpenEdit(u) {
    setEditUserErrors({})
    setEditModalError(null)
    setEditingUser({
      id: u.id,
      ten_dang_nhap: u.ten_dang_nhap,
      ho_ten: u.ho_ten,
      vai_tro: u.vai_tro,
      hoat_dong: u.hoat_dong,
      mat_khau: '',
    })
  }

  async function handleUpdateUser(e) {
    e.preventDefault()
    if (!editingUser) return
    setMsg(null)
    setEditModalError(null)
    const check = validateEditUserForm({
      hoTen: editingUser.ho_ten,
      matKhau: editingUser.mat_khau,
    })
    if (!check.valid) {
      setEditUserErrors(check.errors)
      setEditModalError(check.summary)
      return
    }
    setEditUserErrors({})
    const payload = {
      ho_ten: editingUser.ho_ten.trim(),
    }
    if (editingUser.id !== user?.id) {
      payload.vai_tro = editingUser.vai_tro
      payload.hoat_dong = editingUser.hoat_dong
    }
    if (editingUser.mat_khau.trim()) {
      payload.mat_khau = editingUser.mat_khau.trim()
    }
    try {
      await apiFetch(`/nguoi-dung/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setMsg({ type: 'success', text: `Đã cập nhật tài khoản ${editingUser.ten_dang_nhap} (#${editingUser.id}) thành công!` })
      setEditingUser(null)
      setEditUserErrors({})
      setEditModalError(null)
      await loadData()
    } catch (err) {
      setEditModalError(err.message)
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleToggleActive(u) {
    setMsg(null)
    try {
      await apiFetch(`/nguoi-dung/${u.id}`, {
        method: 'PUT',
        body: JSON.stringify({ hoat_dong: !u.hoat_dong }),
      })
      setMsg({
        type: 'success',
        text: `Đã ${u.hoat_dong ? 'khóa' : 'mở khóa'} tài khoản ${u.ten_dang_nhap}!`,
      })
      setEditingUser(null)
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleDeleteUser(u) {
    if (!window.confirm(`Bạn có chắc muốn xóa tài khoản "${u.ten_dang_nhap}" (#${u.id})?`)) return
    setMsg(null)
    try {
      await apiFetch(`/nguoi-dung/${u.id}`, { method: 'DELETE' })
      setMsg({ type: 'success', text: `Đã xóa tài khoản ${u.ten_dang_nhap} (#${u.id}) thành công!` })
      setEditingUser(null)
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
          <h1>Tài khoản, Cấu hình Dung sai & Audit Log</h1>
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
                    {users.map((u) => {
                      const isSelected = editingUser?.id === u.id
                      return (
                        <tr
                          key={u.id}
                          onClick={() => handleOpenEdit(u)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? '#f0f7ff' : undefined,
                          }}
                        >
                          <td>#{u.id}</td>
                          <td><strong className="invoice-id">{u.ten_dang_nhap}</strong></td>
                          <td>{u.ho_ten}</td>
                          <td><span className="status-pill info">{ROLE_LABELS[u.vai_tro] || u.vai_tro}</span></td>
                          <td>
                            <span className={`status-pill ${u.hoat_dong ? 'success' : 'danger'}`}>
                              {u.hoat_dong ? 'Hoạt động' : 'Đã khóa'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleCreateUser} className="crud-form" noValidate>
                <h3>Tạo Tài khoản mới</h3>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Tên đăng nhập *</label>
                    <input
                      className={createUserErrors.tenDangNhap ? 'input-error' : ''}
                      value={tenDangNhap}
                      onChange={(e) => {
                        setTenDangNhap(e.target.value)
                        setCreateUserErrors((prev) => ({ ...prev, tenDangNhap: undefined }))
                      }}
                      placeholder="VD: nhanvien.ap"
                    />
                    {createUserErrors.tenDangNhap && (
                      <span className="field-error">{createUserErrors.tenDangNhap}</span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Mật khẩu (tối thiểu 8 ký tự) *</label>
                    <input
                      type="password"
                      className={createUserErrors.matKhau ? 'input-error' : ''}
                      value={matKhau}
                      onChange={(e) => {
                        setMatKhau(e.target.value)
                        setCreateUserErrors((prev) => ({ ...prev, matKhau: undefined }))
                      }}
                      placeholder="Tối thiểu 8 ký tự"
                    />
                    {createUserErrors.matKhau && (
                      <span className="field-error">{createUserErrors.matKhau}</span>
                    )}
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Họ và tên *</label>
                    <input
                      className={createUserErrors.hoTen ? 'input-error' : ''}
                      value={hoTen}
                      onChange={(e) => {
                        setHoTen(e.target.value)
                        setCreateUserErrors((prev) => ({ ...prev, hoTen: undefined }))
                      }}
                      placeholder="VD: Nguyễn Văn A"
                    />
                    {createUserErrors.hoTen && (
                      <span className="field-error">{createUserErrors.hoTen}</span>
                    )}
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
                  <h2>Cấu hình Dung sai & Ngưỡng Đối soát</h2>
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
                    <CurrencyInput
                      value={config.nguong_lech_lon_tien}
                      onChange={(val) => setConfig({ ...config, nguong_lech_lon_tien: val })}
                      placeholder="VD: 5.000.000"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Hạn mức tối đa Quản lý được duyệt ngoại lệ (₫)</label>
                    <CurrencyInput
                      value={config.han_muc_duyet}
                      onChange={(val) => setConfig({ ...config, han_muc_duyet: val })}
                      placeholder="VD: 10.000.000"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="button button-primary">Lưu Cấu hình Mới</button>
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2>
                  Nhật ký Kiểm toán Bất biến — Audit Trail ({filteredAudits.length}
                  {filteredAudits.length !== audits.length ? ` / ${audits.length}` : ''} bản ghi)
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Tìm số HĐ, PO, người thực hiện..."
                  style={{
                    padding: '6px 10px',
                    borderRadius: 0,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    minWidth: 220,
                  }}
                />
                <select
                  className="period-select"
                  value={auditEntityFilter}
                  onChange={(e) => setAuditEntityFilter(e.target.value)}
                >
                  <option value="">Tất cả đối tượng</option>
                  {Object.entries(ENTITY_META).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
                <select
                  className="period-select"
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                >
                  <option value="">Tất cả hành động</option>
                  {Object.entries(ACTION_META).map(([k, meta]) => (
                    <option key={k} value={k}>{meta.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>THỜI GIAN</th>
                    <th>NGƯỜI THỰC HIỆN</th>
                    <th>HÀNH ĐỘNG</th>
                    <th>CHỨNG TỪ / ĐỐI TƯỢNG</th>
                    <th>NỘI DUNG NGHIỆP VỤ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudits.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: 24 }} className="muted-cell">
                        Không có bản ghi kiểm toán nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredAudits.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAudit(a)}
                        style={{
                          cursor: 'pointer',
                          background: selectedAudit?.id === a.id ? '#f0f7ff' : undefined,
                        }}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{a.timeStr}</strong>
                          <span className="muted-cell" style={{ fontSize: 12 }}>
                            {a.dateStr} • #{a.id}
                          </span>
                        </td>
                        <td>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{a.actor.name}</strong>
                          <span className="muted-cell" style={{ fontSize: 12 }}>
                            {[a.actor.username ? `@${a.actor.username}` : '', a.actor.roleLabel]
                              .filter(Boolean)
                              .join(' • ') || 'Tác vụ nền'}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${a.actionMeta.tone}`}>
                            {a.actionMeta.label}
                          </span>
                        </td>
                        <td>
                          <strong style={{ display: 'block', color: '#0f172a' }}>{a.entityLabel}</strong>
                          <span className="muted-cell" style={{ fontSize: 12 }}>
                            {a.documentCode}
                            {a.doi_tuong_id && a.documentCode !== `#${a.doi_tuong_id}` ? ` • #${a.doi_tuong_id}` : ''}
                          </span>
                        </td>
                        <td style={{ maxWidth: 460, whiteSpace: 'normal', lineHeight: 1.45 }}>
                          {a.summary}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Chỉnh sửa Tài khoản: {editingUser.ten_dang_nhap}</h2>
                <small style={{ color: '#64748b' }}>ID #{editingUser.id}</small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingUser(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateUser} noValidate>
              <div className="modal-body">
                {editModalError && (
                  <div className="alert-banner alert-error">{editModalError}</div>
                )}
                <div className="form-group">
                  <label>Họ và tên *</label>
                  <input
                    className={editUserErrors.hoTen ? 'input-error' : ''}
                    value={editingUser.ho_ten}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, ho_ten: e.target.value })
                      setEditUserErrors((prev) => ({ ...prev, hoTen: undefined }))
                    }}
                  />
                  {editUserErrors.hoTen && (
                    <span className="field-error">{editUserErrors.hoTen}</span>
                  )}
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label>Vai trò *</label>
                    <select
                      value={editingUser.vai_tro}
                      disabled={editingUser.id === user?.id}
                      onChange={(e) => setEditingUser({ ...editingUser, vai_tro: e.target.value })}
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái tài khoản</label>
                    <select
                      value={editingUser.hoat_dong ? 'true' : 'false'}
                      disabled={editingUser.id === user?.id}
                      onChange={(e) => setEditingUser({ ...editingUser, hoat_dong: e.target.value === 'true' })}
                    >
                      <option value="true">Hoạt động</option>
                      <option value="false">Đã khóa</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Mật khẩu mới (để trống nếu không đổi)</label>
                  <input
                    type="password"
                    className={editUserErrors.matKhau ? 'input-error' : ''}
                    value={editingUser.mat_khau}
                    onChange={(e) => {
                      setEditingUser({ ...editingUser, mat_khau: e.target.value })
                      setEditUserErrors((prev) => ({ ...prev, matKhau: undefined }))
                    }}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                  {editUserErrors.matKhau && (
                    <span className="field-error">{editUserErrors.matKhau}</span>
                  )}
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editingUser.id !== user?.id && (
                    <>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleToggleActive(editingUser)}
                      >
                        {editingUser.hoat_dong ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ color: '#dc2626', borderColor: '#fecaca' }}
                        onClick={() => handleDeleteUser(editingUser)}
                      >
                        Xóa tài khoản
                      </button>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="button button-secondary" onClick={() => setEditingUser(null)}>
                    Hủy
                  </button>
                  <button type="submit" className="button button-primary">
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAudit && (
        <div className="modal-overlay" onClick={() => setSelectedAudit(null)}>
          <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">
                  {selectedAudit.actionMeta.label} {selectedAudit.entityLabel} — {selectedAudit.documentCode}
                </h2>
                <small style={{ color: '#64748b' }}>
                  Bản ghi bất biến #{selectedAudit.id} • {selectedAudit.fullTimeStr}
                </small>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedAudit(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: 12,
                  padding: 12,
                  borderRadius: 0,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginBottom: 16,
                }}
              >
                <div>
                  <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Người thực hiện</span>
                  <strong>{selectedAudit.actor.name}</strong>
                  {(selectedAudit.actor.username || selectedAudit.actor.roleLabel) && (
                    <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>
                      {[selectedAudit.actor.username ? `@${selectedAudit.actor.username}` : '', selectedAudit.actor.roleLabel]
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Hành động</span>
                  <span className={`status-pill ${selectedAudit.actionMeta.tone}`} style={{ marginTop: 4, display: 'inline-block' }}>
                    {selectedAudit.actionMeta.label}
                  </span>
                </div>
                <div>
                  <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Đối tượng nghiệp vụ</span>
                  <strong>{selectedAudit.entityLabel}</strong>
                </div>
                <div>
                  <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Mã bản ghi / Chứng từ</span>
                  <strong>
                    {selectedAudit.documentCode}
                    {selectedAudit.doi_tuong_id ? ` (ID #${selectedAudit.doi_tuong_id})` : ''}
                  </strong>
                </div>
              </div>

              {selectedAudit.hanh_dong === 'UPDATE' && selectedAudit.diffRows.length > 0 ? (
                <>
                  <h3 style={{ marginBottom: 8 }}>Thay đổi chi tiết</h3>
                  <div className="table-wrap" style={{ marginBottom: 14 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>TRƯỜNG THÔNG TIN</th>
                          <th>GIÁ TRỊ TRƯỚC</th>
                          <th>GIÁ TRỊ SAU</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAudit.diffRows.map((row) => (
                          <tr key={row.key}>
                            <td><strong>{row.label}</strong></td>
                            <td style={{ color: '#64748b' }}>{row.oldFormatted}</td>
                            <td>
                              <strong style={{ color: '#0f766e', background: '#f0fdfa', padding: '2px 8px', borderRadius: 0 }}>
                                {row.newFormatted}
                              </strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : selectedAudit.detailRows.length > 0 ? (
                <>
                  <h3 style={{ marginBottom: 8 }}>
                    {selectedAudit.hanh_dong === 'DELETE' ? 'Thông tin bản ghi đã xóa' : 'Thông tin nghiệp vụ ghi nhận'}
                  </h3>
                  <div className="table-wrap" style={{ marginBottom: 14 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>THÔNG TIN NGHIỆP VỤ</th>
                          <th>GIÁ TRỊ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAudit.detailRows.map((row) => (
                          <tr key={row.key}>
                            <td style={{ width: '38%' }}><strong>{row.label}</strong></td>
                            <td>{row.valueFormatted}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted-cell" style={{ marginBottom: 14 }}>{selectedAudit.summary}</p>
              )}

              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>
                  Xem dữ liệu gốc (JSON kỹ thuật)
                </summary>
                <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                  {selectedAudit.rawOld && (
                    <div>
                      <span className="muted-cell" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dữ liệu trước (du_lieu_cu):</span>
                      <pre style={{ margin: 0, padding: 10, borderRadius: 0, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, overflowX: 'auto' }}>
                        {JSON.stringify(selectedAudit.rawOld, null, 2)}
                      </pre>
                    </div>
                  )}
                  {selectedAudit.rawNew && (
                    <div>
                      <span className="muted-cell" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dữ liệu mới (du_lieu_moi):</span>
                      <pre style={{ margin: 0, padding: 10, borderRadius: 0, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, overflowX: 'auto' }}>
                        {JSON.stringify(selectedAudit.rawNew, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
            <div className="modal-footer">
              <button type="button" className="button button-primary" onClick={() => setSelectedAudit(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
