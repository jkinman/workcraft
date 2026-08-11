import Link from 'next/link';

export function NextActions({ checklist }) {
  const remaining = checklist.filter(item => !item.done).length;
  if (!remaining) return null;

  return (
    <section className="next-actions">
      <div className="section-title">Get started [{checklist.length - remaining}/{checklist.length}]</div>
      <div className="checklist">
        {checklist.map(item => (
          <Link key={item.id} href={item.href} className={`checklist-item ${item.done ? 'done' : ''}`}>
            <span className={`checklist-mark ${item.done ? 'status-applied' : 'status-pending'}`}>
              {item.done ? '[x]' : '[ ]'}
            </span>
            <span className="checklist-body">
              <strong>{item.label}</strong>
              <span className="muted">{item.detail}</span>
            </span>
            {!item.done ? <span className="checklist-cta">go &rarr;</span> : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
