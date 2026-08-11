/**
 * Scan pipeline — normalization, enrichment, filtering, dedupe, verify, and sinks.
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import { makeHttpCtx } from '../../providers/_http.mjs';
import { buildTrustValidator } from '../../providers/_trust-validator.mjs';
import { loadProviders, resolveProvider } from '../../providers/_registry.mjs';
import { mergeProviderPlugins } from '../../plugins/_engine.mjs';
import { classifyFetchError } from '../../verify-portals.mjs';
import { normalizeCompany } from '../../tracker-utils.mjs';
import { flagValue, hasFlag } from '../cli-flags.mjs';
import { discoveryPaths } from './paths.mjs';
import {
  buildTitleFilter,
  buildLocationFilter,
  buildPostingAgeFilter,
  buildPostedDateFilter,
  buildContentFilter,
  buildCountryEligibilityFilter,
  buildVisaFilter,
  buildSalaryFilter,
  buildCooldownFilter,
  matchedTitleKeywords,
  parseSinceDays,
  resolveEffectiveAfter,
  resolveEarlyStopMs,
  validatePostedDateBound,
  loadCandidateCountry,
  loadReApplyWindows,
} from './filters.mjs';
import {
  scanHistoryPolicy,
  loadSeenUrls,
  loadSeenCompanyRoles,
  buildCompanyCanonicalizer,
  companyRoleDedupKey,
  normalizeUrlForDedup,
} from './dedupe.mjs';
import {
  appendToPipeline,
  appendToScanHistory,
  appendScanRunSummary,
  appendPortalHealth,
  loadBlacklist,
} from './history.mjs';
import { createScanResult, serializeScanResult } from './scan-result.mjs';
import { getDeepDiveScrapers } from './browser-transport.mjs';
import { createLivenessSession } from './liveness/session.mjs';
import { extractCareersUrlDomain } from './rediscovery.mjs';
import { printDeepDiveSummary, printPortalScanSummary, maybePrintManifestoNote } from './summary.mjs';

const GUARD_CODES = new Set(['invalid_url', 'unsupported_protocol', 'blocked_host']);

function guardStatusFor(code) {
  if (code === 'blocked_host') return 'skipped_blocked_host';
  return 'skipped_invalid_url';
}

async function parallelFetch(tasks, limit) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < tasks.length) {
      const task = tasks[i++];
      results.push(await task());
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => next());
  await Promise.all(workers);
  return results;
}

/**
 * Run the portal scan pipeline (provider fetch → filter → dedupe → optional verify → sinks).
 *
 * @param {object} opts
 * @returns {Promise<import('./scan-result.mjs').ScanResult>}
 */
