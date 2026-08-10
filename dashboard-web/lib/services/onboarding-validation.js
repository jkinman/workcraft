const WORK_MODE_OPTIONS = ['remote', 'hybrid', 'onsite'];

const SENIORITY_OPTIONS = ['Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Lead', 'Head', 'Director'];

const ROLE_PRESET_IDS = new Set([
  'ai-ml',
  'software',
  'data',
  'product',
  'design',
  'devops',
  'solutions',
  'security',
  'sales',
  'marketing',
  'operations',
  'hr',
  'support',
  'finance',
  'legal',
  'healthcare',
  'dental',
  'education',
  'trades',
  'hospitality'
]);

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
    roleFocus: (Array.isArray(input.roleFocus) ? input.roleFocus : []).filter(id => ROLE_PRESET_IDS.has(id)),
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

function collectValidationErrors(rawAnswers) {
  try {
    validateAnswers(normalizeAnswers(rawAnswers));
    return [];
  } catch (error) {
    return error.validation || [error.message];
  }
}

module.exports = {
  WORK_MODE_OPTIONS,
  SENIORITY_OPTIONS,
  collectValidationErrors,
  normalizeAnswers,
  validateAnswers
};
