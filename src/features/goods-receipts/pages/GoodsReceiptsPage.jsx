import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

export default function GoodsReceiptsPage() {
  const { user } = useAuth()
  const [grns, setGrns] = useState([])
  const [pos, setPos] = useState([])
  const [selectedPoDetail, setSelectedPoDetail] = useState(null)
  const [msg, setMsg] = useState(null)

  const [soPhieu, setSoPhieu] = useState('')
  const [poId, setPoId] = useState('')
  const [ngayNhap, setNgayNhap] = useState(new Date().toISOString().slice(0, 10))
  const [dongKho, setDongKho] = useState([])

  const canCreate = ['THU_KHO', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    try {
      const [grnList, poList] = await Promise.all([
        apiFetch('/phieu-kho'),
        apiFetch('/po'),
      ])
      setGrns(grnList)
      const hangHoaPos = poList.filter((p) => p.loai_po === 'HANG_HOA')
      setPos(hangHoaPos)
      if (hangHoaPos.length > 0 && !poId) {
        handleSelectPo(hangHoaPos[0].id)
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSelectPo(id) {
    setPoId(String(id))
    try {
      const detail = await apiFetch(`/po/${id}`)
      setSelectedPoDetail(detail)
      setDongKho(
        detail.dong.map((d) => ({
          dong_po_id: d.id,
          ma_sku: d.ma_sku,
          ten_san_pham: d.mo_ta || `Sản phẩm ${d.ma_sku}`,
          so_luong_dat: d.so_luong_dat,
          so_nhan: d.so_luong_dat,
          so_dat: d.so_luong_dat,
          so_tu_choi: 0,
          ly_do: '',
        }))
      )
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  function updateLine(idx, field, val) {
    setDongKho((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )
  }

  async function handleCreateGrn(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch('/phieu-kho', {
        method: 'POST',
        body: JSON.stringify({
          so_phieu: soPhieu.trim(),
          po_id: Number(poId),
          ngay_nhap: ngayNhap,
          dong: dongKho.map((d) => ({
            dong_po_id: d.dong_po_id,
            so_nhan: Number(d.so_nhan),
            so_dat: Number(d.so_dat),
            so_tu_choi: Number(d.so_tu_choi || 0),
            ly_do: d.ly_do || null,
          })),
        }),
      })
      setMsg({
        type: 'success',
        text: `Đã lập Phiếu nhập kho #${res.id} (Trạng thái: ${res.trang_thai}) vào bảng phieu_kho & dong_phieu_kho!`,
      })
      setSoPhieu('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PHÂN HỆ KHO</p>
          <h1>Quản lý Phiếu nhập kho (GRN)</h1>
          <p className="page-description">
            Ghi nhận số lượng hàng thực nhận và số lượng đạt theo từng đợt giao của PO hàng hóa.
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
              <h2>Danh sách Phiếu nhập kho ({grns.length})</h2>
              <p>Ghi nhận số lượng thực nhận, số đạt chất lượng và hàng lỗi theo từng đợt</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SỐ PHIẾU GRN</th>
                  <th>SỐ PO THAM CHIẾU</th>
                  <th>NHÀ CUNG CẤP</th>
                  <th>NGÀY NHẬP</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {grns.map((g) => (
                  <tr key={g.id}>
                    <td>#{g.id}</td>
                    <td><strong className="invoice-id">{g.so_phieu}</strong></td>
                    <td>{g.so_po}</td>
                    <td>{g.ten_ncc}</td>
                    <td>{g.ngay_nhap}</td>
                    <td>
                      <span className={`status-pill ${g.trang_thai === 'CONFIRMED' ? 'success' : 'warning'}`}>
                        {g.trang_thai === 'CONFIRMED' ? 'Đủ hàng' : 'Nhập một phần'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Lập Phiếu nhập kho (GRN) mới</h2>
              <p>Chỉ vai trò <strong>Thủ kho (THU_KHO)</strong> được phép lập phiếu</p>
            </div>
          </div>

          {!canCreate ? (
            <div className="role-notice">
              Bạn đang đăng nhập với vai trò <strong>{user?.ten_vai_tro}</strong>. Để lập phiếu nhập kho (GRN), hãy đăng nhập bằng tài khoản <code>thukho</code> (Thủ kho).
            </div>
          ) : (
            <form onSubmit={handleCreateGrn} className="crud-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Số phiếu nhập kho *</label>
                  <input
                    value={soPhieu}
                    onChange={(e) => setSoPhieu(e.target.value)}
                    placeholder="VD: GRN-002"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ngày nhập kho *</label>
                  <input
                    type="date"
                    value={ngayNhap}
                    onChange={(e) => setNgayNhap(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Chọn PO Hàng hóa tham chiếu *</label>
                <select value={poId} onChange={(e) => handleSelectPo(e.target.value)} required>
                  {pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.so_po} — {p.ten_ncc} ({p.trang_thai})
                    </option>
                  ))}
                </select>
              </div>

              {dongKho.map((d, idx) => (
                <div key={d.dong_po_id} className="grn-line-card">
                  <div className="grn-line-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>{d.ten_san_pham || d.ma_sku}</strong>
                      <span className="muted-cell" style={{ display: 'block', fontSize: 12 }}>Mã SKU: {d.ma_sku}</span>
                    </div>
                    <span>Số lượng đặt trên PO: <b>{d.so_luong_dat}</b></span>
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Số thực nhận</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={d.so_nhan}
                        onChange={(e) => updateLine(idx, 'so_nhan', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Số lượng đạt *</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={d.so_dat}
                        onChange={(e) => updateLine(idx, 'so_dat', e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Số từ chối</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={d.so_tu_choi}
                        onChange={(e) => updateLine(idx, 'so_tu_choi', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Lý do chênh lệch / từ chối (nếu có)</label>
                    <input
                      value={d.ly_do}
                      onChange={(e) => updateLine(idx, 'ly_do', e.target.value)}
                      placeholder="VD: Hư hỏng bao bì khi vận chuyển"
                    />
                  </div>
                </div>
              ))}

              <button type="submit" className="button button-primary" style={{ width: '100%' }}>
                Xác nhận & Lưu Phiếu nhập kho vào DB
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
