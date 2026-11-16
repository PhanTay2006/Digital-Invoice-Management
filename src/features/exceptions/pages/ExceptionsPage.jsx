import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TRANG_THAI_TC = {
  OPEN: 'Mới mở',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã xử lý',
}

const TRANG_THAI_DUYET = {
  CHO_DUYET: 'Chờ duyệt',
  DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
}

export default function ExceptionsPage() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState([])
  const [approvals, setApprovals] = useState([])
  const [invoices, setInvoices] = useState([])
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [msg, setMsg] = useState(null)

  const [hoaDonId, setHoaDonId] = useState('')
  const [lyDoMo, setLyDoMo] = useState('')
  const [lyDoGuiDuyet, setLyDoGuiDuyet] = useState('')
  const [ghiChuCapNhat, setGhiChuCapNhat] = useState('')
  const [ghiChuQuanLy, setGhiChuQuanLy] = useState('')

  const isAp = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)
  const isManager = ['QUAN_LY', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    try {
      const [tcList, ycList, hdList] = await Promise.all([
        apiFetch('/tranh-chap').catch(() => []),
        apiFetch('/yeu-cau-duyet').catch(() => []),
        apiFetch('/hoa-don'),
      ])
      setDisputes(tcList)
      setApprovals(ycList)
      const mismatchHds = hdList.filter((h) => ['MISMATCH', 'PARTIAL'].includes(h.trang_thai))
      setInvoices(mismatchHds)
      if (mismatchHds.length > 0 && !hoaDonId) {
        setHoaDonId(String(mismatchHds[0].id))
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function viewDisputeDetail(id) {
    try {
      const d = await apiFetch(`/tranh-chap/${id}`)
      setSelectedDispute(d)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function handleCreateDispute(e) {
    e.preventDefault()
    setMsg(null)
    try {
      const res = await apiFetch(`/hoa-don/${hoaDonId}/tranh-chap`, {
        method: 'POST',
        body: JSON.stringify({ ly_do: lyDoMo }),
      })
      setMsg({ type: 'success', text: `Đã mở Hồ sơ tranh chấp #${res.id} (Trạng thái OPEN) trong bảng tranh_chap!` })
      setLyDoMo('')
      await loadData()
      await viewDisputeDetail(res.id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleUpdateDisputeStatus(tid, nextStatus) {
    setMsg(null)
    try {
      await apiFetch(`/tranh-chap/${tid}/trang-thai`, {
        method: 'PUT',
        body: JSON.stringify({ trang_thai: nextStatus, ghi_chu: ghiChuCapNhat || `Chuyển sang ${nextStatus}` }),
      })
      setMsg({ type: 'success', text: `Đã cập nhật tranh chấp #${tid} sang ${nextStatus}!` })
      setGhiChuCapNhat('')
      await loadData()
      await viewDisputeDetail(tid)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleRequestApproval(tid) {
    if (!lyDoGuiDuyet.trim()) {
      setMsg({ type: 'error', text: 'Vui lòng nhập lý do đề nghị Quản lý duyệt ngoại lệ.' })
      return
    }
    setMsg(null)
    try {
      const res = await apiFetch(`/tranh-chap/${tid}/yeu-cau-duyet`, {
        method: 'POST',
        body: JSON.stringify({ ly_do: lyDoGuiDuyet }),
      })
      setMsg({ type: 'success', text: `Đã gửi Yêu cầu duyệt ngoại lệ #${res.id} tới Quản lý (Kế toán trưởng)!` })
      setLyDoGuiDuyet('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function handleManagerDecision(yid, quyet_dinh) {
    if (!ghiChuQuanLy.trim()) {
      setMsg({ type: 'error', text: 'Quản lý bắt buộc nhập ghi chú khi Duyệt hoặc Từ chối.' })
      return
    }
    setMsg(null)
    try {
      await apiFetch(`/yeu-cau-duyet/${yid}`, {
        method: 'PUT',
        body: JSON.stringify({ quyet_dinh, ghi_chu: ghiChuQuanLy }),
      })
      setMsg({
        type: 'success',
        text: `Đã ghi nhận quyết định ${quyet_dinh} cho yêu cầu #${yid}! ${quyet_dinh === 'DUYET' ? 'Hóa đơn đã chuyển sang RECONCILED (theo ngoại lệ).' : ''}`,
      })
      setGhiChuQuanLy('')
      await loadData()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">XỬ LÝ TRANH CHẤP & PHÊ DUYỆT NGOẠI LỆ</p>
          <h1>Quản lý Tranh chấp & Duyệt Ngoại lệ Lệch lớn</h1>
          <p className="page-description">
            Theo dõi và xử lý các hóa đơn lệch dữ liệu với Nhà cung cấp, phê duyệt hóa đơn lệch theo hạn mức quy định.
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
              <h2>Hồ sơ Tranh chấp ({disputes.length})</h2>
              <p>Bấm vào từng dòng để xem lịch sử trao đổi và gửi yêu cầu duyệt ngoại lệ</p>
            </div>
          </div>

          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>HÓA ĐƠN</th>
                  <th>NGƯỜI PHỤ TRÁCH</th>
                  <th>LÝ DO TRANH CHẤP</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {disputes.map((tc) => (
                  <tr key={tc.id} onClick={() => viewDisputeDetail(tc.id)} style={{ cursor: 'pointer' }}>
                    <td>#{tc.id}</td>
                    <td><strong className="invoice-id">{tc.so_hoa_don}</strong></td>
                    <td>{tc.ten_phu_trach}</td>
                    <td>{tc.ly_do}</td>
                    <td>
                      <span className={`status-pill ${tc.trang_thai === 'RESOLVED' ? 'success' : tc.trang_thai === 'IN_PROGRESS' ? 'warning' : 'danger'}`}>
                        {TRANG_THAI_TC[tc.trang_thai] || tc.trang_thai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedDispute && (
            <div className="detail-box">
              <h3>Chi tiết Hồ sơ Tranh chấp #{selectedDispute.id} (Trạng thái: {TRANG_THAI_TC[selectedDispute.trang_thai] || selectedDispute.trang_thai})</h3>
              <ul className="history-list">
                {selectedDispute.lich_su?.map((ls) => (
                  <li key={ls.id}>
                    <strong>[{TRANG_THAI_TC[ls.trang_thai_moi] || ls.trang_thai_moi}]</strong> {ls.ghi_chu} — <small className="muted-cell">{new Date(ls.thoi_gian).toLocaleString('vi-VN')}</small>
                  </li>
                ))}
              </ul>

              {isAp && selectedDispute.trang_thai !== 'RESOLVED' && (
                <div className="crud-form" style={{ marginTop: 14 }}>
                  <div className="form-group">
                    <label>Ghi chú cập nhật tiến độ trao đổi với NCC:</label>
                    <input
                      value={ghiChuCapNhat}
                      onChange={(e) => setGhiChuCapNhat(e.target.value)}
                      placeholder="Nhập nội dung làm việc với NCC..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selectedDispute.trang_thai === 'OPEN' && (
                      <button type="button" className="button button-secondary" onClick={() => handleUpdateDisputeStatus(selectedDispute.id, 'IN_PROGRESS')}>
                        Chuyển sang Đang xử lý
                      </button>
                    )}
                    {selectedDispute.trang_thai === 'IN_PROGRESS' && (
                      <button type="button" className="button button-primary" onClick={() => handleUpdateDisputeStatus(selectedDispute.id, 'RESOLVED')}>
                        Đóng tranh chấp (Đưa HĐ về Chưa đối soát)
                      </button>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: 14 }}>
                    <label>Hoặc trình Quản lý duyệt ngoại lệ lệch lớn:</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={lyDoGuiDuyet}
                        onChange={(e) => setLyDoGuiDuyet(e.target.value)}
                        placeholder="Nhập lý do xin duyệt ngoại lệ (VD: Biến động giá thị trường)"
                      />
                      <button type="button" className="button button-primary" onClick={() => handleRequestApproval(selectedDispute.id)}>
                        Gửi duyệt ngoại lệ
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isAp && (
            <form onSubmit={handleCreateDispute} className="crud-form" style={{ marginTop: 22 }}>
              <h3>Mở Hồ sơ Tranh chấp mới</h3>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Chọn Hóa đơn đang Mismatch/Partial *</label>
                  <select value={hoaDonId} onChange={(e) => setHoaDonId(e.target.value)} required>
                    {invoices.map((h) => (
                      <option key={h.id} value={h.id}>#{h.id} — {h.so_hoa_don} ({h.trang_thai})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Lý do tranh chấp *</label>
                  <input value={lyDoMo} onChange={(e) => setLyDoMo(e.target.value)} placeholder="VD: Đơn giá cao hơn PO 5%" required />
                </div>
              </div>
              <button type="submit" className="button button-primary" disabled={!invoices.length}>
                Tạo Hồ sơ Tranh chấp
              </button>
            </form>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Yêu cầu Duyệt Ngoại lệ Lệch lớn ({approvals.length})</h2>
              <p>Quyền phê duyệt: <strong>Quản lý / Kế toán trưởng</strong></p>
            </div>
          </div>

          {isManager && (
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Ghi chú phê duyệt / từ chối của Quản lý (Bắt buộc):</label>
              <input
                value={ghiChuQuanLy}
                onChange={(e) => setGhiChuQuanLy(e.target.value)}
                placeholder="Nhập ghi chú quyết định trước khi bấm Duyệt hoặc Từ chối..."
              />
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>HÓA ĐƠN</th>
                  <th>MỨC LỆCH (₫)</th>
                  <th>LÝ DO ĐỀ NGHỊ</th>
                  <th>TRẠNG THÁI</th>
                  <th>QUYẾT ĐỊNH</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((y) => (
                  <tr key={y.id}>
                    <td>#{y.id}</td>
                    <td><strong className="invoice-id">{y.so_hoa_don}</strong></td>
                    <td className="amount-cell">{Number(y.muc_lech_tien || 0).toLocaleString('vi-VN')}</td>
                    <td>{y.ly_do}</td>
                    <td>
                      <span className={`status-pill ${y.trang_thai === 'DUYET' ? 'success' : y.trang_thai === 'TU_CHOI' ? 'danger' : 'warning'}`}>
                        {TRANG_THAI_DUYET[y.trang_thai] || y.trang_thai}
                      </span>
                    </td>
                    <td>
                      {isManager && y.trang_thai === 'CHO_DUYET' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ height: 28, padding: '0 10px' }}
                            onClick={() => handleManagerDecision(y.id, 'DUYET')}
                          >
                            ✓ Duyệt
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ height: 28, padding: '0 10px' }}
                            onClick={() => handleManagerDecision(y.id, 'TU_CHOI')}
                          >
                            ✕ Từ chối
                          </button>
                        </div>
                      ) : (
                        <span className="muted-cell">{y.ghi_chu_duyet || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
