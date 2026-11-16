import { useEffect, useState } from 'react'
import { apiFetch } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'

const TRANG_THAI_LABEL = {
  CHUA_DOI_SOAT: 'Chưa đối soát',
  MATCHED: 'Khớp',
  PARTIAL: 'Khớp một phần',
  MISMATCH: 'Lệch',
  RECONCILED: 'Đã đối soát',
}

const TEN_BUOC = {
  a: 'Kiểm tra Nhà cung cấp khớp PO tham chiếu',
  b: 'Kiểm tra ánh xạ SKU NCC sang dòng hàng PO',
  c: 'Đối chiếu số lượng Hóa đơn với PO và Phiếu nhập kho (GRN)',
  d: 'Đối chiếu đơn giá trong ngưỡng dung sai',
  e: 'Kiểm tra tổng tiền, thuế VAT và khoản trừ cọc',
}

export default function MatchingPage() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pos, setPos] = useState([])
  const [config, setConfig] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [msg, setMsg] = useState(null)

  const canMatch = ['KE_TOAN_AP', 'TOAN_QUYEN'].includes(user?.vai_tro)

  const nccMap = Object.fromEntries(suppliers.map((s) => [s.id, s]))
  const poMap = Object.fromEntries(pos.map((p) => [p.id, p]))

  async function loadData() {
    try {
      const [hdList, cfg, nccList, poList] = await Promise.all([
        apiFetch('/hoa-don'),
        apiFetch('/cau-hinh/hien-hanh').catch(() => null),
        apiFetch('/nha-cung-cap').catch(() => []),
        apiFetch('/po').catch(() => []),
      ])
      setInvoices(hdList)
      setConfig(cfg)
      setSuppliers(nccList)
      setPos(poList)
      if (hdList.length > 0 && !selectedDetail) {
        viewInvoiceMatching(hdList[0].id)
      }
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
      const label = TRANG_THAI_LABEL[res.ket_qua] || res.ket_qua
      setMsg({
        type: res.ket_qua === 'MATCHED' ? 'success' : 'error',
        text: `Kết quả đối soát Hóa đơn #${id}: ${label}${res.lech_lon ? ` (Lệch lớn: ${Number(res.muc_lech_tien).toLocaleString('vi-VN')} ₫)` : ''}`,
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
        text: `Đã xác nhận hoàn tất đối soát và khóa Hóa đơn #${id} thành công!`,
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
          <p className="eyebrow">ĐỐI SOÁT TỰ ĐỘNG</p>
          <h1>Đối soát 3 chiều</h1>
          <p className="page-description">
            Tự động so khớp dữ liệu Hóa đơn với Đơn đặt hàng (PO) và Phiếu nhập kho (GRN) theo các tiêu chuẩn dung sai.
          </p>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button" onClick={loadData}>↻ Làm mới</button>
        </div>
      </div>

      {/* THÔNG TIN THAM SỐ DUNG SAI - BỎ ICON BÁNH RĂNG */}
      {config && config.id && (
        <div
          style={{
            padding: '12px 18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#0f172a', marginRight: 10 }}>Tham số Dung sai đang áp dụng:</strong>
          <span style={{ color: '#475569' }}>
            Dung sai đơn giá: <b>{config.dung_sai_don_gia_pct}%</b> | Ngưỡng lệch lớn: <b>{config.nguong_lech_lon_pct}%</b> hoặc <b>{Number(config.nguong_lech_lon_tien).toLocaleString('vi-VN')} ₫</b> | Hạn mức duyệt ngoại lệ: <b>{Number(config.han_muc_duyet).toLocaleString('vi-VN')} ₫</b>
          </span>
        </div>
      )}

      {msg && (
        <div className={`alert-banner ${msg.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {msg.text}
        </div>
      )}

      {/* PHẦN TRÊN: DANH SÁCH HÓA ĐƠN CẦN ĐỐI SOÁT (FULL WIDTH RỘNG RÃI) */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-heading">
          <div>
            <h2>Danh sách Hóa đơn cần Đối soát ({invoices.length})</h2>
            <p>Bấm vào từng hóa đơn để chạy đối soát hoặc xem chi tiết từng bước kiểm tra ở phần bên dưới</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>SỐ HÓA ĐƠN</th>
                <th>NHÀ CUNG CẤP</th>
                <th>PO THAM CHIẾU</th>
                <th>TỔNG TIỀN (₫)</th>
                <th>TRẠNG THÁI</th>
                <th style={{ textAlign: 'center' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }} className="muted-cell">
                    Không có hóa đơn nào.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const isSelected = selectedDetail?.id === inv.id
                  const ncc = nccMap[inv.nha_cung_cap_id]
                  const po = poMap[inv.po_id]
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => viewInvoiceMatching(inv.id)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? '#f0f7ff' : undefined,
                      }}
                    >
                      <td>#{inv.id}</td>
                      <td>
                        <strong className="invoice-id">{inv.so_hoa_don}</strong>
                      </td>
                      <td>
                        <strong>{ncc ? ncc.ten : `NCC #${inv.nha_cung_cap_id}`}</strong>
                      </td>
                      <td>
                        <span>{po ? po.so_po : `PO #${inv.po_id}`}</span>
                      </td>
                      <td className="amount-cell">{Number(inv.tong_thanh_toan).toLocaleString('vi-VN')}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            inv.trang_thai === 'MATCHED' || inv.trang_thai === 'RECONCILED'
                              ? 'success'
                              : inv.trang_thai === 'MISMATCH'
                              ? 'danger'
                              : 'warning'
                          }`}
                        >
                          {TRANG_THAI_LABEL[inv.trang_thai] || inv.trang_thai} {inv.theo_ngoai_le ? '(Ngoại lệ)' : ''}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        {canMatch && inv.trang_thai !== 'RECONCILED' && (
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ height: 32, padding: '0 12px', marginRight: 8, fontSize: 12.5 }}
                            onClick={() => runMatching(inv.id)}
                          >
                            ⇄ Chạy đối soát
                          </button>
                        )}
                        {canMatch && inv.trang_thai === 'MATCHED' && (
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ height: 32, padding: '0 12px', fontSize: 12.5 }}
                            onClick={() => confirmReconciled(inv.id)}
                          >
                            ✓ Hoàn tất đối soát
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHẦN DƯỚI: CHI TIẾT KẾT QUẢ TỪNG BƯỚC KIỂM TRA (FULL WIDTH KHÔNG BỊ TRÀN) */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <h2>Chi tiết Kết quả từng Bước Kiểm tra</h2>
            <p>Bảng kết quả so khớp chi tiết của hóa đơn đang chọn</p>
          </div>
          {selectedDetail && (
            <div>
              <span
                className={`status-pill ${
                  selectedDetail.trang_thai === 'MATCHED' || selectedDetail.trang_thai === 'RECONCILED'
                    ? 'success'
                    : selectedDetail.trang_thai === 'MISMATCH'
                    ? 'danger'
                    : 'warning'
                }`}
                style={{ fontSize: 13, padding: '5px 12px' }}
              >
                {TRANG_THAI_LABEL[selectedDetail.trang_thai] || selectedDetail.trang_thai}
              </span>
            </div>
          )}
        </div>

        {!selectedDetail ? (
          <p className="muted-cell" style={{ padding: '20px 0', textAlign: 'center' }}>
            Hãy bấm vào một Hóa đơn ở bảng phía trên để xem kết quả đối soát.
          </p>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div>
                <span className="muted-cell" style={{ marginRight: 6 }}>Hóa đơn đang xem:</span>
                <strong style={{ fontSize: 15, color: '#0f172a' }}>{selectedDetail.so_hoa_don}</strong>
                <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                <span className="muted-cell" style={{ marginRight: 6 }}>Nhà cung cấp:</span>
                <strong>{nccMap[selectedDetail.nha_cung_cap_id]?.ten || `NCC #${selectedDetail.nha_cung_cap_id}`}</strong>
              </div>
              <div>
                <span className="muted-cell" style={{ marginRight: 6 }}>Tổng thanh toán:</span>
                <strong style={{ color: '#0f172a', fontSize: 15 }}>
                  {Number(selectedDetail.tong_thanh_toan).toLocaleString('vi-VN')} ₫
                </strong>
              </div>
            </div>

            {!selectedDetail.lan_doi_soat?.length ? (
              <p className="muted-cell" style={{ padding: '24px 0', textAlign: 'center' }}>
                Hóa đơn này chưa chạy đối soát lần nào. Hãy bấm nút <strong>"⇄ Chạy đối soát"</strong> ở bảng trên để thực hiện đối chiếu tự động.
              </p>
            ) : (
              selectedDetail.lan_doi_soat.map((lan) => {
                const steps = Array.isArray(lan.chi_tiet_buoc)
                  ? lan.chi_tiet_buoc
                  : JSON.parse(lan.chi_tiet_buoc || '[]')
                return (
                  <div key={lan.id} className="detail-box" style={{ marginBottom: 18, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <strong style={{ fontSize: 14, color: '#0f172a' }}>
                          Lần chạy đối soát #{lan.id} — Kết quả:{' '}
                          <span style={{ color: lan.ket_qua === 'MATCHED' ? '#15803d' : '#b91c1c' }}>
                            {TRANG_THAI_LABEL[lan.ket_qua] || lan.ket_qua}
                          </span>
                        </strong>
                      </div>
                      <span className="muted-cell">{new Date(lan.thoi_gian).toLocaleString('vi-VN')}</span>
                    </div>

                    {lan.lech_lon && (
                      <div className="alert-error" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: '#fff0ee', border: '1px solid #fecaca', color: '#b91c1c' }}>
                        ⚠️ Đánh dấu <strong>LỆCH LỚN</strong> — Tổng tiền lệch: <b>{Number(lan.muc_lech_tien).toLocaleString('vi-VN')} ₫</b>
                      </div>
                    )}

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>BƯỚC KIỂM TRA</th>
                            <th>DỮ LIỆU TRÊN HÓA ĐƠN</th>
                            <th>DỮ LIỆU THAM CHIẾU (PO / GRN)</th>
                            <th style={{ textAlign: 'center' }}>KẾT QUẢ</th>
                            <th>CHI TIẾT ĐỐI CHIẾU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {steps.map((s) => (
                            <tr key={s.ma_buoc}>
                              <td>
                                <strong>{TEN_BUOC[s.ma_buoc] || s.ma_buoc}</strong>
                              </td>
                              <td>{s.gia_tri_hoa_don || '—'}</td>
                              <td>{s.gia_tri_tham_chieu || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
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
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </section>
  )
}
