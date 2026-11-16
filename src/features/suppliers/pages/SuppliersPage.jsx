import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

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
    try {
      const res = await apiFetch('/nha-cung-cap', {
        method: 'POST',
        body: JSON.stringify({ ten: ten.trim(), mst: mst.trim(), dia_chi: diaChi.trim() || null }),
      })
      setMsg({ type: 'success', text: `Đã lưu Nhà cung cấp mới (ID #${res.id}) vào bảng nha_cung_cap!` })
      setTen('')
      setMst('')
      setDiaChi('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleAddMapping(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch('/anh-xa-sku', {
        method: 'POST',
        body: JSON.stringify({
          nha_cung_cap_id: Number(nccId),
          ma_sku_ncc: maSkuNcc.trim(),
          ma_sku_noi_bo: maSkuNoiBo.trim(),
        }),
      })
      setMsg({ type: 'success', text: `Đã lưu Ánh xạ SKU (ID #${res.id}) vào bảng anh_xa_sku!` })
      setMaSkuNcc('')
      setMaSkuNoiBo('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DANH MỤC ĐỐI TÁC & HÀNG HÓA</p>
          <h1>Quản lý Nhà cung cấp & Ánh xạ SKU</h1>
          <p className="page-description">
            Quản lý bảng <code>nha_cung_cap</code> và bảng ánh xạ mã hàng <code>anh_xa_sku</code> (Mã SKU Nhà cung cấp ↔ Mã SKU Nội bộ trên PO).
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

      <div className="dashboard-columns">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Danh mục Nhà cung cấp ({suppliers.length})</h2>
              <p>Bảng <code>nha_cung_cap</code> trong PostgreSQL</p>
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
              <p>Bảng <code>anh_xa_sku</code> dùng để đối chiếu dòng hóa đơn với dòng PO</p>
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
                </tr>
              </thead>
              <tbody>
                {skuMappings.map((ax) => (
                  <tr key={ax.id}>
                    <td>#{ax.id}</td>
                    <td>{ax.ten_ncc}</td>
                    <td><strong className="invoice-id">{ax.ma_sku_ncc}</strong></td>
                    <td><span className="status-pill success">{ax.ma_sku_noi_bo}</span></td>
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
              <p>Quyền hạn: Nhân viên mua hàng hoặc Quản trị hệ thống</p>
            </div>
          </div>
          {canCreateNcc ? (
            <form onSubmit={handleAddSupplier} className="crud-form" style={{ marginBottom: 28 }}>
              <div className="form-group">
                <label>Tên pháp lý doanh nghiệp *</label>
                <input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: Công ty TNHH Thiết Bị Sao Việt" required />
              </div>
              <div className="form-group">
                <label>Mã số thuế (MST) *</label>
                <input value={mst} onChange={(e) => setMst(e.target.value)} placeholder="VD: 0319876543" maxLength={14} required />
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
              <p>Quyền hạn: Nhân viên mua hàng hoặc Kế toán AP</p>
            </div>
          </div>
          {canMapSku ? (
            <form onSubmit={handleAddMapping} className="crud-form">
              <div className="form-group">
                <label>Chọn Nhà cung cấp *</label>
                <select value={nccId} onChange={(e) => setNccId(e.target.value)} required>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.ten} ({s.mst})</option>
                  ))}
                </select>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Mã SKU bên NCC *</label>
                  <input value={maSkuNcc} onChange={(e) => setMaSkuNcc(e.target.value)} placeholder="VD: ABC-02" required />
                </div>
                <div className="form-group">
                  <label>Mã SKU nội bộ (PO) *</label>
                  <input value={maSkuNoiBo} onChange={(e) => setMaSkuNoiBo(e.target.value)} placeholder="VD: SKU-02" required />
                </div>
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
