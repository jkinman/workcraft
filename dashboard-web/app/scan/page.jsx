import Link from 'next/link';
import { headers } from 'next/headers';
import { Header } from '../../ui/Header';
import { ScanControls } from '../../ui/ScanControls';
import { SetupPanel } from '../../ui/SetupPanel';
import tenantServices from '../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function ScanPage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const stats = services.scan.getStats();
  const setupStatus = services.setup.getStatus();

  return (
    <>
      <Header stats={model.stats} activeView="scan" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <SetupPanel status={setupStatus} title="Scanner setup" />

        <div className="section-title">Scan Controls</div>
        <ScanControls disabled={!setupStatus.ready.scan} />

        <div className="section-title">System Metrics</div>
        <section className="stat-grid">
          <Metric label="Total Jobs Scanned" value={stats.totalScanned.toLocaleString()} />
          <Metric label="Pending Evaluation" value={stats.pendingJobs} />
          <Metric label="Evaluations Done" value={stats.totalEvaluated} />
          <Metric label="Last Scan" value={stats.lastScanDate || 'Never'} />
        </section>

        <div className="section-title">Portal Breakdown</div>
        <div className="card">
          {Object.keys(stats.portalBreakdown).length ? (
            Object.entries(stats.portalBreakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([portal, count]) => (
                <div className="activity-row" key={portal}>
                  <span className="portal-badge">{portal.replace('-api', '').toUpperCase()}</span>
                  <strong>{count}</strong>
                </div>
              ))
          ) : (
            <span className="muted">No scan history yet.</span>
          )}
        </div>

        <div className="section-title">Pending Pipeline ({stats.pendingJobs})</div>
        <div className="card scroll-list">
          {stats.pipelineJobs.length ? (
            stats.pipelineJobs.map(job => (
              <div className="activity-row" key={`${job.url}-${job.role}`}>
                <strong>{job.company}</strong>
                <span>{job.role}</span>
                <a href={job.url} target="_blank" rel="noreferrer">VIEW</a>
              </div>
            ))
          ) : (
            <span className="muted">Pipeline empty.</span>
          )}
        </div>

        <div className="section-title">Recent Evaluations ({stats.recentEvaluations.length})</div>
        <div className="card">
          {stats.recentEvaluations.map(evaluation => (
            <div className="activity-row" key={evaluation.filename}>
              <strong>{evaluation.company}</strong>
              <span>{evaluation.role}</span>
              <Link href={`/job/${evaluation.filename.replace('.md', '')}`}>OPEN</Link>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card">
      <div className="muted">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
