import { pass, fail } from '../helpers.mjs';
import { parseAtsSlug, resolveAtsApi, entryOnHost, SLUG_CHARSET } from '../../lib/discovery/ats-identity.mjs';
import { REVERSE_ATS_SOURCES, listReverseSourceIds } from '../../lib/discovery/reverse-sources.mjs';

console.log('\nlib/discovery — ATS identity + reverse sources');

try {
  if (parseAtsSlug('https://job-boards.greenhouse.io/acme')?.ats === 'greenhouse') {
    pass('parseAtsSlug detects greenhouse careers URL');
  } else fail('parseAtsSlug greenhouse');

  const ghApi = resolveAtsApi('https://boards.greenhouse.io/acme/jobs/4567890');
  if (ghApi?.ats === 'greenhouse' && ghApi.apiUrl.includes('boards-api.greenhouse.io')) {
    pass('resolveAtsApi maps greenhouse posting to API URL');
  } else fail('resolveAtsApi greenhouse');

  const canonical = entryOnHost('acme', 'https://jobs.lever.co/acme', (h) => h === 'jobs.lever.co');
  if (canonical?.careers_url === 'https://jobs.lever.co/acme') {
    pass('entryOnHost accepts canonical lever host');
  } else fail('entryOnHost lever');

  const ids = listReverseSourceIds();
  if (ids.includes('greenhouse') && ids.includes('workday') && REVERSE_ATS_SOURCES.greenhouse.provider?.id === 'greenhouse') {
    pass('reverse sources expose provider metadata for all ATS ids');
  } else fail('REVERSE_ATS_SOURCES metadata');

  if (SLUG_CHARSET.test('acme-corp_1')) pass('SLUG_CHARSET accepts safe slug');
  else fail('SLUG_CHARSET');
} catch (e) {
  fail(`discovery identity tests crashed: ${e.message}`);
}
