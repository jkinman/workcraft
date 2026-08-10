const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const CONFIG = require('../../config');
const { EMPTY_PIPELINE } = require('./setup-service');

// Role focus presets map a friendly choice to scanner title keywords.
// Tech presets come first (primary audience); other industries follow.
// This list is purely additive — adding industries never changes tech behavior.
const ROLE_PRESETS = {
  // -- Technology --
  'ai-ml': {
    label: 'AI / ML Engineering',
    keywords: ['AI', 'ML', 'LLM', 'Agent', 'Agentic', 'GenAI', 'Generative AI', 'NLP', 'MLOps']
  },
  software: {
    label: 'Software Engineering',
    keywords: ['Software Engineer', 'Backend', 'Frontend', 'Full Stack', 'Platform Engineer']
  },
  data: {
    label: 'Data',
    keywords: ['Data Engineer', 'Data Scientist', 'Analytics Engineer', 'ML Engineer']
  },
  product: {
    label: 'Product',
    keywords: ['Product Manager', 'Technical Product Manager', 'Product Owner']
  },
  design: {
    label: 'Design',
    keywords: ['Product Designer', 'UX Designer', 'UI Designer', 'Graphic Designer']
  },
  devops: {
    label: 'DevOps / SRE',
    keywords: ['DevOps', 'SRE', 'Site Reliability', 'Infrastructure Engineer', 'Platform Engineer']
  },
  solutions: {
    label: 'Solutions / Forward Deployed',
    keywords: ['Solutions Architect', 'Solutions Engineer', 'Forward Deployed', 'Customer Engineer']
  },
  security: {
    label: 'Security',
    keywords: ['Security Engineer', 'Application Security', 'Security Architect']
  },

  // -- Business & operations --
  sales: {
    label: 'Sales',
    keywords: ['Sales', 'Account Executive', 'Account Manager', 'Business Development', 'Sales Representative']
  },
  marketing: {
    label: 'Marketing',
    keywords: ['Marketing', 'Content', 'Brand', 'SEO', 'Social Media', 'Communications', 'Growth Marketing']
  },
  operations: {
    label: 'Operations / Project Mgmt',
    keywords: ['Operations', 'Project Manager', 'Program Manager', 'Office Manager', 'Logistics', 'Supply Chain']
  },
  hr: {
    label: 'HR / Recruiting',
    keywords: ['Recruiter', 'Talent Acquisition', 'Human Resources', 'People Operations', 'HR']
  },
  support: {
    label: 'Customer Support / Success',
    keywords: ['Customer Support', 'Customer Success', 'Support Specialist', 'Help Desk', 'Client Services']
  },

  // -- Finance & legal --
  finance: {
    label: 'Finance / Accounting',
    keywords: ['Accountant', 'Financial Analyst', 'Controller', 'Bookkeeper', 'Auditor', 'Finance']
  },
  legal: {
    label: 'Legal',
    keywords: ['Attorney', 'Lawyer', 'Paralegal', 'Legal Counsel', 'Compliance']
  },

  // -- Healthcare & education --
  healthcare: {
    label: 'Healthcare',
    keywords: ['Nurse', 'Registered Nurse', 'RN', 'Physician', 'Clinical', 'Medical', 'Caregiver', 'Therapist']
  },
  dental: {
    label: 'Dental',
    keywords: ['Dental Hygienist', 'Dental Assistant', 'Dentist', 'Hygienist', 'Orthodontic', 'Dental']
  },
  education: {
    label: 'Education',
    keywords: ['Teacher', 'Instructor', 'Professor', 'Tutor', 'Educator', 'Lecturer', 'Curriculum']
  },

  // -- Trades & hospitality --
  trades: {
    label: 'Skilled Trades',
    keywords: ['Electrician', 'Plumber', 'Technician', 'Mechanic', 'HVAC', 'Welder', 'Carpenter']
  },
  hospitality: {
    label: 'Hospitality / Food',
    keywords: ['Chef', 'Cook', 'Server', 'Hospitality', 'Hotel', 'Restaurant', 'Barista', 'Event']
  }
};

// Presets whose curated tracked_companies (tech ATS boards: Greenhouse/Ashby/Lever)
// are actually relevant. Non-tech users shouldn't inherit a list of tech employers.
const TECH_PRESETS = new Set(['ai-ml', 'software', 'data', 'product', 'design', 'devops', 'solutions', 'security']);

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Lead', 'Head', 'Director'];
const WORK_MODE_OPTIONS = ['remote', 'hybrid', 'onsite'];

const BASE_NEGATIVE_KEYWORDS = ['Intern', 'Internship'];

function presetOptions() {
  return Object.entries(ROLE_PRESETS).map(([id, value]) => ({ id, label: value.label }));
}

