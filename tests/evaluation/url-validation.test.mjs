/**
 * Behavioral tests for lib/evaluation/url-validation.mjs — SSRF-safe job URL intake.
 */

import { pass, fail } from '../helpers.mjs';

console.log('\nlib/evaluation — url-validation');

function expectThrow(fn, pattern, label) {
  try {
    fn();
    fail(`${label}: expected throw matching ${pattern}`);
    return false;
  } catch (err) {
    if (!pattern.test(err.message)) {
      fail(`${label}: wrong message "${err.message}"`);
      return false;
    }
    pass(label);
    return true;
  }
}

function expectAllow(fn, label) {
  try {
    const result = fn();
    if (!result?.href) {
      fail(`${label}: expected URL object with href`);
      return null;
    }
    pass(label);
    return result;
  } catch (err) {
    fail(`${label}: unexpected throw "${err.message}"`);
    return null;
  }
}

try {
  const { validatePublicJobUrl, validateEvaluationPayload } = await import(
    '../../lib/evaluation/url-validation.mjs'
  );

  expectAllow(
    () => validatePublicJobUrl('https://boards.greenhouse.io/acme/jobs/123'),
    'allows public https job posting URLs',
  );

  expectAllow(
    () => validatePublicJobUrl('http://jobs.example.com/role/1'),
    'allows public http job posting URLs',
  );

  for (const url of [
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://example.com/job',
  ]) {
    expectThrow(
      () => validatePublicJobUrl(url),
      /Only http\(s\)/,
      `rejects non-http(s) scheme: ${url.split(':')[0]}:`,
    );
  }

  expectThrow(
    () => validatePublicJobUrl('not-a-url'),
    /Invalid URL format/,
    'rejects malformed URLs',
  );

  expectThrow(
    () => validatePublicJobUrl(''),
    /URL is required/,
    'rejects empty URL when no JD text path applies',
  );

  for (const [url, label] of [
    ['http://127.0.0.1/jobs/1', 'loopback IPv4'],
    ['http://localhost/admin', 'localhost'],
    ['http://0.0.0.0/', 'all-zeros IPv4'],
    ['http://[::1]/', 'IPv6 loopback'],
    ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped IPv6 loopback'],
    ['http://localhost./', 'FQDN trailing-dot localhost'],
    ['http://10.0.0.5/', 'RFC1918 10/8'],
    ['http://172.16.0.1/', 'RFC1918 172.16/12'],
    ['http://192.168.1.1/', 'RFC1918 192.168/16'],
    ['http://169.254.169.254/latest/meta-data/', 'link-local metadata IPv4'],
    ['http://metadata.google.internal/', 'cloud metadata hostname'],
    ['http://evil.local/', '.local suffix'],
    ['http://corp.internal/', '.internal suffix'],
  ]) {
    expectThrow(
      () => validatePublicJobUrl(url),
      /Private|internal|blocked|not allowed/i,
      `blocks ${label}`,
    );
  }

  const trimmed = validatePublicJobUrl('  https://example.com/jobs/1  ');
  if (trimmed.href === 'https://example.com/jobs/1') {
    pass('trims whitespace and normalizes href');
  } else {
    fail(`trim/normalize mismatch: ${trimmed.href}`);
  }

  const longJd = 'A'.repeat(80);
  const textOnly = validateEvaluationPayload({ jdText: longJd });
  if (textOnly.source === 'text' && textOnly.url === null && textOnly.jdText === longJd) {
    pass('accepts long JD text without URL');
  } else {
    fail(`text-only payload mismatch: ${JSON.stringify(textOnly)}`);
  }

  const urlAndText = validateEvaluationPayload({
    url: 'https://boards.greenhouse.io/acme/jobs/123',
    jdText: longJd,
    notes: '  note  ',
  });
  if (
    urlAndText.source === 'url-and-text'
    && urlAndText.url.includes('greenhouse.io')
    && urlAndText.jdText === longJd
    && urlAndText.notes === 'note'
  ) {
    pass('normalizes url-and-text payload with trimmed notes');
  } else {
    fail(`url-and-text payload mismatch: ${JSON.stringify(urlAndText)}`);
  }

  const urlOnly = validateEvaluationPayload({
    url: 'https://jobs.lever.co/acme/abc-def',
  });
  if (urlOnly.source === 'url' && urlOnly.jdText === null) {
    pass('accepts URL-only payload when JD text is absent');
  } else {
    fail(`url-only payload mismatch: ${JSON.stringify(urlOnly)}`);
  }

  expectThrow(
    () => validateEvaluationPayload({ jdText: 'too short' }),
    /80 characters/,
    'rejects short JD without URL',
  );

  const shortWithUrl = validateEvaluationPayload({
    url: 'https://example.com/jobs/1',
    jdText: 'short',
  });
  if (shortWithUrl.source === 'url-and-text' && shortWithUrl.jdText === 'short') {
    pass('allows short supplemental JD when a public URL is provided');
  } else {
    fail(`short JD + URL mismatch: ${JSON.stringify(shortWithUrl)}`);
  }
} catch (err) {
  fail(`url-validation tests crashed: ${err.message}`);
}
