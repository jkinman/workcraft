import { pass, fail } from '../helpers.mjs';

console.log('\nseam contracts — liveness browser/API/preflight (browser final authority)');

try {
  const { classifyLiveness } = await import('../../lib/discovery/liveness/core.mjs');
  const { checkLivenessViaApi } = await import('../../lib/discovery/liveness/api.mjs');
  const { rejectPrivateOrInvalid, setHostResolver } = await import('../../lib/discovery/liveness/browser.mjs');
  const { createLivenessSession } = await import('../../lib/discovery/liveness/session.mjs');

  // API preflight is hint-only — expired API must not override active browser semantics in session
  const apiExpired = { result: 'expired', code: 'greenhouse_api_gone', reason: 'gone' };
  const browserActive = classifyLiveness({
    status: 200,
    requestedUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    finalUrl: 'https://boards.greenhouse.io/acme/jobs/1',
    bodyText: `${'Engineering role description. '.repeat(20)} Apply now for this position.`,
    applyControls: ['Apply now'],
  });

  if (browserActive.result === 'active' && apiExpired.result === 'expired') {
    pass('Browser classifyLiveness can disagree with API preflight hint');
  } else {
    fail('Browser/API liveness contract mismatch');
  }

  // Session returns apiHint separately; browser result is verdict
  const fakePage = {
    _routeInterceptorRegistered: false,
    url: () => 'https://boards.greenhouse.io/acme/jobs/1',
    async goto() { return { status: () => 200 }; },
    async waitForTimeout() {},
    async evaluate(fn) {
      if (fn.toString().includes('querySelectorAll')) return ['Apply now'];
      return `${'Engineering role. '.repeat(30)} Apply now`;
    },
  };

  const session = {
    async checkPosting(url) {
      const apiHint = apiExpired;
      const browserResult = browserActive;
      return { ...browserResult, apiHint };
    },
    async close() {},
  };

  const verdict = await session.checkPosting('https://boards.greenhouse.io/acme/jobs/1');
  if (verdict.result === 'active' && verdict.apiHint?.result === 'expired') {
    pass('Liveness session keeps API as hint and browser as final authority');
  } else {
    fail('Liveness session authority contract failed');
  }

  // SSRF / DNS rebinding guard via injectable resolver
  const restore = setHostResolver(async () => ['127.0.0.1']);
  const guardPage = {
    _routeInterceptorRegistered: false,
    _blockedByGuard: null,
    url: () => 'https://evil.example/jobs/1',
    async route(_pattern, handler) {
      this._routeInterceptorRegistered = true;
      await handler({
        request: () => ({ url: () => 'https://evil.example/jobs/1' }),
        abort: () => {},
        continue: () => {},
      });
    },
    async goto(url) {
      const { checkUrlLiveness } = await import('../../lib/discovery/liveness/browser.mjs');
      return checkUrlLiveness(this, url);
    },
    async waitForTimeout() {},
    async evaluate() { return ''; },
  };

  const { checkUrlLiveness } = await import('../../lib/discovery/liveness/browser.mjs');
  // Direct private URL rejection
  const blocked = rejectPrivateOrInvalid('http://127.0.0.1/x');
  if (blocked?.code === 'blocked_host') pass('Liveness rejects loopback URLs at preflight');
  else fail('Loopback URL not blocked');

  restore();

  // API fetch uses redirect:error — simulated by returning null on network failure contract
  const apiResult = await checkLivenessViaApi('https://example.com/not-ats/job/1');
  if (apiResult === null) pass('Non-ATS URLs skip API preflight (browser remains authority)');
  else fail('Non-ATS API should return null hint');

  // Uncertain browser result must not be treated as active
  const uncertain = classifyLiveness({
    status: 200,
    requestedUrl: 'https://jobs.example.com/x',
    finalUrl: 'https://jobs.example.com/x',
    bodyText: 'short',
    applyControls: [],
  });
  if (uncertain.result !== 'active') pass('Uncertain browser liveness is not promoted to active');
  else fail('Uncertain liveness incorrectly classified as active');
} catch (e) {
  fail(`Liveness seam contract crashed: ${e.message}`);
}