function uniqueClean(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function normalizeAnswers(input = {}) {
  const location = input.location || {};
  return {
    fullName: (input.fullName || '').trim(),
    email: (input.email || '').trim(),
    linkedin: (input.linkedin || '').trim(),
    location: {
      city: (location.city || '').trim(),
      region: (location.region || '').trim(),
      country: (location.country || '').trim(),
      timezone: (location.timezone || '').trim()
    },
    workModes: (Array.isArray(input.workModes) ? input.workModes : []).filter(mode =>
      WORK_MODE_OPTIONS.includes(mode)
    ),
    roleFocus: (Array.isArray(input.roleFocus) ? input.roleFocus : []).filter(id => ROLE_PRESETS[id]),
    customKeywords: uniqueClean(
      Array.isArray(input.customKeywords)
        ? input.customKeywords
        : String(input.customKeywords || '').split(',')
    ),
    seniority: (Array.isArray(input.seniority) ? input.seniority : []).filter(level =>
      SENIORITY_OPTIONS.includes(level)
    ),
    compensation: {
      currency: (input.compensation?.currency || 'USD').trim() || 'USD',
      minimum: (input.compensation?.minimum || '').trim(),
      target: (input.compensation?.target || '').trim()
    }
  };
}

function resolveKeywords(answers) {
  const presetKeywords = answers.roleFocus.flatMap(id => ROLE_PRESETS[id]?.keywords || []);
  const keywords = uniqueClean([...presetKeywords, ...answers.customKeywords]);
  return keywords.length ? keywords : ['Engineer'];
}

function resolveSeniorityBoost(answers) {
  return answers.seniority.length ? answers.seniority : ['Senior', 'Staff', 'Lead'];
}

function resolveNegativeKeywords(answers) {
  const negatives = [...BASE_NEGATIVE_KEYWORDS];
  // If they don't want junior roles, exclude them from results.
  if (!answers.seniority.includes('Junior')) {
    negatives.push('Junior');
  }
  return uniqueClean(negatives);
}

function locationTerms(answers) {
  const terms = [];
  if (answers.workModes.includes('remote')) terms.push('remote');
  if (answers.location.city && (answers.workModes.includes('hybrid') || answers.workModes.includes('onsite'))) {
    terms.push(answers.location.city);
  }
  return terms.length ? terms : ['remote'];
}

function buildSearchQueries(answers) {
  const keywords = resolveKeywords(answers).slice(0, 4);
  const keywordExpr = keywords.map(keyword => `"${keyword}"`).join(' OR ');
  const portals = [
    { name: 'Ashby', site: 'site:jobs.ashbyhq.com' },
    { name: 'Greenhouse', site: 'site:job-boards.greenhouse.io' },
    { name: 'Lever', site: 'site:jobs.lever.co' }
  ];

  const queries = [];
  for (const term of locationTerms(answers)) {
    for (const portal of portals) {
      queries.push({
        name: `${portal.name} — ${term}`,
        query: `${portal.site} ${keywordExpr} ${term}`,
        enabled: true
      });
    }
    // Generic, portal-agnostic query so non-tech roles (which often aren't on
    // Greenhouse/Ashby/Lever) still surface results via the WebSearch scan path.
    queries.push({
      name: `Web — ${term}`,
      query: `${keywordExpr} ${term} jobs`,
      enabled: true
    });
  }
  return queries;
}

function readPortalsTemplate() {
  try {
    const templatePath = path.join(CONFIG.CAREER_OPS_PATH, 'templates', 'portals.example.yml');
    if (!fs.existsSync(templatePath)) return null;
    return yaml.load(fs.readFileSync(templatePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function buildLocationLabel(location) {
  return [location.city, location.region, location.country].filter(Boolean).join(', ');
}

function buildLocationFlexibility(answers) {
  const labels = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'On-site'
  };
  const modes = answers.workModes.map(mode => labels[mode]).filter(Boolean);
  if (!modes.length) return 'Remote';
  const where = answers.location.city ? ` (${answers.location.city})` : '';
  return `${modes.join(' / ')}${where}`;
}

function buildProfileYaml(answers) {
  const keywords = resolveKeywords(answers);
  const profile = {
    candidate: {
      full_name: answers.fullName || 'Your Name',
      email: answers.email || '',
      location: buildLocationLabel(answers.location) || answers.location.country || '',
      linkedin: answers.linkedin || ''
    },
    target_roles: {
      primary: keywords,
      archetypes: answers.roleFocus.map(id => ({
        name: ROLE_PRESETS[id].label,
        fit: 'primary'
      }))
    },
    compensation: {
      target_range: answers.compensation.target || '',
      currency: answers.compensation.currency,
      minimum: answers.compensation.minimum || '',
      location_flexibility: buildLocationFlexibility(answers)
    },
    location: {
      country: answers.location.country || '',
      city: answers.location.city || '',
      region: answers.location.region || '',
      timezone: answers.location.timezone || '',
      work_modes: answers.workModes.length ? answers.workModes : ['remote']
    },
    onboarding: {
      completed: true,
      completed_at: new Date().toISOString()
    }
  };

  const header = '# Career-Ops Profile — generated by onboarding. Edit freely in /manage.\n';
  return header + yaml.dump(profile, { lineWidth: 120, noRefs: true });
}

function inheritsTrackedCompanies(answers) {
  return answers.roleFocus.some(id => TECH_PRESETS.has(id));
}

function buildPortalsYaml(answers) {
  const keywords = resolveKeywords(answers);
  const base = readPortalsTemplate() || {};
  const trackedCompanies =
    inheritsTrackedCompanies(answers) && Array.isArray(base.tracked_companies) ? base.tracked_companies : [];

  const config = {
    title_filter: {
      positive: keywords,
      negative: resolveNegativeKeywords(answers),
      seniority_boost: resolveSeniorityBoost(answers)
    },
    location_preferences: {
      work_modes: answers.workModes.length ? answers.workModes : ['remote'],
      city: answers.location.city || '',
      region: answers.location.region || '',
      country: answers.location.country || ''
    },
    search_queries: buildSearchQueries(answers),
    tracked_companies: trackedCompanies
  };

  const header = '# Career-Ops Portals — generated by onboarding. Edit freely in /manage.\n';
  return header + yaml.dump(config, { lineWidth: 120, noRefs: true });
}

function parseProfile(content) {
  if (!content) return null;
  try {
    const parsed = yaml.load(content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    return null;
  }
}

function isOnboarded(profileContent) {
  const parsed = parseProfile(profileContent);
  return Boolean(parsed?.onboarding?.completed === true);
}

function reconstructAnswers(profileContent) {
  const parsed = parseProfile(profileContent);
  if (!parsed) return null;

  const candidate = parsed.candidate || {};
  const location = parsed.location || {};
  const compensation = parsed.compensation || {};

  return normalizeAnswers({
    fullName: candidate.full_name,
    email: candidate.email,
    linkedin: candidate.linkedin,
    location: {
      city: location.city,
      region: location.region,
      country: location.country,
      timezone: location.timezone
    },
    workModes: location.work_modes,
    roleFocus: (parsed.target_roles?.archetypes || [])
      .map(archetype => {
        const match = Object.entries(ROLE_PRESETS).find(([, value]) => value.label === archetype.name);
        return match ? match[0] : null;
      })
      .filter(Boolean),
    customKeywords: parsed.target_roles?.primary || [],
    compensation: {
      currency: compensation.currency,
      minimum: compensation.minimum,
      target: compensation.target
    }
  });
}

function validateAnswers(answers) {
  const errors = [];
  if (!answers.workModes.length) {
    errors.push('Pick at least one work style (remote, hybrid, or on-site).');
  }
  if (!answers.roleFocus.length && !answers.customKeywords.length) {
    errors.push('Pick at least one role focus or add a keyword.');
  }
  if ((answers.workModes.includes('hybrid') || answers.workModes.includes('onsite')) && !answers.location.city) {
    errors.push('Add your city for hybrid or on-site roles.');
  }
  if (!answers.location.city && !answers.location.country) {
    errors.push('Add your location (city or country).');
  }
  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.validation = errors;
    throw error;
  }
}

function createOnboardingService(services) {
  const { dataClient, setup } = services;

  function getState() {
    const profileContent = dataClient.readProfile();
    return {
      needsOnboarding: !isOnboarded(profileContent),
      answers: reconstructAnswers(profileContent),
      options: {
        roleFocus: presetOptions(),
        seniority: SENIORITY_OPTIONS,
        workModes: WORK_MODE_OPTIONS
      }
    };
  }

  async function complete(rawAnswers) {
    const answers = normalizeAnswers(rawAnswers);
    validateAnswers(answers);

    await dataClient.writeProfile(buildProfileYaml(answers));
    await dataClient.writePortals(buildPortalsYaml(answers));

    if (!dataClient.readPipeline()) {
      await dataClient.writePipeline(EMPTY_PIPELINE);
    }

    return {
      completed: true,
      status: setup.getStatus()
    };
  }

  return {
    getState,
    complete
  };
}

module.exports = {
  ROLE_PRESETS,
  SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  buildPortalsYaml,
  buildProfileYaml,
  buildSearchQueries,
  createOnboardingService,
  isOnboarded,
  normalizeAnswers,
  presetOptions,
  reconstructAnswers,
  resolveKeywords,
  validateAnswers
};
