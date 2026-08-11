import Link from 'next/link';

export function ActivityFeed({ activity }) {
  return (
    <section className="activity-feed">
      <div className="section-title">What&apos;s new</div>
      {activity.length ? (
        <div className="activity-list">
          {activity.map(item => (
            <Link key={item.id} href={item.href} className="activity-row activity-link">
              <span className="activity-main">{item.label}</span>
              <span className="muted">{item.detail}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card muted">
          No activity yet. Run a scan or queue a role to start filling your pipeline.
        </div>
      )}
    </section>
  );
}
