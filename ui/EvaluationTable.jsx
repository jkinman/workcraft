import Link from 'next/link';
import reportParser from '../report-parser';
import scoreModule from './score';

const { slugify } = reportParser;
const { scoreToGrade } = scoreModule;

export function EvaluationTable({ evaluations }) {
  if (!evaluations.length) {
    return <div className="card muted">No evaluations found.</div>;
  }

  return (
    <table className="job-table">
      <thead>
        <tr>
          <th>Status</th>
          <th>Score</th>
          <th>Role / Company</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>
        {evaluations.map(evaluation => {
          const grade = scoreToGrade(evaluation.score);
          const slug = slugify(evaluation.company, evaluation.url, evaluation.filename);

          return (
            <tr key={slug} className="job-row">
              <td>
                <span className={`status-badge ${evaluation.statusClass}`}>[{evaluation.state}]</span>
              </td>
              <td>
                <span className={`score-block ${grade.className}`}>
                  [{grade.grade}] {evaluation.score?.toFixed(1) || '?'}
                </span>
              </td>
              <td>
                <Link href={`/job/${slug}`}>
                  <strong>{evaluation.role}</strong>
                  <div className="muted">@{evaluation.company?.toUpperCase().replace(/\s+/g, '_')}</div>
                </Link>
              </td>
              <td className="muted">{evaluation.date || '--'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
