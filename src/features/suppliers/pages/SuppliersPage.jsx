import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import { validateSupplierForm, validateSkuMappingForm } from '../../../utils/validation'

export default function SuppliersPage() {
  const { user } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [skuMappings, setSkuMappings] = useState([])
  const [msg, setMsg] = useState(null)

  const [ten, setTen] = useState('')
  const [mst, setMst] = useState('')
  const [diaChi, setDiaChi] = useState('')

  const [nccId, setNccId] = useState('')
  const [maSkuNcc, setMaSkuNcc] = useState('')
  const [maSkuNoiBo, setMaSkuNoiBo] = useState('')
  const [tenSanPham, setTenSanPham] = useState('')
  const [supplierErrors, setSupplierErrors] = useState({})
  const [skuErrors, setSkuErrors] = useState({})

  const canCreateNcc = ['MUA_HANG', 'QUAN_TRI', 'TOAN_QUYEN'].includes(user?.vai_tro)
  const canMapSku = ['MUA_HANG', 'KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    try {
      const [nccList, axList] = await Promise.all([
        apiFetch('/nha-cung-cap'),
        apiFetch('/anh-xa-sku'),
      ])
      setSuppliers(nccList)
      setSkuMappings(axList)
      if (nccList.length > 0 && !nccId) {
        setNccId(String(nccList[0].id))
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAddSupplier(e) {
    e.preventDefault()
    setMsg(null)
    const check = validateSupplierForm({ ten, mst })
    if (!check.valid) {
      setSupplierErrors(check.errors)
      setMsg({ type: 'error', text: check.summary })
      return
    }
    setSupplierErrors({})
    try {
      const res = await apiFetch('/nha-cung-cap', {
        method: 'POST',
        body: JSON.stringify({ ten: ten.trim(), mst: mst.trim(), dia_chi: diaChi.trim() || null }),
      })
      setMsg({ type: 'success', text: `Đã lưu Nhà cung cấp mới (ID #${res.id}) vào bảng nha_cung_cap!` })
      setTen('')
      setMst('')
      setDiaChi('')
      setSupplierErrors({})
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleAddMapping(e) {
    e.preventDefault()
    setMsg(null)
    const check = validateSkuMappingForm({ nccId, maSkuNcc, maSkuNoiBo })
    if (!check.valid) {
      setSkuErrors(check.errors)
      setMsg({ type: 'error', text: check.summary })
      return
    }
    setSkuErrors({})
    try {
      const res = await apiFetch('/anh-xa-sku', {
        method: 'POST',
        body: JSON.stringify({
          nha_cung_cap_id: Number(nccId),
          ma_sku_ncc: maSkuNcc.trim(),
          ma_sku_noi_bo: maSkuNoiBo.trim(),
          ten_san_pham: tenSanPham.trim() || null,
        }),
      })
      setMsg({ type: 'success', text: `Đã lưu Ánh xạ SKU (ID #${res.id}) vào bảng anh_xa_sku!` })
      setMaSkuNcc('')
      setMaSkuNoiBo('')
      setTenSanPham('')
      setSkuErrors({})
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý Nhà cung cấp & Ánh xạ SKU</h1>
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

      <div className="dashboard-columns">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Danh mục Nhà cung cấp ({suppliers.length})</h2>
            </div>
          </div>
          <div className="table-wrap" style={{ marginBottom: 22 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>TÊN NHÀ CUNG CẤP</th>
                  <th>MÃ SỐ THUẾ (MST)</th>
                  <th>ĐỊA CHỈ</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td><strong>{s.ten}</strong></td>
                    <td><code>{s.mst}</code></td>
                    <td>{s.dia_chi || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel-heading">
            <div>
              <h2>Bảng Ánh xạ Mã hàng SKU ({skuMappings.length})</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>NHÀ CUNG CẤP</th>
                  <th>MÃ SKU TRÊN HÓA ĐƠN NCC</th>
                  <th>MÃ SKU NỘI BỘ (TRÊN PO)</th>
                  <th>TÊN SẢN PHẨM ĐẠI DIỆN</th>
                </tr>
              </thead>
              <tbody>
                {skuMappings.map((ax) => (
                  <tr key={ax.id}>
                    <td>#{ax.id}</td>
                    <td>{ax.ten_ncc}</td>
                    <td><strong className="invoice-id">{ax.ma_sku_ncc}</strong></td>
                    <td><span className="status-pill success">{ax.ma_sku_noi_bo}</span></td>
                    <td><strong>{ax.ten_san_pham || ax.mo_ta || `Sản phẩm ${ax.ma_sku_noi_bo}`}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Thêm Nhà cung cấp mới</h2>
            </div>
          </div>
          {canCreateNcc ? (
            <form onSubmit={handleAddSupplier} className="crud-form" style={{ marginBottom: 28 }} noValidate>
              <div className="form-group">
                <label>Tên pháp lý doanh nghiệp *</label>
                <input
                  className={supplierErrors.ten ? 'input-error' : ''}
                  value={ten}
                  onChange={(e) => {
                    setTen(e.target.value)
                    setSupplierErrors((prev) => ({ ...prev, ten: undefined }))
                  }}
                  placeholder="VD: Công ty TNHH Thiết Bị Sao Việt"
                />
                {supplierErrors.ten && <span className="field-error">{supplierErrors.ten}</span>}
              </div>
              <div className="form-group">
                <label>Mã số thuế (MST) *</label>
                <input
                  className={supplierErrors.mst ? 'input-error' : ''}
                  value={mst}
                  onChange={(e) => {
                    setMst(e.target.value)
                    setSupplierErrors((prev) => ({ ...prev, mst: undefined }))
                  }}
                  placeholder="VD: 0319876543"
                  maxLength={14}
                />
                {supplierErrors.mst && <span className="field-error">{supplierErrors.mst}</span>}
              </div>
              <div className="form-group">
                <label>Địa chỉ</label>
                <input value={diaChi} onChange={(e) => setDiaChi(e.target.value)} placeholder="Địa chỉ đăng ký kinh doanh" />
              </div>
              <button type="submit" className="button button-primary">Lưu Nhà cung cấp</button>
            </form>
          ) : (
            <div className="role-notice" style={{ marginBottom: 24 }}>
              Vai trò hiện tại ({user?.ten_vai_tro}) chỉ có quyền xem Nhà cung cấp.
            </div>
          )}

          <div className="panel-heading">
            <div>
              <h2>Thêm Ánh xạ SKU (NCC ↔ Nội bộ)</h2>
            </div>
          </div>
          {canMapSku ? (
            <form onSubmit={handleAddMapping} className="crud-form" noValidate>
              <div className="form-group">
                <label>Chọn Nhà cung cấp *</label>
                <select
                  className={skuErrors.nccId ? 'input-error' : ''}
                  value={nccId}
                  onChange={(e) => {
                    setNccId(e.target.value)
                    setSkuErrors((prev) => ({ ...prev, nccId: undefined }))
                  }}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.ten} ({s.mst})</option>
                  ))}
                </select>
                {skuErrors.nccId && <span className="field-error">{skuErrors.nccId}</span>}
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Mã SKU bên NCC *</label>
                  <input
                    className={skuErrors.maSkuNcc ? 'input-error' : ''}
                    value={maSkuNcc}
                    onChange={(e) => {
                      setMaSkuNcc(e.target.value)
                      setSkuErrors((prev) => ({ ...prev, maSkuNcc: undefined }))
                    }}
                    placeholder="VD: ABC-02"
                  />
                  {skuErrors.maSkuNcc && <span className="field-error">{skuErrors.maSkuNcc}</span>}
                </div>
                <div className="form-group">
                  <label>Mã SKU nội bộ (PO) *</label>
                  <input
                    className={skuErrors.maSkuNoiBo ? 'input-error' : ''}
                    value={maSkuNoiBo}
                    onChange={(e) => {
                      setMaSkuNoiBo(e.target.value)
                      setSkuErrors((prev) => ({ ...prev, maSkuNoiBo: undefined }))
                    }}
                    placeholder="VD: SKU-02"
                  />
                  {skuErrors.maSkuNoiBo && <span className="field-error">{skuErrors.maSkuNoiBo}</span>}
                </div>
              </div>
              <div className="form-group">
                <label>Tên sản phẩm / hàng hóa</label>
                <input value={tenSanPham} onChange={(e) => setTenSanPham(e.target.value)} placeholder="VD: Thiết bị 5G tiêu chuẩn" />
              </div>
              <button type="submit" className="button button-primary">Lưu Ánh xạ SKU</button>
            </form>
          ) : (
            <div className="role-notice">
              Vai trò hiện tại ({user?.ten_vai_tro}) chỉ có quyền xem bảng Ánh xạ SKU.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
