const metrics = [
  { label: 'Total invoices', value: '2,480', change: '+12.8%', note: 'vs. last month', icon: '▤', tone: 'blue' },
  { label: 'Pending matching', value: '184', change: '+8.2%', note: 'vs. last month', icon: '⇄', tone: 'violet' },
  { label: 'Matched this month', value: '1,926', change: '+18.4%', note: 'vs. last month', icon: '✓', tone: 'green' },
  { label: 'Exceptions', value: '42', change: '-5.1%', note: 'vs. last month', icon: '⚑', tone: 'orange' },
]

const activities = [
  { id: 'INV-2026-0842', supplier: 'Global Supplies Ltd.', date: 'Nov 08, 2026', amount: '$12,450.00', status: 'Matched', tone: 'success' },
  { id: 'INV-2026-0841', supplier: 'TechSource Inc.', date: 'Nov 08, 2026', amount: '$8,200.00', status: 'Pending review', tone: 'warning' },
  { id: 'INV-2026-0840', supplier: 'Office Hub Co.', date: 'Nov 07, 2026', amount: '$3,680.50', status: 'Processing', tone: 'info' },
  { id: 'INV-2026-0839', supplier: 'Metro Logistics', date: 'Nov 07, 2026', amount: '$15,900.00', status: 'Mismatched', tone: 'danger' },
  { id: 'INV-2026-0838', supplier: 'Bright Systems', date: 'Nov 06, 2026', amount: '$6,125.00', status: 'Matched', tone: 'success' },
]

export default function DashboardPage() {
  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Good morning, Tay <span className="wave">✦</span></h1>
          <p className="page-description">Here’s what’s happening with your invoice operations today.</p>
        </div>
        <div className="heading-actions">
          <button className="button button-secondary" type="button">↓ Export report</button>
          <button className="button button-primary" type="button"><span>＋</span> Upload invoice</button>
        </div>
      </div>

      <div className="date-banner">
        <div className="date-banner-icon">◷</div>
        <div><strong>Monday, November 9, 2026</strong><span>Here is your daily operations snapshot.</span></div>
        <span className="live-indicator"><i /> LIVE OVERVIEW</span>
      </div>

      <div className="section-title-row">
        <div><h2>Performance overview</h2><p>Track your invoice workflow at a glance.</p></div>
        <button className="period-select" type="button">Last 30 days <span>⌄</span></button>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-top">
              <span className={`metric-icon ${metric.tone}`}>{metric.icon}</span>
              <button className="more-button" type="button" aria-label={`More about ${metric.label}`}>···</button>
            </div>
            <p className="metric-label">{metric.label}</p>
            <div className="metric-value-row"><strong>{metric.value}</strong><span className={`metric-change ${metric.tone}`}>{metric.change}</span></div>
            <p className="metric-note">{metric.note}</p>
          </article>
        ))}
      </div>

      <div className="dashboard-columns">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div><h2>Recent invoices</h2><p>Latest documents received in your workspace.</p></div>
            <a href="/invoices">View all <span>→</span></a>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>INVOICE</th><th>SUPPLIER</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
              <tbody>
                {activities.map((item) => (
                  <tr key={item.id}>
                    <td><strong className="invoice-id">{item.id}</strong></td>
                    <td>{item.supplier}</td>
                    <td className="muted-cell">{item.date}</td>
                    <td className="amount-cell">{item.amount}</td>
                    <td><span className={`status-pill ${item.tone}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel matching-panel">
          <div className="panel-heading"><div><h2>Matching health</h2><p>Current reconciliation status.</p></div><button className="more-button" type="button" aria-label="More options">···</button></div>
          <div className="matching-score">
            <div className="score-ring"><div><strong>92.4%</strong><span>Match rate</span></div></div>
          </div>
          <div className="match-legend">
            <div><span className="legend-dot matched-dot" /><span>Matched</span><strong>1,926</strong></div>
            <div><span className="legend-dot pending-dot" /><span>Pending review</span><strong>184</strong></div>
            <div><span className="legend-dot exception-dot" /><span>Exceptions</span><strong>42</strong></div>
          </div>
          <a className="panel-link" href="/matching">Open matching center <span>→</span></a>
        </section>
      </div>
    </section>
  )
}
