import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../../../services/api'

const PERIOD_OPTIONS = [
  { key: 'day', label: 'Ngày' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
  { key: 'custom', label: 'Khoảng ngày' },
  { key: 'all', label: 'Tất cả' },
]

const DONUT_COLORS = ['#00a884', '#0284c7', '#f59e0b', '#f43f5e', '#94a3b8']

function toIsoDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toIsoWeek(d) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function fromIsoWeek(weekStr) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekStr)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(year, 0, 4)
  const dayNum = jan4.getDay() || 7
  const monWeek1 = new Date(jan4)
  monWeek1.setDate(jan4.getDate() - dayNum + 1)
  monWeek1.setDate(monWeek1.getDate() + (week - 1) * 7)
  return monWeek1
}

function formatShortDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function shiftAnchor(anchor, mode, delta) {
  const d = new Date(anchor)
  if (mode === 'day') d.setDate(d.getDate() + delta)
  else if (mode === 'week') d.setDate(d.getDate() + delta * 7)
  else if (mode === 'month') d.setMonth(d.getMonth() + delta)
  else if (mode === 'quarter') d.setMonth(d.getMonth() + delta * 3)
  else if (mode === 'year') d.setFullYear(d.getFullYear() + delta)
  return d
}

function getPeriodMeta(mode, anchor, allInvoices, customStart, customEnd) {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()

  if (mode === 'day') {
    const iso = toIsoDate(anchor)
    const buckets = []
    for (let offset = -4; offset <= 0; offset++) {
      const d = new Date(anchor)
      d.setDate(d.getDate() + offset)
      const dIso = toIsoDate(d)
      buckets.push({
        key: dIso,
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        isHighlight: offset === 0,
        match: (invDate) => invDate === dIso,
      })
    }
    return {
      start: iso,
      end: iso,
      label: `Ngày ${formatShortDate(anchor)}`,
      shortLabel: 'Hôm nay',
      buckets,
    }
  }

  if (mode === 'week') {
    const dayOfWeek = anchor.getDay() // 0 = Sun, 1 = Mon...
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const mon = new Date(anchor)
    mon.setDate(anchor.getDate() + diffToMon)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
    const buckets = dayNames.map((name, idx) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + idx)
      const dIso = toIsoDate(d)
      return {
        key: dIso,
        label: `${name} (${d.getDate()}/${d.getMonth() + 1})`,
        match: (invDate) => invDate === dIso,
      }
    })
    return {
      start: toIsoDate(mon),
      end: toIsoDate(sun),
      label: `Tuần ${formatShortDate(mon).slice(0, 5)} – ${formatShortDate(sun)}`,
      shortLabel: 'Theo tuần',
      buckets,
    }
  }

  if (mode === 'month') {
    const first = new Date(y, m, 1)
    const last = new Date(y, m + 1, 0)
    const totalDays = last.getDate()
    const numWeeks = Math.ceil(totalDays / 7)
    const buckets = Array.from({ length: numWeeks }, (_, i) => {
      const sDay = i * 7 + 1
      const eDay = Math.min((i + 1) * 7, totalDays)
      const sIso = toIsoDate(new Date(y, m, sDay))
      const eIso = toIsoDate(new Date(y, m, eDay))
      return {
        key: `w${i + 1}`,
        label: `Tuần ${i + 1}`,
        match: (invDate) => invDate >= sIso && invDate <= eIso,
      }
    })
    return {
      start: toIsoDate(first),
      end: toIsoDate(last),
      label: `Tháng ${String(m + 1).padStart(2, '0')}/${y}`,
      shortLabel: 'Theo tháng',
      buckets,
    }
  }

  if (mode === 'quarter') {
    const q = Math.floor(m / 3)
    const startMonth = q * 3
    const first = new Date(y, startMonth, 1)
    const last = new Date(y, startMonth + 3, 0)
    const buckets = [0, 1, 2].map((offset) => {
      const mm = startMonth + offset
      const sIso = toIsoDate(new Date(y, mm, 1))
      const eIso = toIsoDate(new Date(y, mm + 1, 0))
      return {
        key: `m${mm + 1}`,
        label: `Tháng ${mm + 1}/${y}`,
        match: (invDate) => invDate >= sIso && invDate <= eIso,
      }
    })
    return {
      start: toIsoDate(first),
      end: toIsoDate(last),
      label: `Quý ${q + 1}/${y}`,
      shortLabel: 'Theo quý',
      buckets,
    }
  }

  if (mode === 'year') {
    const first = `${y}-01-01`
    const last = `${y}-12-31`
    const buckets = Array.from({ length: 12 }, (_, idx) => {
      const prefix = `${y}-${String(idx + 1).padStart(2, '0')}`
      return {
        key: prefix,
        label: `T${idx + 1}`,
        match: (invDate) => invDate.startsWith(prefix),
      }
    })
    return {
      start: first,
      end: last,
      label: `Năm ${y}`,
      shortLabel: 'Theo năm',
      buckets,
    }
  }

  if (mode === 'custom') {
    const sStr = customStart <= customEnd ? customStart : customEnd
    const eStr = customStart <= customEnd ? customEnd : customStart
    const [sy, sm, sd] = sStr.split('-').map(Number)
    const [ey, em, ed] = eStr.split('-').map(Number)
    const sDate = new Date(sy, sm - 1, sd)
    const eDate = new Date(ey, em - 1, ed)
    const diffDays = Math.max(1, Math.round((eDate - sDate) / 86400000) + 1)

    const buckets = []
    if (diffDays <= 14) {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(sDate)
        d.setDate(sDate.getDate() + i)
        const dIso = toIsoDate(d)
        buckets.push({
          key: dIso,
          label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          match: (invDate) => invDate === dIso,
        })
      }
    } else if (diffDays <= 62) {
      let cur = new Date(sDate)
      while (cur <= eDate) {
        const bStart = new Date(cur)
        const bEnd = new Date(cur)
        bEnd.setDate(bStart.getDate() + 6)
        if (bEnd > eDate) bEnd.setTime(eDate.getTime())
        const sIso = toIsoDate(bStart)
        const eIso = toIsoDate(bEnd)
        buckets.push({
          key: sIso,
          label: `${String(bStart.getDate()).padStart(2, '0')}/${String(bStart.getMonth() + 1).padStart(2, '0')}`,
          match: (invDate) => invDate >= sIso && invDate <= eIso,
        })
        cur.setDate(cur.getDate() + 7)
      }
    } else {
      let cur = new Date(sy, sm - 1, 1)
      const endMonth = new Date(ey, em - 1, 1)
      while (cur <= endMonth) {
        const ym = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
        buckets.push({
          key: ym,
          label: `${String(cur.getMonth() + 1).padStart(2, '0')}/${cur.getFullYear()}`,
          match: (invDate) => invDate >= sStr && invDate <= eStr && invDate.startsWith(ym),
        })
        cur.setMonth(cur.getMonth() + 1)
      }
    }

    return {
      start: sStr,
      end: eStr,
      label: `${formatShortDate(sDate)} – ${formatShortDate(eDate)}`,
      shortLabel: 'Khoảng ngày',
      buckets,
    }
  }

  // 'all'
  const months = Array.from(
    new Set(allInvoices.map((i) => (i.ngay_lap || '').slice(0, 7)).filter(Boolean))
  ).sort()
  const buckets = (months.length ? months : [toIsoDate(anchor).slice(0, 7)]).map((ym) => ({
    key: ym,
    label: `${ym.slice(5, 7)}/${ym.slice(0, 4)}`,
    match: (invDate) => invDate.startsWith(ym),
  }))
  return {
    start: null,
    end: null,
    label: 'Tất cả thời gian',
    shortLabel: 'Tất cả',
    buckets,
  }
}

