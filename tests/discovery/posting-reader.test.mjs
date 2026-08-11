import { pass, fail } from '../helpers.mjs';

console.log('\nlib/discovery — SSRF-safe posting reader');

function makeFakePage({ bodyText, finalUrl, applyLabels = ['Apply now'] }) {
  let currentUrl = finalUrl;
  return {
    url: () => currentUrl,
    _routeInterceptorRegistered: false,
    _blockedByGuard: null,
    async goto() {
      currentUrl = finalUrl;
      return { status: () => 200 };
    },
    async waitForTimeout() {},
    async evaluate(fn) {
      const source = fn.toString();
      if (source.includes('querySelectorAll')) {
        return applyLabels;
      }
      return bodyText;
    },
  };
}

try {
  const { readJobPosting, DEFAULT_MAX_JD_CHARS } = await import('../../lib/discovery/posting-reader.mjs');

  let blocked = false;
  try {
    await readJobPosting('http://127.0.0.1/jobs/1');
  } catch (err) {
    blocked = /blocked/i.test(err.message);
  }
  if (blocked) pass('posting reader rejects private http(s) URLs');
  else fail('posting reader did not block private URL');

  let schemeBlocked = false;
  try {
    await readJobPosting('file:///etc/passwd');
  } catch (err) {
    schemeBlocked = /blocked/i.test(err.message);
  }
  if (schemeBlocked) pass('posting reader rejects non-http(s) schemes');
  else fail('posting reader did not block file:// URL');

  const jdBody = `Senior Engineer\n\n${'Build platforms. '.repeat(40)}`.trim();
  const page = makeFakePage({
    bodyText: jdBody,
    finalUrl: 'https://boards.greenhouse.io/acme/jobs/123',
  });
  const posting = await readJobPosting('https://boards.greenhouse.io/acme/jobs/123', {
    browser: { async close() {} },
    page,
    launchBrowser: async () => {
      throw new Error('launchBrowser should not run when browser is injected');
    },
  });

  if (posting.jdText.length >= 80 && posting.jdText.length <= DEFAULT_MAX_JD_CHARS && posting.untrustedSource === true) {
    pass('posting reader extracts bounded JD text with untrusted-source metadata');
  } else {
    fail(`posting reader returned unexpected JD payload (${posting.jdText.length} chars)`);
  }

  const expiredBody = `${'This role has been filled. '.repeat(20)}`;
  const expiredPage = makeFakePage({
    bodyText: expiredBody,
    finalUrl: 'https://jobs.example.com/closed',
    applyLabels: [],
  });
  let expiredRejected = false;
  try {
    await readJobPosting('https://jobs.example.com/closed', {
      browser: { async close() {} },
      page: expiredPage,
    });
  } catch (err) {
    expiredRejected = /closed|filled/i.test(err.message);
  }
  if (expiredRejected) pass('posting reader rejects expired postings via browser liveness semantics');
  else fail('posting reader accepted an expired posting');

  const uncertainBody = `${'Role description without apply control. '.repeat(25)}`;
  const uncertainPage = makeFakePage({
    bodyText: uncertainBody,
    finalUrl: 'https://jobs.example.com/uncertain',
    applyLabels: [],
  });
  let uncertainRejected = false;
  try {
    await readJobPosting('https://jobs.example.com/uncertain', {
      browser: { async close() {} },
      page: uncertainPage,
    });
  } catch (err) {
    uncertainRejected = /not browser-verified|uncertain|no_apply|active/i.test(err.message);
  }
  if (uncertainRejected) pass('posting reader rejects uncertain browser liveness (not active)');
  else fail('posting reader accepted uncertain liveness as verified');

  // DNS rebinding / redirect-to-private via route guard
  const { setHostResolver } = await import('../../lib/discovery/liveness/browser.mjs');
  const restore = setHostResolver(async () => ['127.0.0.1']);
  let redirectBlocked = false;
  const redirectPage = {
    _routeInterceptorRegistered: false,
    _blockedByGuard: null,
    url: () => 'https://public.example/jobs/1',
    async route(_pattern, handler) {
      this._routeInterceptorRegistered = true;
      await handler({
        request: () => ({ url: () => 'http://127.0.0.1/internal' }),
        abort: (reason) => {
          this._blockedByGuard = { code: 'blocked_host', reason: 'blocked subresource' };
        },
        continue: () => {},
      });
    },
    async goto() {
      if (this._blockedByGuard) {
        throw new Error('navigation blocked by SSRF guard');
      }
      return { status: () => 200 };
    },
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.toString().includes('querySelectorAll')) return ['Apply'];
      return `${'Engineering. '.repeat(40)} Apply`;
    },
  };
  try {
    await readJobPosting('https://public.example/jobs/1', {
      browser: { async close() {} },
      page: redirectPage,
    });
  } catch (err) {
    redirectBlocked = /blocked|SSRF|not browser-verified|navigation/i.test(err.message);
  }
  restore();
  if (redirectBlocked) pass('posting reader blocks redirect/subresource SSRF via liveness route guard');
  else fail('posting reader did not block private redirect subresource');
} catch (e) {
  fail(`posting reader tests crashed: ${e.message}`);
}
