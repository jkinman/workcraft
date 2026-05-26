export function PipelineTable({ pipeline }) {
  const jobs = pipeline.pending || [];

  if (!jobs.length) {
    return <div className="card muted">No pending jobs in pipeline.</div>;
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Role / Company</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map(job => (
          <tr key={`${job.url}-${job.role}`} className="job-row">
            <td>
              <span className="status-badge status-pending">[{job.status}]</span>
            </td>
            <td>
              <strong>{job.role}</strong>
              <div className="muted">@{job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
            </td>
            <td>
              <a className="btn" href={job.url} target="_blank" rel="noreferrer">
                VIEW_RAW
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
