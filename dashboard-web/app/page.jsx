import { headers } from 'next/headers';
import { Header } from '../ui/Header';
import { EvaluationTable } from '../ui/EvaluationTable';
import { PipelineTable } from '../ui/PipelineTable';
import { TopPicks } from '../ui/TopPicks';
import { WelcomeHero } from '../ui/home/WelcomeHero';
import { NextActions } from '../ui/home/NextActions';
import { ActivityFeed } from '../ui/home/ActivityFeed';
import { OnboardingWizard } from '../ui/onboarding/OnboardingWizard';
import tenantServices from '../lib/tenant-services';
import onboardingService from '../lib/services/onboarding-service';

const { getTenantHomeModel } = tenantServices;
const { presetOptions, SENIORITY_OPTIONS, WORK_MODE_OPTIONS } = onboardingService;

export default async function DashboardPage({ searchParams }) {
  const { tenant, home } = await getTenantHomeModel({ headers: await headers() });
  const params = await searchParams;
  const view = params?.view === 'pipeline' ? 'pipeline' : 'ranked';
  const showAuth = tenant.tenantSource === 'auth';

  if (home.needsOnboarding && view !== 'pipeline') {
    return (
      <>
        <Header activeView="ranked" tenantId={tenant.tenantId} showAuth={showAuth} />
        <main className="container">
          <OnboardingWizard
            authEnabled={showAuth}
            options={{
              roleFocus: presetOptions(),
              seniority: SENIORITY_OPTIONS,
              workModes: WORK_MODE_OPTIONS
            }}
            initialAnswers={null}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <Header stats={home.stats} activeView={view} tenantId={tenant.tenantId} showAuth={showAuth} />
      <main className="container">
        {view === 'pipeline' ? (
          <>
            <div className="section-title">Raw Pipeline ({home.pipeline.total} jobs)</div>
            <PipelineTable pipeline={home.pipeline} />
          </>
        ) : (
          <>
            <WelcomeHero greeting={home.greeting} name={home.name} primaryAction={home.primaryAction} />
            <NextActions checklist={home.checklist} />
            <TopPicks evaluations={home.evaluations} />
            <ActivityFeed activity={home.activity} />
            <div className="section-title">Ranked Evaluations</div>
            <EvaluationTable evaluations={home.evaluations} />
          </>
        )}
      </main>
    </>
  );
}
