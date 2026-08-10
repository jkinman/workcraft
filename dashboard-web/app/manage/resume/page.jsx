import Link from 'next/link';
import { headers } from 'next/headers';
import { Header } from '../../../ui/Header';
import { ResumeForm } from '../../../ui/manage/ResumeForm';
import tenantServices from '../../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

export default async function ManageResumePage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const resume = services.settings.getResumeStructured();

  return (
    <>
      <Header stats={model.stats} activeView="manage" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <div className="nav-buttons">
          <Link className="btn" href="/manage">BACK_TO_MANAGE</Link>
        </div>
        <div className="section-title">Resume Studio</div>
        <ResumeForm initialResume={resume.resume} />
      </main>
    </>
  );
}
