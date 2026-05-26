import Link from 'next/link';

export function Header({ stats, activeView = 'ranked', tenantId = 'local-dev' }) {
  const navItems = [
    { id: 'ranked', href: '/', label: 'analytics /eval' },
    { id: 'pipeline', href: '/?view=pipeline', label: 'list_alt /tracker' },
    { id: 'scan', href: '/scan', label: 'radar /scan' },
    { id: 'queue', href: '/queue', label: 'add /queue' }
  ];

  return (
    <header className="header">
      <div className="header-top">
        <div>
          <h1 className="brand-title">
            <Link href="/">~/career-ops/dashboard</Link>
          </h1>
          <div className="breadcrumb">/{activeView}</div>
          <div className="tenant-pill">tenant: {tenantId}</div>
        </div>
        <nav className="nav-buttons" aria-label="Dashboard navigation">
          {navItems.map(item => (
            <Link key={item.id} href={item.href} className={`nav-btn ${activeView === item.id ? 'active' : ''}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {stats ? (
        <div className="stats-bar">
          <div className="stat-cell">
            <span className="stat-value dream">{stats.dream}</span>
            <span className="muted">DREAM [A]</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value strong">{stats.strong}</span>
            <span className="muted">STRONG [B]</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value good">{stats.good}</span>
            <span className="muted">GOOD [C]</span>
          </div>
          <div className="stat-cell">
            <span className="stat-value">{stats.total}</span>
            <span className="muted">TOTAL EVAL</span>
          </div>
        </div>
      ) : null}
    </header>
  );
}
