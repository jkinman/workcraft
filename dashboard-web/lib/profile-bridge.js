/**
 * ESM bridge for dashboard-web (CJS) → lib/profile.
 */

let profileModule;

async function loadProfileModule() {
  if (!profileModule) {
    profileModule = await import('../../lib/profile/index.mjs');
  }
  return profileModule;
}

async function readProfileFromYaml(yamlText) {
  const { readProfile } = await loadProfileModule();
  return readProfile({ profileYaml: yamlText });
}

/** Map lib/profile candidate fields to legacy dashboard shape. */
function toLegacyDashboardProfile(parsed) {
  return {
    full_name: parsed.candidate.fullName || 'Career-Ops Candidate',
    email: parsed.candidate.email || '',
    phone: parsed.candidate.phone || '',
    location: parsed.candidate.location || '',
    linkedin: parsed.candidate.linkedin || '',
    portfolio_url: parsed.candidate.portfolioUrl || '',
    github: parsed.candidate.github || '',
    photo: parsed.candidate.photo || '',
    photo_style: parsed.candidate.photoStyle || 'rounded',
    spend_tier: parsed.spendTier,
    output_language: parsed.outputLanguage,
  };
}

async function loadDashboardProfile(content) {
  if (!content) {
    return toLegacyDashboardProfile((await loadProfileModule()).normalizeProfile({}));
  }
  const parsed = await readProfileFromYaml(content);
  return toLegacyDashboardProfile(parsed);
}

module.exports = {
  loadProfileModule,
  readProfileFromYaml,
  loadDashboardProfile,
  toLegacyDashboardProfile,
};
