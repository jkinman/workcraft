import { headers } from 'next/headers';
import { Header } from '../../ui/Header';
import { QueueForm } from '../../ui/QueueForm';
import { SetupPanel } from '../../ui/SetupPanel';
import tenantServices from '../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function QueuePage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const setupStatus = services.setup.getStatus();

  return (
    <>
      <Header stats={model.stats} activeView="queue" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <SetupPanel status={setupStatus} title="Queue setup" />

        <div className="section-title">Queue New Target</div>
        <QueueForm />
      </main>
    </>
  );
}
