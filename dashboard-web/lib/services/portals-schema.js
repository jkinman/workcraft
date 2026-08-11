// Portals schema: structured view of portals.yml for form editing.
// Title filters and search queries are fully editable; tracked companies keep
// all of their fields (api, scan_method, scan_query, notes...) on round-trip.
const yaml = require('js-yaml');

function asList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
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

function portalsToObject(text) {
  const raw = parseYaml(text);
  const titleFilter = raw.title_filter || {};

  return {
    titleFilter: {
      positive: asList(titleFilter.positive),
      negative: asList(titleFilter.negative),
      seniority_boost: asList(titleFilter.seniority_boost)
    },
    searchQueries: (Array.isArray(raw.search_queries) ? raw.search_queries : []).map(query => ({
      name: str(query.name),
      query: str(query.query),
      enabled: query.enabled !== false
    })),
    trackedCompanies: (Array.isArray(raw.tracked_companies) ? raw.tracked_companies : []).map(company => ({
      ...company,
      name: str(company.name),
      careers_url: str(company.careers_url),
      notes: str(company.notes),
      enabled: company.enabled !== false
    }))
  };
}

function cleanCompany(company) {
  const out = {};
  for (const [key, value] of Object.entries(company || {})) {
    if (key === 'enabled') {
      out.enabled = value !== false;
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
    } else if (value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  if (out.enabled === undefined) out.enabled = true;
  return out;
}

function portalsObjectToYaml(uiObject, currentText = '') {
  const raw = parseYaml(currentText);
  const ui = uiObject || {};
  const titleFilter = ui.titleFilter || {};

  raw.title_filter = {
    positive: asList(titleFilter.positive),
    negative: asList(titleFilter.negative),
    seniority_boost: asList(titleFilter.seniority_boost)
  };

  raw.search_queries = (Array.isArray(ui.searchQueries) ? ui.searchQueries : [])
    .filter(query => str(query.name).trim() || str(query.query).trim())
    .map(query => ({
      name: str(query.name).trim(),
      query: str(query.query).trim(),
      enabled: query.enabled !== false
    }));

  raw.tracked_companies = (Array.isArray(ui.trackedCompanies) ? ui.trackedCompanies : [])
    .filter(company => str(company.name).trim())
    .map(cleanCompany);

  return yaml.dump(raw, { lineWidth: 120, noRefs: true });
}

module.exports = {
  portalsToObject,
  portalsObjectToYaml
};
