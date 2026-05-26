import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Header } from '../../../ui/Header';
import { JobActions } from '../../../ui/JobActions';
import { StateTransitionControls } from '../../../ui/StateTransitionControls';
import scoreModule from '../../../ui/score';
import tenantServices from '../../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;
const { scoreToGrade } = scoreModule;

export default async function JobDetailPage({ params }) {
  const requestContext = { headers: await headers() };
  const { slug } = await params;
  const { tenant, model } = getTenantDashboardModel(requestContext);
  const { services } = getTenantServices(requestContext);
  const job = services.reports.getBySlug(slug);

  if (!job) notFound();

  const rawReport = services.reports.getRawContent(slug);
  const renderedReport = rawReport ? services.reports.renderMarkdownToHtml(rawReport) : '';
  const stateData = services.state.get(slug);
  const stateInfo = services.state.getStateMeta(stateData.state);
  const nextStates = services.state.getNextStates(stateData.state);
  const grade = scoreToGrade(job.score);

  return (
    <>
      <Header stats={model.stats} activeView="ranked" tenantId={tenant.tenantId} />
      <main className="container">
        <div className="card">
          <div className="grid-two">
            <div>
              <div className="muted">TARGET</div>
              <h1>{job.role}</h1>
              <div className="muted">@{job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
              {job.archetype ? <div className="score-c">{job.archetype}</div> : null}
            </div>
            <div>
              <div className={`stat-value ${grade.className}`}>{job.score}/5.0</div>
              <div className="muted">[{grade.grade}] {job.verdict || 'EVALUATE'}</div>
            </div>
          </div>

          <div className="grid-two">
            <div className="card">
              <div className="muted">COMPENSATION</div>
              <div>{job.comp || 'Not specified'}</div>
            </div>
            <div className="card">
              <div className="muted">LOCATION</div>
              <div>{job.location || 'Not specified'}</div>
            </div>
          </div>

          <div className="card">
            <div className="muted">CURRENT STATE</div>
            <strong style={{ color: stateInfo.color }}>[ {stateInfo.label} ]</strong>
            <div className="muted">
              {stateData.history.length
                ? stateData.history.map(item => `${item.state} -> ${item.date}`).join(' | ')
                : 'No transitions yet'}
            </div>
            <StateTransitionControls slug={slug} nextStates={nextStates} />
          </div>

          <div className="nav-buttons">
            <a className="btn btn-success" href={job.url || '#'} target="_blank" rel="noreferrer">
              VIEW_JOB_POSTING
            </a>
            <Link className="btn" href="/">BACK_TO_DASHBOARD</Link>
          </div>
        </div>

        <div className="section-title">Exports</div>
        <div className="card">
          <JobActions company={job.company} role={job.role} slug={slug} archetype={job.archetype} />
        </div>

        <div className="section-title">Full Evaluation Report</div>
        <article className="card report-body" dangerouslySetInnerHTML={{ __html: renderedReport }} />
      </main>
    </>
  );
}
