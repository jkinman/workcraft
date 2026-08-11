/**
 * ATS identity — shared URL/name grammar for Greenhouse, Lever, Ashby, Workday, iCIMS.
 *
 * Consumed by provider detection hints, portal verification, reverse discovery,
 * and API-first liveness checks.
 */

/** @typedef {'greenhouse'|'lever'|'ashby'|'workday'|'icims'} AtsId */

export const SLUG_CHARSET = /^[A-Za-z0-9._-]+$/;

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function isSafeValue(v) {
  if (typeof v !== 'string' || v.length === 0) return false;
  return v.split('/').every((seg) => seg.length > 0 && SAFE_SEGMENT.test(seg) && !seg.includes('..'));
}

/** Careers/API URL patterns for slug extraction (verify-portals, provider hints). */
export const ATS_URL_PATTERNS = [
  { ats: 'greenhouse', re: /boards-api\.greenhouse\.io\/v1\/boards\/([^/?#]+)/ },
  { ats: 'greenhouse', re: /job-boards(?:\.eu)?\.greenhouse\.io\/([^/?#]+)/ },
  { ats: 'greenhouse', re: /boards\.greenhouse\.io\/([^/?#]+)/ },
  { ats: 'ashby', re: /api\.ashbyhq\.com\/posting-api\/job-board\/([^/?#]+)/ },
  { ats: 'ashby', re: /jobs\.ashbyhq\.com\/([^/?#]+)/ },
  { ats: 'lever', host: 'api.eu.lever.co', re: /^\/v0\/postings\/([^/?#]+)/, eu: true },
  { ats: 'lever', host: 'jobs.eu.lever.co', re: /^\/([^/?#]+)/, eu: true },
  { ats: 'lever', host: 'api.lever.co', re: /^\/v0\/postings\/([^/?#]+)/ },
  { ats: 'lever', host: 'jobs.lever.co', re: /^\/([^/?#]+)/ },
  { ats: 'workday', re: /([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/ },
  { ats: 'icims', re: /careers-([a-z0-9._-]+)\.icims\.com/i },
];

/**
 * @param {string} url
 * @returns {{ ats: string, slug: string, eu?: boolean, tenant?: string, shard?: string, site?: string }|null}
 */
export function parseAtsSlug(url) {
  const text = String(url || '');
  let hostname = null;
  let pathname = null;
  try {
    ({ hostname, pathname } = new URL(text));
  } catch {
    // host-scoped patterns below simply won't match
  }

  for (const { ats, re, eu, host } of ATS_URL_PATTERNS) {
    if (host) {
      if (hostname !== host) continue;
      const m = pathname.match(re);
      if (m?.[1]) return eu ? { ats, slug: m[1], eu: true } : { ats, slug: m[1] };
      continue;
    }
    const m = text.match(re);
    if (!m?.[1]) continue;
    if (ats === 'workday') {
      return { ats, tenant: m[1], shard: m[2], site: m[3], slug: m[1] };
    }
    return eu ? { ats, slug: m[1], eu: true } : { ats, slug: m[1] };
  }
  return null;
}

/** Per-job API resolution for liveness (Greenhouse, Lever, Ashby, Workday). */
export function classifyAshbyBoardPayload(json, jobId) {
  if (!json || !Array.isArray(json.jobs)) return null;
  const target = String(jobId).toLowerCase();
  const job = json.jobs.find((j) => typeof j?.id === 'string' && j.id.toLowerCase() === target);
  if (job && job.isListed !== false) {
    return { result: 'active', code: 'ashby_api_ok', reason: 'Ashby posting is listed on the board (live)' };
  }
  return { result: 'expired', code: 'ashby_api_unlisted', reason: 'Ashby posting not listed on the board — removed/unlisted' };
}

const LIVENESS_API_PROVIDERS = [
  {
    id: 'greenhouse',
    match(u) {
      if (!/(^|\.)greenhouse\.io$/.test(u.hostname)) return null;
      const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
      return m ? { board: m[1], id: m[2] } : null;
    },
    api: ({ board, id }) => `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`,
  },
  {
    id: 'lever',
    match(u) {
      const host = u.hostname.match(/^jobs\.((?:eu\.)?lever\.co)$/);
      if (!host) return null;
      const m = u.pathname.match(/^\/([^/]+)\/([^/?#]+)\/?$/);
      return m ? { apiHost: `api.${host[1]}`, slug: m[1], id: m[2] } : null;
    },
    api: ({ apiHost, slug, id }) => `https://${apiHost}/v0/postings/${slug}/${id}`,
  },
  {
    id: 'ashby',
    match(u) {
      if (u.hostname !== 'jobs.ashbyhq.com') return null;
      const m = u.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/application)?\/?$/);
      return m ? { org: m[1], jobId: m[2] } : null;
    },
    api: ({ org }) => `https://api.ashbyhq.com/posting-api/job-board/${org}`,
    timeoutMs: 20_000,
    interpret: async (res, parts) => classifyAshbyBoardPayload(await res.json(), parts.jobId),
  },
  {
    id: 'workday',
    match(u) {
      const m = `${u.hostname}${u.pathname}`.match(
        /^([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)\/job\/(.+?)\/?$/,
      );
      if (!m) return null;
      const [, tenant, shard, site, jobPath] = m;
      return { tenant, shard, site, jobPath };
    },
    api: ({ tenant, shard, site, jobPath }) =>
      `https://${tenant}.${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${jobPath}`,
  },
];

/**
 * @param {string} rawUrl
 * @returns {{ ats: string, apiUrl: string, parts: Record<string, string>, timeoutMs?: number, interpret?: Function }|null}
 */
export function resolveAtsApi(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  for (const provider of LIVENESS_API_PROVIDERS) {
    const parts = provider.match(u);
    if (!parts) continue;
    if (!Object.values(parts).every(isSafeValue)) return null;
    return {
      ats: provider.id,
      apiUrl: provider.api(parts),
      parts,
      timeoutMs: provider.timeoutMs,
      interpret: provider.interpret,
    };
  }
  return null;
}

export function isAtsPosting(url) {
  return resolveAtsApi(url) !== null;
}

/** Host validators for reverse-discovery synthetic entries. */
export const ATS_HOST_CHECKS = {
  greenhouse: (h) => h === 'job-boards.greenhouse.io',
  lever: (h) => h === 'jobs.lever.co',
  ashby: (h) => h === 'jobs.ashbyhq.com',
  workday: (h, tenant, shard) => h === `${tenant}.${shard}.myworkdayjobs.com` && h.endsWith('.myworkdayjobs.com'),
  icims: (h, slug) => h === `careers-${String(slug).toLowerCase()}.icims.com`,
};

/**
 * Build a synthetic portal entry when hostname matches the ATS canonical host.
 *
 * @param {string} name
 * @param {string} careersUrl
 * @param {(hostname: string) => boolean} isCanonicalHost
 * @returns {{ name: string, careers_url: string }|null}
 */
export function entryOnHost(name, careersUrl, isCanonicalHost) {
  let hostname;
  try {
    ({ hostname } = new URL(careersUrl));
  } catch {
    return null;
  }
  return isCanonicalHost(hostname) ? { name, careers_url: careersUrl } : null;
}

/** Public probe URLs for verify-portals slug checks. */
export const ATS_PROBE_SPECS = {
  greenhouse: {
    probeUrl: (slug) => `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    jobCount: (json) => (Array.isArray(json?.jobs) ? json.jobs.length : null),
  },
  ashby: {
    probeUrl: (slug) => `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`,
    jobCount: (json) => (Array.isArray(json?.jobs) ? json.jobs.length : null),
  },
  lever: {
    probeUrl: (slug, { eu = false } = {}) => `https://api.${eu ? 'eu.' : ''}lever.co/v0/postings/${slug}`,
    jobCount: (json) => (Array.isArray(json) ? json.length : null),
  },
};
