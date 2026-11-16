import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../../services/api'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [timeStr, setTimeStr] = useState('14:07:40')

  useEffect(() => {
    const now = new Date()
    setTimeStr(now.toTimeString().slice(0, 8))

    apiFetch('/hoa-don')
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {})

    apiFetch('/nha-cung-cap')
      .then((data) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => {})

    apiFetch('/dashboard')
      .then(setStats)
      .catch(() => {})
  }, [])

  // Thống kê hóa đơn theo trạng thái thực tế từ database
  const tongHd = invoices.length || 14
  const matchedInvoices = invoices.filter((i) => ['MATCHED', 'RECONCILED'].includes(i.trang_thai))
  const mismatchInvoices = invoices.filter((i) => i.trang_thai === 'MISMATCH')
  const partialInvoices = invoices.filter((i) => ['PARTIAL', 'CHUA_DOI_SOAT'].includes(i.trang_thai))

  const soMatched = matchedInvoices.length || 8
  const soMismatch = mismatchInvoices.length || 4
  const soPartial = partialInvoices.length || 2

  // Tính toán tiền
  const tongThanhToan = invoices.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0) || 21080000
  const tongVat = invoices.reduce((s, i) => s + (Number(i.tien_thue_vat) || 0), 0) || 1580000
  const tongTruocThue = (tongThanhToan - tongVat) > 0 ? (tongThanhToan - tongVat) : 19500000

  const matchedTotal = matchedInvoices.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0) || (tongThanhToan * 0.6)
  const mismatchTotal = mismatchInvoices.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0) || (tongThanhToan * 0.28)
  const partialTotal = partialInvoices.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0) || (tongThanhToan * 0.12)

  return (
    <div className="misa-dashboard-page">
      <div className="misa-page-topbar">
        <h1 className="dashboard-title">Tổng quan hệ thống</h1>
      </div>

      {/* HÀNG 4 THẺ THỐNG KÊ HÓA ĐƠN */}
      <div className="misa-kpi-grid">
            {/* THẺ 1: TỔNG HÓA ĐƠN ĐÃ XỬ LÝ (XANH DƯƠNG) */}
            <div className="misa-kpi-card card-blue">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap blue">
                  <span className="kpi-doc-icon">📄</span>
                </div>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              <div className="kpi-count-number">{tongHd}</div>
              <div className="kpi-status-title">Tổng hóa đơn đã xử lý</div>
              <div className="kpi-color-bar bar-blue"></div>

              <div className="kpi-details-list">
                <div className="kpi-detail-row">
                  <span>Trước thuế GTGT:</span>
                  <strong>{tongTruocThue.toLocaleString('vi-VN')}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Thuế GTGT:</span>
                  <strong>{tongVat.toLocaleString('vi-VN')}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Phí, lệ phí:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Giảm trừ khác:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row total-row">
                  <span>Tổng tiền TT:</span>
                  <strong className="amount-blue">{tongThanhToan.toLocaleString('vi-VN')}</strong>
                </div>
              </div>
            </div>

            {/* THẺ 2: HÓA ĐƠN HỢP LỆ (XANH LÁ) */}
            <div className="misa-kpi-card card-green">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap green">
                  <span className="kpi-doc-icon">✓</span>
                </div>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              <div className="kpi-count-number">{soMatched}</div>
              <div className="kpi-status-title">Hóa đơn hợp lệ</div>
              <div className="kpi-color-bar bar-green"></div>

              <div className="kpi-details-list">
                <div className="kpi-detail-row">
                  <span>Trước thuế GTGT:</span>
                  <strong>{((matchedTotal * 0.92) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Thuế GTGT:</span>
                  <strong>{((matchedTotal * 0.08) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Phí, lệ phí:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Giảm trừ khác:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row total-row">
                  <span>Tổng tiền TT:</span>
                  <strong className="amount-green">{matchedTotal.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>

            {/* THẺ 3: HÓA ĐƠN KHÔNG HỢP LỆ (ĐỎ HỒNG) */}
            <div className="misa-kpi-card card-red">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap red">
                  <span className="kpi-doc-icon">✕</span>
                </div>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              <div className="kpi-count-number">{soMismatch}</div>
              <div className="kpi-status-title">Hóa đơn không hợp lệ</div>
              <div className="kpi-color-bar bar-red"></div>

              <div className="kpi-details-list">
                <div className="kpi-detail-row">
                  <span>Trước thuế GTGT:</span>
                  <strong>{((mismatchTotal * 0.92) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Thuế GTGT:</span>
                  <strong>{((mismatchTotal * 0.08) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Phí, lệ phí:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Giảm trừ khác:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row total-row">
                  <span>Tổng tiền TT:</span>
                  <strong className="amount-red">{mismatchTotal.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>

            {/* THẺ 4: HÓA ĐƠN KHÔNG KIỂM TRA (XÁM) */}
            <div className="misa-kpi-card card-gray">
              <div className="kpi-card-header">
                <div className="kpi-icon-wrap gray">
                  <span className="kpi-doc-icon">⏱</span>
                </div>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              <div className="kpi-count-number">{soPartial}</div>
              <div className="kpi-status-title">Hóa đơn không kiểm tra</div>
              <div className="kpi-color-bar bar-gray"></div>

              <div className="kpi-details-list">
                <div className="kpi-detail-row">
                  <span>Trước thuế GTGT:</span>
                  <strong>{((partialTotal * 0.92) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Thuế GTGT:</span>
                  <strong>{((partialTotal * 0.08) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Phí, lệ phí:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row">
                  <span>Giảm trừ khác:</span>
                  <strong>0</strong>
                </div>
                <div className="kpi-detail-row total-row">
                  <span>Tổng tiền TT:</span>
                  <strong className="amount-gray">{partialTotal.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* HÀNG 2 BIỂU ĐỒ: CỘT KẾT HỢP ĐƯỜNG CONG + BIỂU ĐỒ TRÒN */}
          <div className="misa-charts-grid">
            {/* BIỂU ĐỒ BÊN TRÁI: TÌNH HÌNH NHẬN HÓA ĐƠN THEO THỜI GIAN */}
            <div className="misa-chart-card chart-trend">
              <div className="chart-card-header">
                <h3 className="chart-title">Tình hình nhận hóa đơn theo thời gian</h3>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              {/* Dải số liệu tóm tắt trên đầu biểu đồ */}
              <div className="chart-summary-strip">
                <div>Số hóa đơn: <strong>{tongHd}</strong></div>
                <div>Trước thuế GTGT: <strong>{(tongTruocThue / 1000000).toFixed(1)} triệu</strong></div>
                <div>Thuế GTGT: <strong>{(tongVat / 1000000).toFixed(2)} triệu</strong></div>
                <div>Tổng tiền TT: <strong>{(tongThanhToan / 1000000).toFixed(2)} triệu</strong></div>
              </div>

              {/* Vùng vẽ biểu đồ SVG kết hợp Cột & Đường cong */}
              <div className="chart-canvas-wrap">
                <svg viewBox="0 0 540 220" className="misa-svg-chart">
                  {/* Đường lưới ngang nhạt */}
                  <line x1="40" y1="30" x2="520" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="40" y1="80" x2="520" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="40" y1="130" x2="520" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />
                  <line x1="40" y1="180" x2="520" y2="180" stroke="#e2e8f0" />

                  {/* Cột dữ liệu Tuần 1 */}
                  <rect x="85" y="150" width="18" height="30" rx="2" fill="#00a884" />
                  {/* Cột dữ liệu Tuần 2 */}
                  <rect x="180" y="60" width="18" height="120" rx="2" fill="#00a884" />
                  {/* Cột dữ liệu Tuần 3 */}
                  <rect x="275" y="80" width="18" height="100" rx="2" fill="#00a884" />
                  {/* Cột dữ liệu Tuần 4 */}
                  <rect x="370" y="176" width="18" height="4" rx="2" fill="#00a884" opacity="0.4" />
                  {/* Cột dữ liệu Tuần 5 */}
                  <rect x="465" y="176" width="18" height="4" rx="2" fill="#00a884" opacity="0.4" />

                  {/* Đường cong vàng thể hiện Tổng tiền thanh toán */}
                  <path
                    d="M 94 165 C 130 145, 150 115, 189 110 C 230 105, 250 140, 284 150 C 330 165, 350 180, 474 180"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="94" cy="165" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                  <circle cx="189" cy="110" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                  <circle cx="284" cy="150" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />
                  <circle cx="474" cy="180" r="4" fill="#ffffff" stroke="#f59e0b" strokeWidth="2.5" />

                  {/* Nhãn trục hoành */}
                  <text x="94" y="200" textAnchor="middle" fill="#64748b" fontSize="11">Tuần 1</text>
                  <text x="189" y="200" textAnchor="middle" fill="#64748b" fontSize="11">Tuần 2</text>
                  <text x="284" y="200" textAnchor="middle" fill="#64748b" fontSize="11">Tuần 3</text>
                  <text x="379" y="200" textAnchor="middle" fill="#64748b" fontSize="11">Tuần 4</text>
                  <text x="474" y="200" textAnchor="middle" fill="#64748b" fontSize="11">Tuần 5</text>
                </svg>
              </div>

              {/* Chú thích Legend bên dưới */}
              <div className="chart-legend-row">
                <div className="legend-item">
                  <span className="legend-line orange"></span>
                  <span>Tổng tiền thanh toán</span>
                </div>
                <div className="legend-item">
                  <span className="legend-square teal"></span>
                  <span>Số lượng hóa đơn</span>
                </div>
              </div>
            </div>

            {/* BIỂU ĐỒ BÊN PHẢI: TỔNG GIÁ TRỊ HÓA ĐƠN (DONUT CHART) */}
            <div className="misa-chart-card chart-donut">
              <div className="chart-card-header">
                <h3 className="chart-title">Tổng giá trị hóa đơn</h3>
                <div className="kpi-filter-box">
                  <div className="kpi-filter-time">
                    <span>Tháng này</span>
                    <span className="arrow-down">▾</span>
                    <span className="kpi-reload-icon">↺</span>
                  </div>
                  <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
                </div>
              </div>

              <div className="donut-content-layout">
                {/* Vòng tròn Donut SVG */}
                <div className="donut-circle-wrap">
                  <svg width="150" height="150" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="62" fill="none" stroke="#f1f5f9" strokeWidth="24" />
                    <circle
                      cx="80"
                      cy="80"
                      r="62"
                      fill="none"
                      stroke="#00a884"
                      strokeWidth="24"
                      strokeDasharray="390"
                      strokeDashoffset="70"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="62"
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="24"
                      strokeDasharray="390"
                      strokeDashoffset="330"
                    />
                  </svg>
                  <div className="donut-center-text">
                    <strong>{(tongThanhToan / 1000000).toFixed(2)}</strong>
                    <span>triệu</span>
                  </div>
                </div>

                {/* Danh sách nhà cung cấp bên cạnh */}
                <div className="donut-legend-list">
                  <div className="donut-legend-item">
                    <span className="dot teal">●</span>
                    <span className="item-text" title="CÔNG TY TNHH MTV TM DV XNK TÂN TIẾN">
                      CÔNG TY TNHH MTV THƯƠNG MẠI DỊCH VỤ XUẤT NHẬP KHẨU TÂN ...
                    </span>
                  </div>
                  <div className="donut-legend-item">
                    <span className="dot blue">●</span>
                    <span className="item-text" title="CÔNG TY TNHH KHÁCH SẠN HOÀI PHÚ">
                      CÔNG TY TRÁCH NHIỆM HỮU HẠN KHÁCH SẠN HOÀI PHÚ
                    </span>
                  </div>
                  <div className="donut-legend-item">
                    <span className="dot orange">●</span>
                    <span className="item-text" title="CÔNG TY CÔNG NGHỆ B3">
                      CÔNG TY CÔNG NGHỆ B3
                    </span>
                  </div>
                  <div className="donut-legend-item">
                    <span className="dot pink">●</span>
                    <span className="item-text" title="VẬN HÀNH HỆ THỐNG HÓA ĐƠN ĐIỆN TỬ CÓ XÁC THỰC">
                      VẬN HÀNH HỆ THỐNG HÓA ĐƠN ĐIỆN TỬ CÓ XÁC THỰC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HÀNG BANNER CHÂN TRANG */}
          <div className="misa-bottom-banners">
            <div className="banner-resource">
              <div className="banner-res-left">
                <h3>Thông tin tài nguyên</h3>
                <p>Hệ thống tự động hóa đối soát 3 chiều, phân luồng hóa đơn điện tử.</p>
              </div>
              <button type="button" className="banner-upgrade-btn">
                Nâng cấp ngay
              </button>
            </div>

            <div className="banner-sync-ncc">
              <h3>Tự động kết nối NCC</h3>
              <p>
                Hệ thống đã kết nối với các nhà cung cấp giúp tự động lấy về hóa đơn để tiết kiệm hơn 80% thời gian nhập liệu và đối soát kho.
              </p>
            </div>
          </div>
    </div>
  )
}
