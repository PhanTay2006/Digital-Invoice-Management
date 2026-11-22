export default function ModulePlaceholderPage({ title, description }) {
  return (
    <section className="placeholder-page">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="placeholder-card">
        <div className="placeholder-icon">✦</div>
        <h2>{title} module</h2>
        <p>This page is ready for implementation. Components and API integration can be added here.</p>
        <span className="status-chip">Under development</span>
      </div>
    </section>
  )
}
