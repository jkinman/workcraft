import { headers } from 'next/headers';
import { Header } from '../../ui/Header';
import { QueueForm } from '../../ui/QueueForm';
import tenantServices from '../../lib/tenant-services';

const { getTenantDashboardModel } = tenantServices;

export default async function QueuePage() {
  const { tenant, model } = getTenantDashboardModel({ headers: await headers() });

  return (
    <>
      <Header stats={model.stats} activeView="queue" tenantId={tenant.tenantId} />
      <main className="container">
        <div className="section-title">Queue New Target</div>
        <QueueForm />
      </main>
    </>
  );
}
