const yaml = require('js-yaml');
const { isOnboarded } = require('./onboarding-service');

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstName(profileContent) {
  if (!profileContent) return null;
  try {
    const parsed = yaml.load(profileContent);
    const fullName = parsed?.candidate?.full_name;
    if (typeof fullName !== 'string' || !fullName.trim()) return null;
    return fullName.trim().split(/\s+/)[0];
  } catch (error) {
    return null;
  }
}

function buildChecklist({ files, hasLeads }) {
  return [
    {
      id: 'search',
      label: 'Tell us what you want',
      detail: 'Location, work style, and target roles',
      done: files.profile && files.portals,
      href: '/'
    },
    {
      id: 'resume',
      label: 'Add your resume',
      detail: 'Used to tailor every CV and evaluation',
      done: files.cv,
      href: '/manage/resume'
    },
    {
      id: 'leads',
      label: 'Get your first leads',
      detail: 'Scan job portals or queue a role',
      done: hasLeads,
      href: '/scan'
    }
  ];
}

function derivePrimaryAction({ needsOnboarding, files, hasLeads, pendingJobs, unappliedPriority }) {
  if (needsOnboarding) {
    return {
      id: 'onboarding',
      headline: 'Set up your job search',
      detail: 'Tell us where you want to work and what roles you want.',
      cta: 'Start setup',
      href: '/'
    };
  }
  if (!files.cv) {
    return {
      id: 'resume',
      headline: 'Add your resume',
      detail: 'We use it to tailor CVs and score how well each job fits.',
      cta: 'Add resume',
      href: '/manage/resume'
    };
  }
  if (!hasLeads) {
    return {
      id: 'scan',
      headline: 'Find your first matches',
      detail: 'Run a scan across job portals or queue a role you already found.',
      cta: 'Run a scan',
      href: '/scan'
    };
  }
  if (pendingJobs > 0) {
    return {
      id: 'evaluate',
      headline: `${pendingJobs} job${pendingJobs === 1 ? '' : 's'} waiting to be evaluated`,
      detail: 'Score them to see which ones are worth your time.',
      cta: 'Review queue',
      href: '/queue'
    };
  }
  if (unappliedPriority > 0) {
    return {
      id: 'apply',
      headline: `${unappliedPriority} strong match${unappliedPriority === 1 ? '' : 'es'} ready to apply`,
      detail: 'These scored highest against your profile.',
      cta: 'See priority targets',
      href: '/'
    };
  }
  return {
    id: 'review',
    headline: "You're all caught up",
    detail: 'Review your pipeline or run a fresh scan to find new roles.',
    cta: 'Run a scan',
    href: '/scan'
  };
}

function buildActivity({ scanStats, evaluations, pendingJobs, unappliedPriority }) {
  const activity = [];

  if (scanStats.lastScanDate) {
    activity.push({
      id: 'last-scan',
      label: `Last scan ${scanStats.lastScanDate}`,
      detail: `${scanStats.recentScans?.length || 0} roles seen, ${scanStats.totalScanned} tracked all-time`,
      href: '/scan'
    });
  }

  if (pendingJobs > 0) {
    activity.push({
      id: 'pending',
      label: `${pendingJobs} job${pendingJobs === 1 ? '' : 's'} in the queue`,
      detail: 'Waiting to be evaluated',
      href: '/queue'
    });
  }

  if (unappliedPriority > 0) {
    activity.push({
      id: 'priority',
      label: `${unappliedPriority} priority target${unappliedPriority === 1 ? '' : 's'}`,
      detail: 'Scored 4.5+ and not applied yet',
      href: '/'
    });
  }

  if (evaluations.length) {
    activity.push({
      id: 'evaluated',
      label: `${evaluations.length} evaluation${evaluations.length === 1 ? '' : 's'} total`,
      detail: scanStats.companiesEnabled
        ? `${scanStats.companiesEnabled} companies tracked`
        : 'Across your pipeline',
      href: '/?view=pipeline'
    });
  }

  return activity;
}

function getHomeModel(services) {
  const { dataClient, reports, pipeline, scan, setup } = services;

  const profileContent = dataClient.readProfile();
  const needsOnboarding = !isOnboarded(profileContent);

  const setupStatus = setup.getStatus();
  const evaluations = reports.listEvaluations();
  const pipelineModel = pipeline.list();
  const scanStats = scan.getStats();

  const stats = {
    dream: evaluations.filter(evaluation => evaluation.score >= 4.5).length,
    strong: evaluations.filter(evaluation => evaluation.score >= 4.0 && evaluation.score < 4.5).length,
    good: evaluations.filter(evaluation => evaluation.score >= 3.5 && evaluation.score < 4.0).length,
    total: evaluations.length
  };

  const pendingJobs = pipelineModel.pending?.length || 0;
  const hasLeads = evaluations.length > 0 || pipelineModel.total > 0;

  const isApplied = state => typeof state === 'string' && /appl/i.test(state);
  const unappliedPriority = evaluations.filter(
    evaluation => evaluation.score >= 4.5 && !isApplied(evaluation.state)
  ).length;

  const topPicks = evaluations.filter(evaluation => evaluation.score >= 4.5).slice(0, 3);

  return {
    greeting: timeGreeting(),
    name: firstName(profileContent),
    needsOnboarding,
    primaryAction: derivePrimaryAction({
      needsOnboarding,
      files: setupStatus.files,
      hasLeads,
      pendingJobs,
      unappliedPriority
    }),
    checklist: buildChecklist({ files: setupStatus.files, hasLeads }),
    checklistComplete: setupStatus.files.cv && setupStatus.files.profile && setupStatus.files.portals && hasLeads,
    activity: buildActivity({ scanStats, evaluations, pendingJobs, unappliedPriority }),
    stats,
    evaluations,
    pipeline: pipelineModel,
    topPicks,
    setupStatus
  };
}

module.exports = {
  buildActivity,
  buildChecklist,
  derivePrimaryAction,
  getHomeModel,
  timeGreeting
};
