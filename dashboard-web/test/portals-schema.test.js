import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { portalsObjectToYaml, portalsToObject } from '../lib/services/portals-schema';

const YAML = `title_filter:
  positive:
    - AI
    - ML
  negative:
    - Junior
  seniority_boost:
    - Senior
search_queries:
  - name: Ashby — AI
    query: 'site:jobs.ashbyhq.com "AI Engineer" remote'
    enabled: true
  - name: Lever — AI
    query: 'site:jobs.lever.co "AI" remote'
    enabled: false
tracked_companies:
  - name: Anthropic
    careers_url: https://job-boards.greenhouse.io/anthropic
    api: https://boards-api.greenhouse.io/v1/boards/anthropic/jobs
    enabled: true
  - name: OpenAI
    careers_url: https://openai.com/careers
    scan_method: websearch
    scan_query: 'site:openai.com/careers'
    enabled: true
`;

describe('portals-schema — portalsToObject', () => {
  it('parses title filter, queries, and companies', () => {
    const obj = portalsToObject(YAML);
    expect(obj.titleFilter.positive).toEqual(['AI', 'ML']);
    expect(obj.titleFilter.negative).toEqual(['Junior']);
    expect(obj.searchQueries).toHaveLength(2);
    expect(obj.searchQueries[1].enabled).toBe(false);
    expect(obj.trackedCompanies).toHaveLength(2);
    expect(obj.trackedCompanies[0].name).toBe('Anthropic');
  });
});

describe('portals-schema — save preserves company extras', () => {
  it('keeps api / scan_method fields on round trip', () => {
    const obj = portalsToObject(YAML);
    obj.titleFilter.positive.push('LLM');
    obj.trackedCompanies[1].enabled = false;

    const out = portalsObjectToYaml(obj, YAML);
    const reparsed = yaml.load(out);

    expect(reparsed.title_filter.positive).toContain('LLM');
    expect(reparsed.tracked_companies[0].api).toBe('https://boards-api.greenhouse.io/v1/boards/anthropic/jobs');
    expect(reparsed.tracked_companies[1].scan_method).toBe('websearch');
    expect(reparsed.tracked_companies[1].scan_query).toBe('site:openai.com/careers');
    expect(reparsed.tracked_companies[1].enabled).toBe(false);
  });

  it('drops companies with no name and keeps the rest', () => {
    const obj = portalsToObject(YAML);
    obj.trackedCompanies.push({ name: '', careers_url: 'https://x.com', enabled: true });
    const reparsed = yaml.load(portalsObjectToYaml(obj, YAML));
    expect(reparsed.tracked_companies).toHaveLength(2);
  });
});