function summarizeGroup(list) {
  const count = list.length
  const total = list.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0)
  const hasExplicitAmounts = list.some((i) => i.tong_truoc_vat != null || i.vat != null)
  let beforeVat = 0
  let vat = 0
  if (hasExplicitAmounts) {
    beforeVat = list.reduce((s, i) => s + (Number(i.tong_truoc_vat) || 0), 0)
    vat = list.reduce((s, i) => s + (Number(i.vat ?? i.tien_thue_vat) || 0), 0)
  } else {
    beforeVat = Math.round(total / 1.1)
    vat = total - beforeVat
  }
  return { count, total, beforeVat, vat }
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [timeStr, setTimeStr] = useState('')
  const [periodMode, setPeriodMode] = useState('custom')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [customStart, setCustomStart] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [customEnd, setCustomEnd] = useState(() => toIsoDate(new Date()))

  function loadDashboardData() {
    setTimeStr(new Date().toTimeString().slice(0, 8))
    apiFetch('/hoa-don')
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {})
    apiFetch('/nha-cung-cap')
      .then((data) => setSuppliers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const periodMeta = useMemo(
    () => getPeriodMeta(periodMode, anchorDate, invoices, customStart, customEnd),
    [periodMode, anchorDate, invoices, customStart, customEnd]
  )

  const filteredInvoices = useMemo(() => {
    if (!periodMeta.start || !periodMeta.end) return invoices
    return invoices.filter((i) => {
      const d = (i.ngay_lap || '').slice(0, 10)
      return d >= periodMeta.start && d <= periodMeta.end
    })
  }, [invoices, periodMeta])

  const allStats = useMemo(() => summarizeGroup(filteredInvoices), [filteredInvoices])
  const matchedStats = useMemo(
    () => summarizeGroup(filteredInvoices.filter((i) => ['MATCHED', 'RECONCILED'].includes(i.trang_thai))),
    [filteredInvoices]
  )
  const mismatchStats = useMemo(
    () => summarizeGroup(filteredInvoices.filter((i) => i.trang_thai === 'MISMATCH')),
    [filteredInvoices]
  )
  const pendingStats = useMemo(
    () => summarizeGroup(filteredInvoices.filter((i) => ['PARTIAL', 'CHUA_DOI_SOAT'].includes(i.trang_thai))),
    [filteredInvoices]
  )

  // Trend chart buckets (use all invoices so day-mode 5-day comparison works cleanly)
  const trendBuckets = useMemo(() => {
    return periodMeta.buckets.map((b) => {
      const items = invoices.filter((i) => b.match((i.ngay_lap || '').slice(0, 10)))
      const amount = items.reduce((s, i) => s + (Number(i.tong_thanh_toan) || 0), 0)
      return {
        ...b,
        count: items.length,
        amount,
      }
    })
  }, [periodMeta, invoices])

  // Donut breakdown by supplier
  const supplierBreakdown = useMemo(() => {
    const nccMap = Object.fromEntries(suppliers.map((s) => [s.id, s.ten]))
    const totals = new Map()
    for (const inv of filteredInvoices) {
      const name = nccMap[inv.nha_cung_cap_id] || `NCC #${inv.nha_cung_cap_id}`
      totals.set(name, (totals.get(name) || 0) + (Number(inv.tong_thanh_toan) || 0))
    }
    const sorted = Array.from(totals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)

    const top = sorted.slice(0, 4)
    const restAmount = sorted.slice(4).reduce((s, x) => s + x.amount, 0)
    if (restAmount > 0) {
      top.push({ name: 'Nhà cung cấp khác', amount: restAmount })
    }
    const sum = top.reduce((s, x) => s + x.amount, 0) || 1
    return top.map((item, idx) => ({
      ...item,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
      pct: Math.round((item.amount * 100) / sum),
      ratio: item.amount / sum,
    }))
  }, [filteredInvoices, suppliers])

  // SVG chart geometry
  const maxCount = Math.max(...trendBuckets.map((b) => b.count), 1)
  const maxAmount = Math.max(...trendBuckets.map((b) => b.amount), 1)
  const chartLeft = 42
  const chartRight = 516
  const chartTop = 28
  const chartBottom = 178
  const chartHeight = chartBottom - chartTop
  const stepX = (chartRight - chartLeft) / Math.max(trendBuckets.length, 1)

  const linePoints = trendBuckets.map((b, idx) => {
    const x = chartLeft + stepX * idx + stepX / 2
    const y = chartBottom - (b.amount / maxAmount) * (chartHeight - 12)
    return { x, y, ...b }
  })

  const pathD = linePoints.length
    ? linePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : ''

  const circumference = 2 * Math.PI * 62 // r = 62 -> ~389.56
  let runningOffset = 0

  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => {
    const years = new Set()
    for (let y = currentYear - 5; y <= currentYear + 2; y++) years.add(y)
    invoices.forEach((i) => {
      const y = Number((i.ngay_lap || '').slice(0, 4))
      if (y) years.add(y)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [currentYear, invoices])

  const pickerStyle = {
    border: '1px solid #cbd5e1',
    borderRadius: 0,
    padding: '4px 8px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#0f172a',
    background: '#ffffff',
    cursor: 'pointer',
  }

  function renderDirectPicker() {
    if (periodMode === 'day') {
      return (
        <input
          type="date"
          style={pickerStyle}
          value={toIsoDate(anchorDate)}
          onChange={(e) => {
            if (!e.target.value) return
            const [y, m, d] = e.target.value.split('-').map(Number)
            setAnchorDate(new Date(y, m - 1, d))
          }}
        />
      )
    }
    if (periodMode === 'week') {
      return (
        <input
          type="week"
          style={pickerStyle}
          value={toIsoWeek(anchorDate)}
          onChange={(e) => {
            const parsed = fromIsoWeek(e.target.value)
            if (parsed) setAnchorDate(parsed)
          }}
        />
      )
    }
    if (periodMode === 'month') {
      const ym = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`
      return (
        <input
          type="month"
          style={pickerStyle}
          value={ym}
          onChange={(e) => {
            if (!e.target.value) return
            const [y, m] = e.target.value.split('-').map(Number)
            setAnchorDate(new Date(y, m - 1, 1))
          }}
        />
      )
    }
    if (periodMode === 'quarter') {
      const q = Math.floor(anchorDate.getMonth() / 3) + 1
      const y = anchorDate.getFullYear()
      return (
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <select
            style={pickerStyle}
            value={q}
            onChange={(e) => setAnchorDate(new Date(y, (Number(e.target.value) - 1) * 3, 1))}
          >
            <option value={1}>Quý 1</option>
            <option value={2}>Quý 2</option>
            <option value={3}>Quý 3</option>
            <option value={4}>Quý 4</option>
          </select>
          <select
            style={pickerStyle}
            value={y}
            onChange={(e) => setAnchorDate(new Date(Number(e.target.value), (q - 1) * 3, 1))}
          >
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      )
    }
    if (periodMode === 'year') {
      return (
        <select
          style={pickerStyle}
          value={anchorDate.getFullYear()}
          onChange={(e) => setAnchorDate(new Date(Number(e.target.value), anchorDate.getMonth(), 1))}
        >
          {yearOptions.map((yr) => (
            <option key={yr} value={yr}>Năm {yr}</option>
          ))}
        </select>
      )
    }
    if (periodMode === 'custom') {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Từ</span>
          <input
            type="date"
            style={pickerStyle}
            value={customStart}
            onChange={(e) => e.target.value && setCustomStart(e.target.value)}
          />
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>đến</span>
          <input
            type="date"
            style={pickerStyle}
            value={customEnd}
            onChange={(e) => e.target.value && setCustomEnd(e.target.value)}
          />
        </div>
      )
    }
    return null
  }

  function renderCardFilter() {
    return (
      <div className="kpi-filter-box">
        <div className="kpi-filter-time" onClick={loadDashboardData} title="Làm mới dữ liệu">
          <span>{periodMode === 'all' ? 'Tất cả' : 'Khoảng ngày'}</span>
          <span className="kpi-reload-icon">↺</span>
        </div>
        <span className="kpi-update-time">Cập nhật đến {timeStr}</span>
      </div>
    )
  }

  return (
    <div className="misa-dashboard-page">
      <div className="misa-page-topbar" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="dashboard-title">Tổng quan hệ thống</h1>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Kỳ hiển thị: <strong style={{ color: '#0f172a' }}>{periodMeta.label}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>Từ</span>
            <input
              type="date"
              style={pickerStyle}
              value={customStart}
              onChange={(e) => {
                if (!e.target.value) return
                setCustomStart(e.target.value)
                setPeriodMode('custom')
              }}
            />
            <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>đến</span>
            <input
              type="date"
              style={pickerStyle}
              value={customEnd}
              onChange={(e) => {
                if (!e.target.value) return
                setCustomEnd(e.target.value)
                setPeriodMode('custom')
              }}
            />
          </div>

          <button
            type="button"
            className={`button ${periodMode === 'all' ? 'button-primary' : 'button-secondary'}`}
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={() => setPeriodMode((m) => (m === 'all' ? 'custom' : 'all'))}
          >
            Tất cả
          </button>

          <button
            type="button"
            className="button button-secondary"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={loadDashboardData}
          >
            ↻ Làm mới
          </button>
        </div>
      </div>

      {/* HÀNG 4 THẺ THỐNG KÊ HÓA ĐƠN */}
      <div className="misa-kpi-grid">
        {/* THẺ 1: TỔNG HÓA ĐƠN ĐÃ XỬ LÝ */}
        <div className="misa-kpi-card card-blue">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap blue">
              <span className="kpi-doc-icon">📄</span>
            </div>
            {renderCardFilter()}
          </div>

          <div className="kpi-count-number">{allStats.count}</div>
          <div className="kpi-status-title">Tổng hóa đơn trong kỳ</div>
          <div className="kpi-color-bar bar-blue"></div>

          <div className="kpi-details-list">
            <div className="kpi-detail-row">
              <span>Trước thuế GTGT:</span>
              <strong>{allStats.beforeVat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi-detail-row">
              <span>Thuế GTGT:</span>
              <strong>{allStats.vat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
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
              <strong className="amount-blue">{allStats.total.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>

        {/* THẺ 2: HÓA ĐƠN HỢP LỆ */}
        <div className="misa-kpi-card card-green">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap green">
              <span className="kpi-doc-icon">✓</span>
            </div>
            {renderCardFilter()}
          </div>

          <div className="kpi-count-number">{matchedStats.count}</div>
          <div className="kpi-status-title">Hóa đơn hợp lệ (Khớp)</div>
          <div className="kpi-color-bar bar-green"></div>

          <div className="kpi-details-list">
            <div className="kpi-detail-row">
              <span>Trước thuế GTGT:</span>
              <strong>{matchedStats.beforeVat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi-detail-row">
              <span>Thuế GTGT:</span>
              <strong>{matchedStats.vat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
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
              <strong className="amount-green">{matchedStats.total.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>

        {/* THẺ 3: HÓA ĐƠN KHÔNG HỢP LỆ */}
        <div className="misa-kpi-card card-red">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap red">
              <span className="kpi-doc-icon">✕</span>
            </div>
            {renderCardFilter()}
          </div>

          <div className="kpi-count-number">{mismatchStats.count}</div>
          <div className="kpi-status-title">Hóa đơn không hợp lệ (Lệch)</div>
          <div className="kpi-color-bar bar-red"></div>

          <div className="kpi-details-list">
            <div className="kpi-detail-row">
              <span>Trước thuế GTGT:</span>
              <strong>{mismatchStats.beforeVat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi-detail-row">
              <span>Thuế GTGT:</span>
              <strong>{mismatchStats.vat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
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
              <strong className="amount-red">{mismatchStats.total.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>

        {/* THẺ 4: HÓA ĐƠN CHƯA ĐỐI SOÁT / MỘT PHẦN */}
        <div className="misa-kpi-card card-gray">
          <div className="kpi-card-header">
            <div className="kpi-icon-wrap gray">
              <span className="kpi-doc-icon">⏱</span>
            </div>
            {renderCardFilter()}
          </div>

          <div className="kpi-count-number">{pendingStats.count}</div>
          <div className="kpi-status-title">Chờ đối soát / Một phần</div>
          <div className="kpi-color-bar bar-gray"></div>

          <div className="kpi-details-list">
            <div className="kpi-detail-row">
              <span>Trước thuế GTGT:</span>
              <strong>{pendingStats.beforeVat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
            <div className="kpi-detail-row">
              <span>Thuế GTGT:</span>
              <strong>{pendingStats.vat.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
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
              <strong className="amount-gray">{pendingStats.total.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* HÀNG 2 BIỂU ĐỒ: CỘT KẾT HỢP ĐƯỜNG LINE + BIỂU ĐỒ TRÒN */}
      <div className="misa-charts-grid">
        {/* BIỂU ĐỒ BÊN TRÁI: TÌNH HÌNH NHẬN HÓA ĐƠN THEO THỜI GIAN */}
        <div className="misa-chart-card chart-trend">
          <div className="chart-card-header">
            <h3 className="chart-title">
              Tình hình nhận hóa đơn — {periodMeta.label}
            </h3>
            {renderCardFilter()}
          </div>

          {/* Dải số liệu tóm tắt trên đầu biểu đồ */}
          <div className="chart-summary-strip">
            <div>Số hóa đơn: <strong>{allStats.count}</strong></div>
            <div>Trước thuế GTGT: <strong>{(allStats.beforeVat / 1000000).toFixed(2)} triệu</strong></div>
            <div>Thuế GTGT: <strong>{(allStats.vat / 1000000).toFixed(2)} triệu</strong></div>
            <div>Tổng tiền TT: <strong>{(allStats.total / 1000000).toFixed(2)} triệu</strong></div>
          </div>

          {/* Vùng vẽ biểu đồ SVG kết hợp Cột & Đường */}
          <div className="chart-canvas-wrap">
            <svg viewBox="0 0 540 220" className="misa-svg-chart">
              <line x1="36" y1="30" x2="520" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="36" y1="80" x2="520" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="36" y1="130" x2="520" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="36" y1="178" x2="520" y2="178" stroke="#e2e8f0" />

              {linePoints.map((p) => {
                const barWidth = Math.min(24, Math.max(10, stepX * 0.45))
                const barHeight = p.count > 0 ? Math.max(6, (p.count / maxCount) * (chartHeight - 16)) : 3
                const barY = chartBottom - barHeight
                return (
                  <g key={p.key}>
                    <rect
                      x={p.x - barWidth / 2}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx="2"
                      fill="#00a884"
                      opacity={p.count > 0 ? (p.isHighlight ? 1 : 0.85) : 0.25}
                    >
                      <title>{`${p.label}: ${p.count} hóa đơn — ${p.amount.toLocaleString('vi-VN')} ₫`}</title>
                    </rect>
                    {p.count > 0 && (
                      <text
                        x={p.x}
                        y={barY - 5}
                        textAnchor="middle"
                        fill="#0f766e"
                        fontSize="10"
                        fontWeight="700"
                      >
                        {p.count}
                      </text>
                    )}
                    <text
                      x={p.x}
                      y="200"
                      textAnchor="middle"
                      fill={p.isHighlight ? '#0284c7' : '#64748b'}
                      fontWeight={p.isHighlight ? '700' : '400'}
                      fontSize={trendBuckets.length > 8 ? '9.5' : '11'}
                    >
                      {p.label}
                    </text>
                  </g>
                )
              })}

              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {linePoints.map((p) => (
                <circle
                  key={`pt-${p.key}`}
                  cx={p.x}
                  cy={p.y}
                  r={p.amount > 0 ? 4 : 2.5}
                  fill="#ffffff"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                >
                  <title>{`${p.label}: ${p.amount.toLocaleString('vi-VN')} ₫`}</title>
                </circle>
              ))}
            </svg>
          </div>

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

        {/* BIỂU ĐỒ BÊN PHẢI: TỔNG GIÁ TRỊ HÓA ĐƠN THEO NCC */}
        <div className="misa-chart-card chart-donut">
          <div className="chart-card-header">
            <h3 className="chart-title">Tổng giá trị hóa đơn theo NCC</h3>
            {renderCardFilter()}
          </div>

          <div className="donut-content-layout">
            <div className="donut-circle-wrap">
              <svg width="150" height="150" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="62" fill="none" stroke="#f1f5f9" strokeWidth="24" />
                {supplierBreakdown.map((seg) => {
                  const segLen = seg.ratio * circumference
                  const dashArray = `${segLen} ${circumference - segLen}`
                  const dashOffset = -runningOffset
                  runningOffset += segLen
                  return (
                    <circle
                      key={seg.name}
                      cx="80"
                      cy="80"
                      r="62"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="24"
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 80 80)"
                    >
                      <title>{`${seg.name}: ${seg.amount.toLocaleString('vi-VN')} ₫ (${seg.pct}%)`}</title>
                    </circle>
                  )
                })}
              </svg>
              <div className="donut-center-text">
                <strong>{(allStats.total / 1000000).toFixed(2)}</strong>
                <span>triệu</span>
              </div>
            </div>

            <div className="donut-legend-list">
              {supplierBreakdown.length === 0 ? (
                <div className="muted-cell" style={{ fontSize: 13 }}>
                  Chưa có hóa đơn nào trong {periodMeta.label.toLowerCase()}.
                </div>
              ) : (
                supplierBreakdown.map((seg) => (
                  <div key={seg.name} className="donut-legend-item" title={`${seg.name}: ${seg.amount.toLocaleString('vi-VN')} ₫`}>
                    <span className="dot" style={{ color: seg.color }}>●</span>
                    <span className="item-text">
                      {seg.name} <strong>({seg.pct}%)</strong>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
