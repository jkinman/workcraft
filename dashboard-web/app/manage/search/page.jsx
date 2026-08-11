import Link from 'next/link';
import { headers } from 'next/headers';
import { Header } from '../../../ui/Header';
import { SearchSettingsForm } from '../../../ui/manage/SearchSettingsForm';
import tenantServices from '../../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function ManageSearchPage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const portals = services.settings.getPortalsStructured();

  return (
    <>
      <Header stats={model.stats} activeView="manage" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <div className="nav-buttons">
          <Link className="btn" href="/manage">BACK_TO_MANAGE</Link>
        </div>
        <div className="section-title">Search Settings</div>
        <SearchSettingsForm initialPortals={portals.portals} />
      </main>
    </>
  );
}
