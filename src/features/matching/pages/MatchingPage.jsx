import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TEN_BUOC = {
  a: 'Bước (a): Kiểm tra Nhà cung cấp khớp PO tham chiếu',
  b: 'Bước (b): Kiểm tra ánh xạ SKU NCC sang dòng hàng PO',
  c: 'Bước (c): Đối chiếu số lượng Hóa đơn với PO và Phiếu nhập kho (GRN)',
  d: 'Bước (d): Đối chiếu đơn giá trong ngưỡng dung sai (%)',
  e: 'Bước (e): Kiểm tra tổng tiền, VAT và khoản trừ cọc',
}

export default function MatchingPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [config, setConfig] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [msg, setMsg] = useState(null)

  const canMatch = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  async function loadData() {
    try {
      const [hdList, cfg] = await Promise.all([
        apiFetch('/hoa-don'),
        apiFetch('/cau-hinh/hien-hanh').catch(() => null),
      ])
      setInvoices(hdList)
      setConfig(cfg)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function viewInvoiceMatching(id) {
    try {
      const detail = await apiFetch(`/hoa-don/${id}`)
      setSelectedDetail(detail)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  async function runMatching(id) {
    setMsg(null)
    try {
      const res = await apiFetch(`/hoa-don/${id}/doi-soat`, { method: 'POST' })
      setMsg({
        type: res.ket_qua === 'MATCHED' ? 'success' : 'error',
        text: `Kết quả đối soát Hóa đơn #${id}: ${res.ket_qua}${res.lech_lon ? ` (LỆCH LỚN: ${Number(res.muc_lech_tien).toLocaleString('vi-VN')} ₫)` : ''}`,
      })
      await loadData()
      await viewInvoiceMatching(id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  async function confirmReconciled(id) {
    setMsg(null)
    try {
      await apiFetch(`/hoa-don/${id}/xac-nhan`, { method: 'POST' })
      setMsg({
        type: 'success',
        text: `Đã xác nhận RECONCILED và khóa vĩnh viễn Hóa đơn #${id} (BR-04, BR-18)!`,
      })
      await loadData()
      await viewInvoiceMatching(id)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <section className="module-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ĐỐI SOÁT TỰ ĐỘNG 3 CHIỀU (F-07 / UC09, UC10)</p>
          <h1>Trung tâm Đối soát 3 Chiều (PO – GRN – Hóa đơn)</h1>
          <p className="page-description">
            Mỗi lần chạy đối soát lưu một bản ghi bất biến vào bảng <code>lan_doi_soat</code> kèm chi tiết từng bước kiểu <code>JSONB</code> (BR-17).
          </p>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={loadData}>↻ Làm mới</button>
        </div>
      </div>

      {config && config.id && (
        <div className="date-banner">
          <div className="date-banner-icon">⚙</div>
          <div>
            <strong>Tham số Dung sai đang áp dụng (F-17):</strong>
            <span>
              Dung sai đơn giá: <b>{config.dung_sai_don_gia_pct}%</b> | Ngưỡng lệch lớn: <b>{config.nguong_lech_lon_pct}%</b> hoặc <b>{Number(config.nguong_lech_lon_tien).toLocaleString('vi-VN')} ₫</b> | Hạn mức duyệt ngoại lệ: <b>{Number(config.han_muc_duyet).toLocaleString('vi-VN')} ₫</b>
            </span>
          </div>
        </div>
      )}

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      <div className="dashboard-columns">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Danh sách Hóa đơn cần Đối soát ({invoices.length})</h2>
              <p>Chọn hóa đơn để chạy đối soát 3 chiều hoặc xác nhận Reconciled</p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>SỐ HÓA ĐƠN</th>
                  <th>PO ID</th>
                  <th>TỔNG TIỀN (₫)</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} onClick={() => viewInvoiceMatching(inv.id)} style={{ cursor: 'pointer' }}>
                    <td>#{inv.id}</td>
                    <td><strong className="invoice-id">{inv.so_hoa_don}</strong></td>
                    <td>PO #{inv.po_id}</td>
                    <td className="amount-cell">{Number(inv.tong_thanh_toan).toLocaleString('vi-VN')}</td>
                    <td>
                      <span className={`status-pill ${inv.trang_thai === 'MATCHED' || inv.trang_thai === 'RECONCILED' ? 'success' : inv.trang_thai === 'MISMATCH' ? 'danger' : 'warning'}`}>
                        {inv.trang_thai} {inv.theo_ngoai_le ? '(Ngoại lệ)' : ''}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {canMatch && inv.trang_thai !== 'RECONCILED' && (
                        <button
                          type="button"
                          className="button button-primary"
                          style={{ height: 28, padding: '0 10px', marginRight: 6 }}
                          onClick={() => runMatching(inv.id)}
                        >
                          ⇄ Chạy đối soát
                        </button>
                      )}
                      {canMatch && inv.trang_thai === 'MATCHED' && (
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ height: 28, padding: '0 10px' }}
                          onClick={() => confirmReconciled(inv.id)}
                        >
                          ✓ Khóa Reconciled
                        </button>
                      )}
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
              <h2>Chi tiết Kết quả từng Bước Kiểm tra (JSONB)</h2>
              <p>Lịch sử trong bảng <code>lan_doi_soat</code></p>
            </div>
          </div>

          {!selectedDetail ? (
            <p className="muted-cell">Hãy bấm vào một Hóa đơn ở bảng bên trái để xem chi tiết từng bước đối soát 3 chiều.</p>
          ) : (
            <div>
              <h3>Hóa đơn: {selectedDetail.so_hoa_don} — Trạng thái: {selectedDetail.trang_thai}</h3>
              {!selectedDetail.lan_doi_soat?.length ? (
                <p className="muted-cell">Hóa đơn này chưa chạy đối soát lần nào.</p>
              ) : (
                selectedDetail.lan_doi_soat.map((lan) => {
                  const steps = Array.isArray(lan.chi_tiet_buoc)
                    ? lan.chi_tiet_buoc
                    : JSON.parse(lan.chi_tiet_buoc || '[]')
                  return (
                    <div key={lan.id} className="detail-box" style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <strong>Lần chạy #{lan.id} — Kết quả: {lan.ket_qua}</strong>
                        <span className="muted-cell">{new Date(lan.thoi_gian).toLocaleString('vi-VN')}</span>
                      </div>
                      {lan.lech_lon && (
                        <div className="alert-error" style={{ marginBottom: 10 }}>
                          ⚠️ Đánh dấu <strong>LỆCH LỚN</strong> — Tổng tiền lệch: <b>{Number(lan.muc_lech_tien).toLocaleString('vi-VN')} ₫</b>
                        </div>
                      )}
                      <table>
                        <thead>
                          <tr>
                            <th>BƯỚC KIỂM TRA</th>
                            <th>HÓA ĐƠN</th>
                            <th>THAM CHIẾU (PO/GRN)</th>
                            <th>KẾT QUẢ</th>
                            <th>LÝ DO LỆCH</th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((s) => (
                            <tr key={s.ma_buoc}>
                              <td><strong>{TEN_BUOC[s.ma_buoc] || s.ma_buoc}</strong></td>
                              <td>{s.gia_tri_hoa_don || '—'}</td>
                              <td>{s.gia_tri_tham_chieu || '—'}</td>
                              <td>
                                <span className={`status-pill ${s.dat ? 'success' : 'danger'}`}>
                                  {s.dat ? 'Đạt' : 'Không đạt'}
                                </span>
                              </td>
                              <td>{s.ly_do || 'Hợp lệ'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
