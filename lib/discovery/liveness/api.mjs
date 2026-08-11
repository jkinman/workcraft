// @ts-check
/**
 * API-first liveness checks for ATS-hosted postings.
 */

import { DEFAULT_USER_AGENT } from '../../../user-agent.mjs';
import { resolveAtsApi, classifyAshbyBoardPayload } from '../ats-identity.mjs';

const TIMEOUT_MS = 8_000;

/**
 * @param {any} json
 * @param {string} jobId
 */
export function classifyAshbyBoard(json, jobId) {
  return classifyAshbyBoardPayload(json, jobId);
}

export { resolveAtsApi, isAtsPosting } from '../ats-identity.mjs';

/**
 * @param {string} url
 */
export async function checkLivenessViaApi(url) {
  const resolved = resolveAtsApi(url);
  if (!resolved) return null;
  const { ats, apiUrl, parts, interpret, timeoutMs } = resolved;
  const ashbyInterpret = ats === 'ashby'
    ? async (res, p) => classifyAshbyBoard(await res.json(), p.jobId)
    : interpret;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'user-agent': DEFAULT_USER_AGENT, accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });
    } catch {
      return null;
    }

    if (res.status === 404 || res.status === 410) {
      return { result: 'expired', code: `${ats}_api_gone`, reason: `ATS API ${res.status} — posting removed` };
    }
    if (res.status === 200) {
      if (ashbyInterpret) {
        try {
          return await ashbyInterpret(res, parts);
        } catch {
          return null;
        }
      }
      return { result: 'active', code: `${ats}_api_ok`, reason: 'ATS API returns the posting (live)' };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
