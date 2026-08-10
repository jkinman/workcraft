// Profile schema: structured view of config/profile.yml for form editing.
// Save merges edits back into the existing YAML object so untouched keys
// (archetypes, proof_points, onboarding markers, etc.) are preserved.
const yaml = require('js-yaml');

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function str(value) {
  return value === undefined || value === null ? '' : String(value);
}

function parseYaml(text) {
  if (!text || !text.trim()) return {};
  const parsed = yaml.load(text);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function profileToObject(text) {
  const raw = parseYaml(text);
  const candidate = raw.candidate || {};
  const targetRoles = raw.target_roles || {};
  const compensation = raw.compensation || {};
  const location = raw.location || {};
  const narrative = raw.narrative || {};

  return {
    candidate: {
      full_name: str(candidate.full_name),
      email: str(candidate.email),
      phone: str(candidate.phone),
      location: str(candidate.location),
      linkedin: str(candidate.linkedin),
      portfolio_url: str(candidate.portfolio_url),
      github: str(candidate.github)
    },
    targetRoles: asList(targetRoles.primary),
    compensation: {
      target_range: str(compensation.target_range),
      currency: str(compensation.currency) || 'USD',
      minimum: str(compensation.minimum),
      location_flexibility: str(compensation.location_flexibility)
    },
    location: {
      country: str(location.country),
      city: str(location.city),
      region: str(location.region),
      timezone: str(location.timezone),
      work_modes: asList(location.work_modes)
    },
    narrative: {
      headline: str(narrative.headline),
      exit_story: str(narrative.exit_story),
      superpowers: asList(narrative.superpowers)
    }
  };
}

// Merge the edited UI object into the current YAML, preserving unknown keys.
function profileObjectToYaml(uiObject, currentText = '') {
  const raw = parseYaml(currentText);
  const ui = uiObject || {};

  raw.candidate = { ...(raw.candidate || {}) };
  for (const [key, value] of Object.entries(ui.candidate || {})) {
    raw.candidate[key] = str(value);
  }

  raw.target_roles = { ...(raw.target_roles || {}) };
  raw.target_roles.primary = asList(ui.targetRoles);

  raw.compensation = { ...(raw.compensation || {}), ...(ui.compensation || {}) };

  raw.location = { ...(raw.location || {}) };
  for (const [key, value] of Object.entries(ui.location || {})) {
    if (key === 'work_modes') raw.location.work_modes = asList(value);
    else raw.location[key] = str(value);
  }

  const narrative = ui.narrative || {};
  const hasNarrative =
    narrative.headline || narrative.exit_story || asList(narrative.superpowers).length;
  if (hasNarrative || raw.narrative) {
    raw.narrative = { ...(raw.narrative || {}) };
    if (narrative.headline !== undefined) raw.narrative.headline = str(narrative.headline);
    if (narrative.exit_story !== undefined) raw.narrative.exit_story = str(narrative.exit_story);
    if (narrative.superpowers !== undefined) raw.narrative.superpowers = asList(narrative.superpowers);
  }

  return yaml.dump(raw, { lineWidth: 100, noRefs: true });
}

module.exports = {
  profileToObject,
  profileObjectToYaml
};
