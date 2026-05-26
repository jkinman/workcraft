import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container">
      <div className="card">
        <h1>[ERR] JOB_NOT_FOUND</h1>
        <p className="muted">No evaluation matched that route.</p>
        <Link className="btn" href="/">RETURN_TO_DASHBOARD</Link>
      </div>
    </main>
  );
}
