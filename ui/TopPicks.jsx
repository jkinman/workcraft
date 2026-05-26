import Link from 'next/link';
import reportParser from '../report-parser';

const { slugify } = reportParser;

export function TopPicks({ evaluations }) {
  const topPicks = evaluations.filter(evaluation => evaluation.score >= 4.5).slice(0, 3);

  if (!topPicks.length) return null;

  return (
    <>
      <div className="section-title">Priority Targets [Apply Now]</div>
      <div className="top-picks">
        {topPicks.map(job => {
          const slug = slugify(job.company, job.url, job.filename);
          return (
            <Link className="top-pick-item" key={slug} href={`/job/${slug}`}>
              <span>
                <strong>{job.company}</strong>
                <div className="muted">{job.role}</div>
              </span>
              <span className="score-a">[ {job.score.toFixed(1)} ]</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
