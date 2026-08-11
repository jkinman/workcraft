import Link from 'next/link';
import { headers } from 'next/headers';
import { Header } from '../../../ui/Header';
import { StrategyEditor } from '../../../ui/manage/StrategyEditor';
import tenantServices from '../../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function ManageStrategyPage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const strategy = services.settings.getStrategy();

  return (
    <>
      <Header stats={model.stats} activeView="manage" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <div className="nav-buttons">
          <Link className="btn" href="/manage">BACK_TO_MANAGE</Link>
        </div>
        <div className="section-title">AI Strategy</div>
        <StrategyEditor initialContent={strategy.content} />
      </main>
    </>
  );
}