export async function runPortalScan(opts) {
  const started = Date.now();
  const paths = opts.paths ?? discoveryPaths();
  const args = opts.argv ?? process.argv.slice(2);
  const dryRun = opts.dryRun ?? args.includes('--dry-run');
  const deepDive = opts.deepDive ?? args.includes('--deep-dive');
  const verify = opts.verify ?? args.includes('--verify');
  const headedFallback = opts.headedFallback ?? args.includes('--headed-fallback');
  const throttleArg = args.find((a) => a === '--throttle' || a.startsWith('--throttle='));
  const throttleBaseMs = throttleArg ? (Number(throttleArg.split('=')[1]) || 5000) : 0;
  const rediscover = opts.rediscover ?? args.includes('--rediscover-404');
  const includeBlacklisted = opts.includeBlacklisted ?? args.includes('--include-blacklisted');
  const jsonMode = opts.json ?? args.includes('--json');
  const log = jsonMode ? (...a) => console.error(...a) : (...a) => console.log(...a);

  const requireValue = (flag) => {
    const value = flagValue(args, flag);
    if (value === undefined || value === '') {
      if (hasFlag(args, flag)) throw new Error(`${flag} requires a value`);
      return null;
    }
    return value;
  };

  const filterCompany = requireValue('--company')?.toLowerCase() ?? null;
  const postedAfter = requireValue('--posted-after');
  const postedBefore = requireValue('--posted-before');
  if (postedAfter != null) validatePostedDateBound('--posted-after', postedAfter);
  if (postedBefore != null) validatePostedDateBound('--posted-before', postedBefore);
  const since = parseSinceDays(args);
  if (since.error) throw new Error(since.error);
  const sinceDays = since.days;
  const effectiveAfter = resolveEffectiveAfter(postedAfter, sinceDays);

  mkdirSync(paths.dataRoot ? path.join(paths.dataRoot, 'data') : 'data', { recursive: true });

  const providers = await loadProviders(paths.providersDir);
  await mergeProviderPlugins(providers, { root: path.dirname(paths.providersDir) });
  if (providers.size === 0) throw new Error('no providers loaded from providers/');

  if (!existsSync(paths.portalsPath)) throw new Error('portals.yml not found. Run onboarding first.');

  const config = yaml.load(readFileSync(paths.portalsPath, 'utf-8')) || {};
  const companies = Array.isArray(config.tracked_companies) ? config.tracked_companies : [];
  const boards = Array.isArray(config.job_boards) ? config.job_boards : [];
  const titleFilter = buildTitleFilter(config.title_filter);

  if (deepDive) {
    const scrapers = await getDeepDiveScrapers();
    if (!scrapers) throw new Error('Deep-dive scrapers not available. Run: npm install');
    const deepDiveConfig = config.deep_dive || {};
    const tasks = (Array.isArray(deepDiveConfig.tasks) ? deepDiveConfig.tasks : []).filter((t) => t?.enabled !== false);
    if (tasks.length === 0) throw new Error('No deep-dive tasks configured in portals.yml.');

    log(`Deep-dive scan: ${tasks.length} task(s) configured`);
    if (dryRun) log('(dry run — no files will be written)\n');

    const historyPolicy = scanHistoryPolicy(config);
    const seenUrls = loadSeenUrls(historyPolicy, paths).seen;
    const canonicalizeCompany = buildCompanyCanonicalizer(config.company_aliases);
    const seenCompanyRoles = loadSeenCompanyRoles(paths.applicationsPath, canonicalizeCompany, { policy: historyPolicy, ...paths });
    const date = new Date().toISOString().slice(0, 10);
    let totalFound = 0;
    let totalFiltered = 0;
    let totalDupes = 0;
    const newOffers = [];

    const results = await scrapers.runDeepDive(tasks, {
      headless: deepDiveConfig.headless !== false,
      concurrency: deepDiveConfig.concurrency || 1,
      onProgress: (name, count) => log(`  → ${name}: ${count} jobs scraped`),
    });

    for (const [name, result] of Object.entries(results)) {
      if (result.errors) {
        console.warn(`  ✗ ${name}: ${result.errors}`);
        continue;
      }
      totalFound += result.jobs.length;
      for (const job of result.jobs) {
        if (!titleFilter(job.title)) { totalFiltered++; continue; }
        const dedupUrl = normalizeUrlForDedup(job.url);
        const key = companyRoleDedupKey(job.company, job.title, canonicalizeCompany);
        if (seenUrls.has(dedupUrl) || seenCompanyRoles.has(key)) { totalDupes++; continue; }
        seenUrls.add(dedupUrl);
        seenCompanyRoles.add(key);
        newOffers.push({ ...job, source: job.source || name });
      }
    }

    if (!dryRun && newOffers.length > 0) {
      await appendToPipeline(newOffers, paths);
      appendToScanHistory(newOffers, date, 'added', paths);
    }

    const result = createScanResult({
      dryRun,
      deepDive: true,
      counts: { tasks: tasks.length, found: totalFound, filteredTitle: totalFiltered, dupes: totalDupes, newAdded: newOffers.length },
      offers: newOffers.map((o) => ({ company: o.company, title: o.title, url: o.url, location: o.location || null, source: o.source })),
      elapsedMs: Date.now() - started,
      artifactPaths: dryRun ? undefined : { pipeline: paths.pipelinePath, scanHistory: paths.scanHistoryPath },
    });

    printDeepDiveSummary(log, {
      date,
      tasksCount: tasks.length,
      totalFound,
      totalFiltered,
      totalDupes,
      newOffers,
      dryRun,
    });

    if (jsonMode) process.stdout.write(serializeScanResult(result));
    return result;
  }

  let classifyTier = null;
  const skipTiers = Array.isArray(config.skip_tiers)
    ? config.skip_tiers.filter((t) => typeof t === 'string').map((t) => t.toLowerCase())
    : [];
  if (skipTiers.length > 0) {
    const mod = await import('../../classify-tier.mjs');
    classifyTier = mod.classifyTier || mod.default;
  }

  const locationFilter = buildLocationFilter(config.location_filter);
  const postingAgeFilter = buildPostingAgeFilter(config.max_posting_age_days);
  const postedDateFilter = buildPostedDateFilter(effectiveAfter, postedBefore);
  const earlyStopSinceMs = resolveEarlyStopMs(effectiveAfter, config.max_posting_age_days);
  const salaryFilter = buildSalaryFilter(config.salary_filter);
  const trustValidator = buildTrustValidator(config.trust_filter);
  const contentFilter = buildContentFilter(config.content_filter);
  const countryEligibilityFilter = buildCountryEligibilityFilter(config.country_eligibility_filter, loadCandidateCountry(paths.profilePath));
  const visaFilter = buildVisaFilter(config.visa_filter);
  const visaEnabled = Boolean(config.visa_filter && config.visa_filter.enabled !== false);
  const blacklist = loadBlacklist(paths.blacklistPath);
  const historyPolicy = scanHistoryPolicy(config);
  const seenUrlState = loadSeenUrls(historyPolicy, paths);
  const seenUrls = seenUrlState.seen;
  const canonicalizeCompany = buildCompanyCanonicalizer(config.company_aliases);
  const seenCompanyRoles = loadSeenCompanyRoles(paths.applicationsPath, canonicalizeCompany, { policy: historyPolicy, scanHistoryPath: paths.scanHistoryPath, pipelinePath: paths.pipelinePath });

  const targets = [];
  let skippedCount = 0;
  let boardCount = 0;
  const resolveErrors = [];
  const agentHandoff = [];

  function resolveEntries(entries, { isBoard = false } = {}) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.enabled === false) continue;
      if (typeof entry.name !== 'string' || !entry.name.trim()) {
        console.error(`⚠️  Skipping entry — missing or non-string 'name' field: ${JSON.stringify(entry)}`);
        continue;
      }
      if (filterCompany && !entry.name.toLowerCase().includes(filterCompany)) continue;
      const resolved = resolveProvider(entry, providers);
      if (!resolved) {
        skippedCount++;
        if (entry.scan_method === 'websearch') {
          agentHandoff.push({
            company: entry.name,
            method: 'websearch',
            query: entry.scan_query || entry.search_query || entry.careers_url || '',
          });
        }
        continue;
      }
      if (resolved.error) { resolveErrors.push({ company: entry.name, error: resolved.error }); continue; }
      targets.push({ ...entry, _provider: resolved.provider, _isBoard: isBoard });
      if (isBoard) boardCount++;
    }
  }

  resolveEntries(companies);
  resolveEntries(boards, { isBoard: true });

  const localParserCount = targets.filter((t) => t._provider.id === 'local-parser').length;
  const companyCount = targets.length - boardCount;
  const parts = [`${companyCount} companies`];
  if (boardCount > 0) parts.push(`${boardCount} job boards`);
  parts.push(`${localParserCount} local parser`);
  parts.push(`${skippedCount} skipped — no provider matched`);
  log(`Scanning ${parts.join('; ')} via providers`);
  if (dryRun) log('(dry run — no files will be written)\n');

  const date = new Date().toISOString().slice(0, 10);
  const windows = loadReApplyWindows(paths.profilePath);
  const cooldownFilter = buildCooldownFilter(windows, date);
  const counters = {
    totalFound: 0, totalFilteredTitle: 0, totalFilteredTier: 0, totalFilteredLocation: 0,
    totalFilteredPostingAge: 0, totalFilteredPostedDate: 0, totalFilteredSalary: 0,
    totalFilteredContent: 0, totalFilteredCountryEligibility: 0, totalFilteredBlacklist: 0,
    annotatedBlacklisted: 0, totalFilteredVisa: 0, totalFilteredCooldown: 0, totalDupes: 0,
  };
  const newOffers = [];
  const errors = [...resolveErrors];
  const emptyTargets = [];
  const cooldownOffers = [];

  const CONCURRENCY = opts.concurrency ?? 10;
  const tasks = targets.map((company) => async () => {
    let provider = company._provider;
    const ctx = { ...makeHttpCtx(), sinceMs: earlyStopSinceMs, includeUndated: true };
    let sourceName = provider.id === 'local-parser' ? 'local-parser' : `${provider.id}-api`;
    try {
      let jobs;
      try {
        jobs = await provider.fetch(company, ctx);
      } catch (parserErr) {
        if (provider.id !== 'local-parser') throw parserErr;
        const fallback = resolveProvider(company, providers, { skipIds: ['local-parser'] });
        if (!fallback || fallback.error) throw parserErr;
        provider = fallback.provider;
        sourceName = `${provider.id}-api`;
        jobs = await provider.fetch(company, ctx);
        errors.push({ company: company.name, error: `local parser failed, used API fallback: ${parserErr.message}` });
      }
      if (!Array.isArray(jobs)) throw new Error(`${provider.id}: fetch() did not return an array`);
      counters.totalFound += jobs.length;
      if (!company._isBoard && jobs.length === 0) emptyTargets.push(company.name);

      for (const job of jobs) {
        const trustResult = trustValidator(job);
        job.trustScore = trustResult.score;
        job.trustFlags = trustResult.flags;
        job.trustLevel = trustResult.level;

        if (blacklist.size > 0) {
          const blEntry = blacklist.get(normalizeCompany(job.company || company.name || ''));
          if (blEntry) {
            if (!includeBlacklisted) { counters.totalFilteredBlacklist++; continue; }
            counters.annotatedBlacklisted++;
            job.blacklisted = true;
            const label = `blacklisted${blEntry.reason ? `: ${blEntry.reason}` : ''}`;
            job.note = typeof job.note === 'string' && job.note.trim() ? `${label} — ${job.note}` : label;
          }
        }

        if (!titleFilter(job.title)) { counters.totalFilteredTitle++; continue; }
        if (classifyTier && skipTiers.includes(classifyTier(job.title))) { counters.totalFilteredTier++; continue; }
        if (!locationFilter(job.location, job.url, job.title)) { counters.totalFilteredLocation++; continue; }
        if (!postingAgeFilter(job.postedAt)) { counters.totalFilteredPostingAge++; continue; }
        if (!postedDateFilter(job.postedAt)) { counters.totalFilteredPostedDate++; continue; }
        if (!salaryFilter(job.salary)) { counters.totalFilteredSalary++; continue; }
        if (!contentFilter(job.description, matchedTitleKeywords(job.title, config.title_filter))) { counters.totalFilteredContent++; continue; }
        if (!countryEligibilityFilter(job.description)) { counters.totalFilteredCountryEligibility++; continue; }
        if (!visaFilter(job.description)) { counters.totalFilteredVisa++; continue; }

        const dedupUrl = normalizeUrlForDedup(job.url);
        if (seenUrls.has(dedupUrl)) { counters.totalDupes++; continue; }
        const key = companyRoleDedupKey(job.company, job.title, canonicalizeCompany);
        if (seenCompanyRoles.has(key)) { counters.totalDupes++; continue; }

        const cooldownResult = cooldownFilter(job);
        if (cooldownResult.skip) {
          counters.totalFilteredCooldown++;
          cooldownOffers.push({ job: { ...job, source: sourceName }, status: cooldownResult.reason });
          continue;
        }

        seenUrls.add(dedupUrl);
        seenCompanyRoles.add(key);
        const careersUrlDomain = extractCareersUrlDomain(company.careers_url);
        newOffers.push({ ...job, source: sourceName, tracked: Boolean(careersUrlDomain), careersUrlDomain });
      }
    } catch (err) {
      errors.push({ company: company.name, error: err.message, kind: classifyFetchError(err) });
    }
  });

  await parallelFetch(tasks, CONCURRENCY);

  let verifiedOffers = newOffers;
  let expiredOffers = [];
  let droppedOffers = [];
  let invalidOffers = [];
  let migratedOffers = [];
  if (verify && newOffers.length > 0) {
    log(`\nVerifying liveness of ${newOffers.length} new offer(s) with Playwright (sequential)...`);
    const session = createLivenessSession({ headedFallback, throttleBaseMs });
    try {
      const { searchForNewUrl } = await import('./rediscovery.mjs');
      const v = await session.verifyOffers(newOffers, { rediscover, searchForNewUrl, log });
      verifiedOffers = v.verified;
      expiredOffers = v.expired;
      droppedOffers = v.dropped;
      invalidOffers = v.invalid;
      migratedOffers = v.migrated;
      if (migratedOffers.length > 0) verifiedOffers = [...verifiedOffers, ...migratedOffers];
    } catch (err) {
      throw new Error(
        `--verify could not launch Chromium (run "npx playwright install chromium" or re-run without --verify): ${err.message}`,
        { cause: err },
      );
    } finally {
      await session.close();
    }
  }

  const { fingerprintText, findCrossListings } = await import('../../fingerprint-core.mjs');
  for (const offer of verifiedOffers) {
    offer.fingerprint = fingerprintText(offer.description);
  }
  const { loadFingerprintHistory } = await import('./history.mjs');
  const crossListings = findCrossListings(verifiedOffers, loadFingerprintHistory(paths.scanHistoryPath));

  if (!dryRun && verifiedOffers.length > 0) {
    await appendToPipeline(verifiedOffers, paths);
    appendToScanHistory(verifiedOffers, date, 'added', paths);
  }
  if (!dryRun && cooldownOffers.length > 0) {
    const groups = {};
    for (const item of cooldownOffers) {
      if (!groups[item.status]) groups[item.status] = [];
      groups[item.status].push(item.job);
    }
    for (const [status, group] of Object.entries(groups)) {
      appendToScanHistory(group, date, status, paths);
    }
  }
  const expiredForHistory = [...expiredOffers, ...migratedOffers.map((o) => ({ ...o, url: o.previousUrl }))];
  if (!dryRun && expiredForHistory.length > 0) appendToScanHistory(expiredForHistory, date, 'skipped_expired', paths);
  if (!dryRun && droppedOffers.length > 0) appendToScanHistory(droppedOffers, date, 'skipped_no_apply_control', paths);
  if (!dryRun && invalidOffers.length > 0) {
    const byStatus = new Map();
    for (const o of invalidOffers) {
      const status = guardStatusFor(o.code);
      if (!byStatus.has(status)) byStatus.set(status, []);
      byStatus.get(status).push(o);
    }
    for (const [status, group] of byStatus) appendToScanHistory(group, date, status, paths);
  }

  const summaryCompanies = targets.filter((t) => !t._isBoard).length;
  const summaryBoards = targets.filter((t) => t._isBoard).length;

  const { healthRecords } = printPortalScanSummary(log, {
    date,
    config,
    paths,
    targets,
    summaryCompanies,
    summaryBoards,
    counters,
    effectiveAfter,
    postedBefore,
    skipTiers,
    visaEnabled,
    windows,
    blacklist,
    includeBlacklisted,
    historyPolicy,
    seenUrlState,
    verify,
    expiredOffers,
    migratedOffers,
    droppedOffers,
    invalidOffers,
    verifiedOffers,
    crossListings,
    agentHandoff,
    errors,
    emptyTargets,
    dryRun,
  });

  if (!dryRun) {
    const nowStr = new Date().toISOString();
    await appendPortalHealth(healthRecords, paths.portalHealthPath);
    appendScanRunSummary({
      timestamp: nowStr,
      status: 'completed',
      companies: summaryCompanies,
      boards: summaryBoards,
      found: counters.totalFound,
      filteredTitle: counters.totalFilteredTitle,
      filteredTier: counters.totalFilteredTier,
      filteredLocation: counters.totalFilteredLocation,
      filteredPostingAge: counters.totalFilteredPostingAge,
      filteredSalary: counters.totalFilteredSalary,
      filteredContent: counters.totalFilteredContent,
      filteredCooldown: counters.totalFilteredCooldown,
      dupes: counters.totalDupes,
      newAdded: verifiedOffers.length,
      errors: errors.length,
      filteredBlacklist: counters.totalFilteredBlacklist,
      filteredVisa: counters.totalFilteredVisa,
      filteredPostedDate: counters.totalFilteredPostedDate,
      filteredCountryEligibility: counters.totalFilteredCountryEligibility,
    }, paths.scanRunsPath);
  }

  maybePrintManifestoNote(log, { dryRun, argv: args, manifestoPath: path.join(paths.dataRoot || process.cwd(), '.manifesto-noted') });

  const scanResult = createScanResult({
    dryRun,
    verify,
    counts: {
      companies: summaryCompanies,
      boards: summaryBoards,
      found: counters.totalFound,
      filteredTitle: counters.totalFilteredTitle,
      filteredTier: counters.totalFilteredTier,
      filteredLocation: counters.totalFilteredLocation,
      filteredPostingAge: counters.totalFilteredPostingAge,
      filteredPostedDate: counters.totalFilteredPostedDate,
      filteredSalary: counters.totalFilteredSalary,
      filteredContent: counters.totalFilteredContent,
      filteredCountryEligibility: counters.totalFilteredCountryEligibility,
      filteredVisa: counters.totalFilteredVisa,
      filteredCooldown: counters.totalFilteredCooldown,
      filteredBlacklist: counters.totalFilteredBlacklist,
      dupes: counters.totalDupes,
      newAdded: verifiedOffers.length,
      expired: expiredOffers.length,
      migrated: migratedOffers.length,
      dropped: droppedOffers.length,
      invalid: invalidOffers.length,
      errors: errors.length,
    },
    offers: verifiedOffers.map((o) => ({
      company: o.company,
      title: o.title,
      url: o.url,
      location: o.location || null,
      source: o.source,
    })),
    warnings: errors.map((e) => ({ company: e.company, error: e.error, kind: e.kind })),
    elapsedMs: Date.now() - started,
    artifactPaths: dryRun ? undefined : {
      pipeline: paths.pipelinePath,
      scanHistory: paths.scanHistoryPath,
      scanRuns: paths.scanRunsPath,
    },
  });

  if (jsonMode) process.stdout.write(serializeScanResult(scanResult));
  return scanResult;
}
