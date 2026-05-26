import { headers } from 'next/headers';
import { Header } from '../ui/Header';
import { EvaluationTable } from '../ui/EvaluationTable';
import { PipelineTable } from '../ui/PipelineTable';
import { TopPicks } from '../ui/TopPicks';
import tenantServices from '../lib/tenant-services';

const { getTenantDashboardModel } = tenantServices;

export default async function DashboardPage({ searchParams }) {
  const { tenant, model } = getTenantDashboardModel({ headers: await headers() });
  const params = await searchParams;
  const view = params?.view === 'pipeline' ? 'pipeline' : 'ranked';

  return (
    <>
      <Header stats={model.stats} activeView={view} tenantId={tenant.tenantId} />
      <main className="container">
        {view === 'pipeline' ? (
          <>
            <div className="section-title">Raw Pipeline ({model.pipeline.total} jobs)</div>
            <PipelineTable pipeline={model.pipeline} />
          </>
        ) : (
          <>
            <TopPicks evaluations={model.evaluations} />
            <div className="section-title">Ranked Evaluations</div>
            <EvaluationTable evaluations={model.evaluations} />
          </>
        )}
      </main>
    </>
  );
}
