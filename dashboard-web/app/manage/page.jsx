import Link from 'next/link';
import { headers } from 'next/headers';
import { Header } from '../../ui/Header';
import { SetupPanel } from '../../ui/SetupPanel';
import { AssetList } from '../../ui/manage/AssetList';
import tenantServices from '../../lib/tenant-services';

const { getTenantDashboardModel, getTenantServices } = tenantServices;

const SECTIONS = [
  { href: '/manage/resume', title: 'Resume Studio', desc: 'Import, edit fields, preview, export PDF' },
  { href: '/manage/profile', title: 'Profile', desc: 'Candidate, target roles, comp, location' },
  { href: '/manage/search', title: 'Search Settings', desc: 'Title filters, queries, tracked companies' },
  { href: '/manage/strategy', title: 'AI Strategy', desc: 'Free-text prompt: archetypes, narrative, scripts' }
];

export default async function ManagePage() {
  const requestContext = { headers: await headers() };
  const { tenant, model } = await getTenantDashboardModel(requestContext);
  const { services } = await getTenantServices(requestContext);
  const setupStatus = services.setup.getStatus();
  const assets = services.settings.listAssets();

  return (
    <>
      <Header stats={model.stats} activeView="manage" tenantId={tenant.tenantId} showAuth={tenant.tenantSource === 'auth'} />
      <main className="container">
        <SetupPanel status={setupStatus} title="Customization setup" />

        <div className="section-title">Customize Your Search</div>
        <div className="manage-grid">
          {SECTIONS.map(section => (
            <Link className="card manage-card" href={section.href} key={section.href}>
              <strong>{section.title}</strong>
              <div className="muted">{section.desc}</div>
            </Link>
          ))}
        </div>

        <div className="section-title">Generated Files</div>
        <AssetList files={assets.files} />
      </main>
    </>
  );
}
