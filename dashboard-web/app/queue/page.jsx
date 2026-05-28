import { headers } from 'next/headers';
import { Header } from '../../ui/Header';
import { QueueForm } from '../../ui/QueueForm';
import { SetupPanel } from '../../ui/SetupPanel';
import tenantServices from '../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function QueuePage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = getTenantDashboardModel(requestContext);
  const { services } = getTenantServices(requestContext);
  const setupStatus = services.setup.getStatus();

  return (
    <>
      <Header stats={model.stats} activeView="queue" tenantId={tenant.tenantId} />
      <main className="container">
        <SetupPanel status={setupStatus} title="Queue setup" />

        <div className="section-title">Queue New Target</div>
        <QueueForm />
      </main>
    </>
  );
}
