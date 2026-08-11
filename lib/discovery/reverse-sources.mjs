/**
 * Reverse-capable ATS source metadata derived from the provider registry + identity module.
 */

import greenhouse from '../../providers/greenhouse.mjs';
import lever from '../../providers/lever.mjs';
import ashby from '../../providers/ashby.mjs';
import workday from '../../providers/workday.mjs';
import icims from '../../providers/icims.mjs';
import { ATS_HOST_CHECKS, SLUG_CHARSET, entryOnHost } from './ats-identity.mjs';

const DATASET_BASE = 'https://raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data';

/** @type {Record<string, { provider: object, dataset: string, toEntry: Function }>} */
export const REVERSE_ATS_SOURCES = {
  greenhouse: {
    provider: greenhouse,
    dataset: `${DATASET_BASE}/greenhouse_companies.json`,
    toEntry: (slug) => SLUG_CHARSET.test(String(slug))
      ? entryOnHost(String(slug), `https://job-boards.greenhouse.io/${slug}`, ATS_HOST_CHECKS.greenhouse)
      : null,
  },
  lever: {
    provider: lever,
    dataset: `${DATASET_BASE}/lever_companies.json`,
    toEntry: (slug) => SLUG_CHARSET.test(String(slug))
      ? entryOnHost(String(slug), `https://jobs.lever.co/${slug}`, ATS_HOST_CHECKS.lever)
      : null,
  },
  ashby: {
    provider: ashby,
    dataset: `${DATASET_BASE}/ashby_companies.json`,
    toEntry: (slug) => SLUG_CHARSET.test(String(slug))
      ? entryOnHost(String(slug), `https://jobs.ashbyhq.com/${slug}`, ATS_HOST_CHECKS.ashby)
      : null,
  },
  workday: {
    provider: workday,
    dataset: `${DATASET_BASE}/workday_companies.json`,
    toEntry: (line) => {
      const [tenant, instance, site] = String(line).split('|');
      if (![tenant, instance, site].every((p) => p && SLUG_CHARSET.test(p))) return null;
      return entryOnHost(
        tenant,
        `https://${tenant}.${instance}.myworkdayjobs.com/${site}`,
        (h) => ATS_HOST_CHECKS.workday(h, tenant, instance),
      );
    },
  },
  icims: {
    provider: icims,
    dataset: `${DATASET_BASE}/icims_companies.json`,
    toEntry: (slug) => SLUG_CHARSET.test(String(slug))
      ? entryOnHost(
        String(slug),
        `https://careers-${slug}.icims.com/jobs/search?ss=1&in_iframe=1`,
        (h) => ATS_HOST_CHECKS.icims(h, slug),
      )
      : null,
  },
};

export function listReverseSourceIds() {
  return Object.keys(REVERSE_ATS_SOURCES);
}

export function getReverseSource(id) {
  return REVERSE_ATS_SOURCES[id] ?? null;
}
