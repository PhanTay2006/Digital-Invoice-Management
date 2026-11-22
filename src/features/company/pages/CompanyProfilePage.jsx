import { useEffect, useState } from 'react'
import { apiFetch, DEFAULT_COMPANY_INFO } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import { canEditCompany } from '../../../constants/permissions'
import { validateMst } from '../../../utils/validation'

function LegalReadRow({ label, value, bold = false }) {
  return (
    <div className="legal-info-row">
      <span className="legal-info-label">{label}</span>
      <strong className={`legal-info-value${bold ? ' is-highlight' : ''}`}>
        {value || '—'}
      </strong>
    </div>
  )
}

export default function CompanyProfilePage() {
  const { user } = useAuth()
  const [company, setCompany] = useState({ ...DEFAULT_COMPANY_INFO })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [msg, setMsg] = useState(null)

  const canEdit = canEditCompany(user?.vai_tro)

  async function loadCompany() {
    setLoading(true)
    try {
      const cty = await apiFetch('/cong-ty')
      if (cty && cty.ten_cong_ty) {
        setCompany({ ...DEFAULT_COMPANY_INFO, ...cty })
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompany()
  }, [])

  async function handleSave(e) {
    if (e) e.preventDefault()
    if (!canEdit) return
    setMsg(null)

    const nextErrors = {}
    if ((company.ten_cong_ty || '').trim().length < 2) {
      nextErrors.ten_cong_ty = 'Tên công ty phải có ít nhất 2 ký tự'
    }
    const mstErr = validateMst(company.mst)
    if (mstErr) nextErrors.mst = mstErr
    if ((company.dia_chi || '').trim().length < 5) {
      nextErrors.dia_chi = 'Địa chỉ trụ sở phải có ít nhất 5 ký tự'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setMsg({ type: 'error', text: Object.values(nextErrors)[0] })
      return
    }

    setErrors({})
    setSaving(true)
    try {
      const updated = await apiFetch('/cong-ty', {
        method: 'PUT',
        body: JSON.stringify(company),
      })
      if (updated && updated.ten_cong_ty) {
        setCompany({ ...DEFAULT_COMPANY_INFO, ...updated })
      }
      setMsg({ type: 'success', text: 'Đã cập nhật Thông tin công ty thành công!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  function updateField(key, value) {
    setCompany((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Thông tin công ty</h1>
        </div>
        <div className="heading-actions">
          {!canEdit && (
            <span className="status-pill info">Chỉ xem — Chỉ Quản trị hệ thống có quyền cập nhật</span>
          )}
          <button className="button button-secondary" type="button" onClick={loadCompany} disabled={loading || saving}>
            ↻ Làm mới
          </button>
          {canEdit && (
            <button className="button button-primary" type="button" onClick={handleSave} disabled={loading || saving}>
              {saving ? '⏳ Đang lưu...' : '✓ Lưu hồ sơ'}
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="panel">
          <p className="muted-cell" style={{ margin: 0 }}>Đang tải hồ sơ doanh nghiệp...</p>
        </div>
      ) : canEdit ? (
        <form onSubmit={handleSave} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>1. Định danh Pháp lý &amp; Đăng ký Kinh doanh</h2>
              </div>
            </div>
            <div className="crud-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Tên doanh nghiệp chính thức *</label>
                  <input
                    className={errors.ten_cong_ty ? 'input-error' : ''}
                    value={company.ten_cong_ty || ''}
                    onChange={(e) => updateField('ten_cong_ty', e.target.value)}
                  />
                  {errors.ten_cong_ty && <span className="field-error">{errors.ten_cong_ty}</span>}
                </div>
                <div className="form-group">
                  <label>Loại hình doanh nghiệp</label>
                  <input
                    value={company.loai_hinh_dn || ''}
                    onChange={(e) => updateField('loai_hinh_dn', e.target.value)}
                    placeholder="VD: Công ty cổ phần"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Tên tiếng Anh</label>
                  <input
                    value={company.ten_tieng_anh || ''}
                    onChange={(e) => updateField('ten_tieng_anh', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Tên viết tắt</label>
                  <input
                    value={company.ten_viet_tat || ''}
                    onChange={(e) => updateField('ten_viet_tat', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Số GCN ĐKKD</label>
                  <input
                    value={company.so_giay_phep_dkkd || ''}
                    onChange={(e) => updateField('so_giay_phep_dkkd', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Ngày cấp ĐKKD</label>
                  <input
                    type="date"
                    value={company.ngay_cap_dkkd || ''}
                    onChange={(e) => updateField('ngay_cap_dkkd', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Nơi cấp ĐKKD</label>
                  <input
                    value={company.noi_cap_dkkd || ''}
                    onChange={(e) => updateField('noi_cap_dkkd', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>2. Thông tin Thuế &amp; Trụ sở chính</h2>
              </div>
            </div>
            <div className="crud-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Mã số thuế (MST) *</label>
                  <input
                    className={errors.mst ? 'input-error' : ''}
                    value={company.mst || ''}
                    onChange={(e) => updateField('mst', e.target.value)}
                  />
                  {errors.mst && <span className="field-error">{errors.mst}</span>}
                </div>
                <div className="form-group">
                  <label>Mã Cơ quan Thuế quản lý</label>
                  <input
                    value={company.ma_cqt_quan_ly || ''}
                    onChange={(e) => updateField('ma_cqt_quan_ly', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Cơ quan Thuế quản lý trực tiếp</label>
                  <input
                    value={company.co_quan_thue_quan_ly || ''}
                    onChange={(e) => updateField('co_quan_thue_quan_ly', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Địa chỉ trụ sở chính *</label>
                  <input
                    className={errors.dia_chi ? 'input-error' : ''}
                    value={company.dia_chi || ''}
                    onChange={(e) => updateField('dia_chi', e.target.value)}
                  />
                  {errors.dia_chi && <span className="field-error">{errors.dia_chi}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>3. Đại diện Pháp luật, Ngân hàng &amp; Liên hệ</h2>
              </div>
            </div>
            <div className="crud-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Người đại diện theo pháp luật</label>
                  <input
                    value={company.nguoi_dai_dien || ''}
                    onChange={(e) => updateField('nguoi_dai_dien', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Chức vụ đại diện</label>
                  <input
                    value={company.chuc_vu_dai_dien || ''}
                    onChange={(e) => updateField('chuc_vu_dai_dien', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Số tài khoản ngân hàng</label>
                  <input
                    value={company.so_tai_khoan || ''}
                    onChange={(e) => updateField('so_tai_khoan', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Ngân hàng mở tài khoản</label>
                  <input
                    value={company.ngan_hang || ''}
                    onChange={(e) => updateField('ngan_hang', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Điện thoại liên hệ</label>
                  <input
                    value={company.dien_thoai || ''}
                    onChange={(e) => updateField('dien_thoai', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email kế toán</label>
                  <input
                    value={company.email || ''}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Website doanh nghiệp</label>
                  <input
                    value={company.website || ''}
                    onChange={(e) => updateField('website', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>1. Định danh Pháp lý &amp; Đăng ký Kinh doanh</h2>
              </div>
            </div>
            <div className="legal-info-grid">
              <LegalReadRow label="Tên doanh nghiệp chính thức" value={company.ten_cong_ty} bold />
              <LegalReadRow label="Loại hình doanh nghiệp" value={company.loai_hinh_dn} />
              <LegalReadRow label="Tên tiếng Anh" value={company.ten_tieng_anh} />
              <LegalReadRow label="Tên viết tắt" value={company.ten_viet_tat} />
              <LegalReadRow label="Số GCN ĐKKD" value={company.so_giay_phep_dkkd} />
              <LegalReadRow label="Ngày cấp ĐKKD" value={company.ngay_cap_dkkd} />
              <LegalReadRow label="Nơi cấp ĐKKD" value={company.noi_cap_dkkd} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>2. Thông tin Thuế &amp; Trụ sở chính</h2>
              </div>
            </div>
            <div className="legal-info-grid">
              <LegalReadRow label="Mã số thuế (MST)" value={company.mst} bold />
              <LegalReadRow label="Mã Cơ quan Thuế quản lý" value={company.ma_cqt_quan_ly} />
              <LegalReadRow label="Cơ quan Thuế quản lý trực tiếp" value={company.co_quan_thue_quan_ly} />
              <LegalReadRow label="Địa chỉ trụ sở chính" value={company.dia_chi} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>3. Đại diện Pháp luật, Ngân hàng &amp; Liên hệ</h2>
              </div>
            </div>
            <div className="legal-info-grid">
              <LegalReadRow label="Người đại diện theo pháp luật" value={company.nguoi_dai_dien} />
              <LegalReadRow label="Chức vụ đại diện" value={company.chuc_vu_dai_dien} />
              <LegalReadRow label="Số tài khoản ngân hàng" value={company.so_tai_khoan} />
              <LegalReadRow label="Ngân hàng mở tài khoản" value={company.ngan_hang} />
              <LegalReadRow label="Điện thoại liên hệ" value={company.dien_thoai} />
              <LegalReadRow label="Email kế toán" value={company.email} />
              <LegalReadRow label="Website doanh nghiệp" value={company.website} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
