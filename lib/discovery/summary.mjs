/**
 * Legacy human-readable scan summaries (stdout). --json callers route these to stderr.
 */

import { existsSync, writeFileSync } from 'fs';
import { computeConsecutiveFailures, loadPortalHealth } from './history.mjs';

/**
 * @param {(...args: unknown[]) => void} log
 * @param {object} ctx
 */
export function printDeepDiveSummary(log, ctx) {
  const {
    date, tasksCount, totalFound, totalFiltered, totalDupes, newOffers, dryRun,
  } = ctx;
  log(`\n${'━'.repeat(45)}`);
  log(`Deep-Dive Scan — ${date}`);
  log(`${'━'.repeat(45)}`);
  log(`Tasks run:             ${tasksCount}`);
  log(`Total jobs found:      ${totalFound}`);
  log(`Filtered by title:     ${totalFiltered} removed`);
  log(`Duplicates:            ${totalDupes} skipped`);
  log(`New offers added:      ${newOffers.length}`);
  if (dryRun) log('\n(dry run — run without --dry-run to save results)');
}

/**
 * @param {(...args: unknown[]) => void} log
 * @param {object} ctx
 */
export function printPortalScanSummary(log, ctx) {
  const {
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
  } = ctx;

  log(`\n${'━'.repeat(45)}`);
  log(`Portal Scan — ${date}`);
  log(`${'━'.repeat(45)}`);
  log(`Companies scanned:     ${summaryCompanies}`);
  if (summaryBoards > 0) log(`Job boards scanned:    ${summaryBoards}`);
  log(`Total jobs found:      ${counters.totalFound}`);
  if (config.title_filter || counters.totalFilteredTitle > 0) {
    log(`Filtered by title:     ${counters.totalFilteredTitle} removed`);
  }
  if (skipTiers.length > 0) {
    log(`Filtered by tier:      ${counters.totalFilteredTier} removed`);
  }
  if (config.location_filter || counters.totalFilteredLocation > 0) {
    log(`Filtered by location:  ${counters.totalFilteredLocation} removed`);
  }
  if (config.max_posting_age_days != null || counters.totalFilteredPostingAge > 0) {
    log(`Filtered by age:       ${counters.totalFilteredPostingAge} removed`);
  }
  if (effectiveAfter || postedBefore) {
    log(`Filtered by posted date: ${counters.totalFilteredPostedDate} removed`);
  }
  if (config.salary_filter || counters.totalFilteredSalary > 0) {
    log(`Filtered by salary:    ${counters.totalFilteredSalary} removed`);
  }
  if (config.content_filter || counters.totalFilteredContent > 0) {
    log(`Filtered by content:   ${counters.totalFilteredContent} removed`);
  }
  if (config.country_eligibility_filter || counters.totalFilteredCountryEligibility > 0) {
    log(`Filtered by country eligibility: ${counters.totalFilteredCountryEligibility} removed`);
  }
  if (visaEnabled) {
    log(`Filtered by visa:      ${counters.totalFilteredVisa} removed`);
  }
  if (Object.keys(windows).length > 0 || counters.totalFilteredCooldown > 0) {
    log(`Filtered by cooldown:  ${counters.totalFilteredCooldown} removed`);
  }
  log(`Duplicates:            ${counters.totalDupes} skipped`);
  if (blacklist.size > 0) {
    if (includeBlacklisted) {
      log(`Blacklisted:           ${counters.annotatedBlacklisted} let through annotated (--include-blacklisted)`);
    } else {
      log(`Blacklisted:           ${counters.totalFilteredBlacklist} skipped (blacklist)`);
    }
  }
  if (crossListings.length > 0) {
    log(`\n⚠️  Possible cross-listings (same JD text, different company) — warn only, nothing was dropped:`);
    for (const { offer, row, score } of crossListings) {
      log(`  - ${offer.company} — ${offer.title}`);
      log(`    ≈ ${Math.round(score * 100)}% of ${row.company} — ${row.title} (seen ${row.dateStr})`);
      log(`    ${offer.url}`);
      log(`    vs ${row.url}`);
    }
    log(`  If one side is an agency, apply through ONE channel only — a double submission burns both (#1596).`);
  }
  if (historyPolicy.recheckAfterDays != null) {
    log(`Recheck eligible:      ${seenUrlState.recheckEligible} old scan-history URL(s)`);
  }
  if (verify) {
    log(`Expired (verified):    ${expiredOffers.length} dropped`);
    log(`Rediscovered (moved):  ${migratedOffers.length} migrated`);
    log(`No apply control:      ${droppedOffers.length} dropped`);
    log(`Invalid (guarded):     ${invalidOffers.length} dropped`);
  }
  log(`New offers added:      ${verifiedOffers.length}`);

  if (config.trust_filter && config.trust_filter.enabled !== false && verifiedOffers.length > 0) {
    const trustHigh = verifiedOffers.filter((o) => o.trustLevel === 'high').length;
    const trustMedium = verifiedOffers.filter((o) => o.trustLevel === 'medium').length;
    const trustLow = verifiedOffers.filter((o) => o.trustLevel === 'low').length;
    log(`Trust validation:      ${trustHigh} high, ${trustMedium} medium, ${trustLow} low`);
    const flagCounts = {};
    for (const o of verifiedOffers) {
      for (const f of (o.trustFlags || [])) {
        flagCounts[f] = (flagCounts[f] || 0) + 1;
      }
    }
    if (Object.keys(flagCounts).length > 0) {
      const parts = Object.entries(flagCounts).map(([k, v]) => `${k}: ${v}`);
      log(`Trust flags:           ${parts.join(', ')}`);
    }
  }

  if (agentHandoff.length > 0) {
    log(`Agent/WebSearch handoff: ${agentHandoff.length} compan${agentHandoff.length === 1 ? 'y' : 'ies'} not handled by zero-token providers`);
    for (const item of agentHandoff.slice(0, 25)) {
      const hint = item.query ? ` — ${item.query}` : '';
      log(`  • ${item.company} (${item.method})${hint}`);
    }
    if (agentHandoff.length > 25) {
      log(`  … ${agentHandoff.length - 25} more omitted; narrow with --company or inspect portals.yml`);
    }
  }

  const unreachableTargets = errors.filter((e) => e.kind === 'slug_gone');
  const networkTargets = errors.filter((e) => e.kind === 'network');
  const otherErrors = errors.filter((e) => e.kind !== 'slug_gone' && e.kind !== 'network');
  const STREAK_THRESHOLD = config.portal_health_threshold || 3;

  const errorKindByCompany = new Map(
    errors.filter((e) => e.kind).map((e) => [e.company, e.kind]),
  );
  const healthRecords = targets.map((t) => {
    let status = errorKindByCompany.get(t.name) || 'reachable';
    if (status === 'reachable' && emptyTargets.includes(t.name)) status = 'empty';
    return { timestamp: new Date().toISOString(), company: t.name, status };
  });

  const pastHealth = loadPortalHealth(paths.portalHealthPath);
  const currentStreaks = computeConsecutiveFailures([...pastHealth, ...healthRecords]);

  const persistentlyDead = [];
  const newlyDeadSlug = [];
  const newlyDeadNetwork = [];

  for (const e of [...unreachableTargets, ...networkTargets, ...otherErrors.filter((x) => x.kind)]) {
    const streak = currentStreaks.get(e.company) || 1;
    if (streak >= STREAK_THRESHOLD) {
      if (!persistentlyDead.includes(e.company)) persistentlyDead.push(e.company);
    } else if (e.kind === 'slug_gone') {
      if (!newlyDeadSlug.some((x) => x.company === e.company)) newlyDeadSlug.push(e);
    } else if (e.kind === 'network') {
      newlyDeadNetwork.push(e);
    }
  }

  if (persistentlyDead.length > 0) {
    log(`\n🚨 FIX NEEDED: ${persistentlyDead.length} target(s) have been unreachable for ${STREAK_THRESHOLD}+ runs:`);
    log(`   ${persistentlyDead.join(', ')}`);
    log(`   Run: node verify-portals.mjs to check if the ATS migrated, or update their board slugs.`);
  }
  if (newlyDeadSlug.length > 0) {
    const names = newlyDeadSlug.map((x) => x.company).join(', ');
    log(`\n⚠️  ${newlyDeadSlug.length} target(s) unreachable (slug?): ${names} — run: node verify-portals.mjs`);
  }
  if (emptyTargets.length > 0) {
    log(`🟡 ${emptyTargets.length} target(s) live but empty: ${emptyTargets.join(', ')}`);
  }
  if (newlyDeadNetwork.length > 0) {
    log(`\nNetwork errors (${newlyDeadNetwork.length}):`);
    for (const e of newlyDeadNetwork) {
      log(`  ✗ ${e.company}: ${e.error}`);
    }
  }
  if (otherErrors.length > 0) {
    log(`\nErrors (${otherErrors.length}):`);
    for (const e of otherErrors) {
      log(`  ✗ ${e.company}: ${e.error}`);
    }
  }

  if (verifiedOffers.length > 0) {
    log('\nNew offers:');
    for (const o of verifiedOffers) {
      const trustSuffix = o.trustScore != null && o.trustScore < 100
        ? ` [Trust: ${o.trustScore}/100${o.trustFlags?.length ? ` — ${o.trustFlags.join(', ')}` : ''}]`
        : '';
      const blacklistSuffix = o.blacklisted ? ' [BLACKLISTED — on your do-not-apply list]' : '';
      log(`  + ${o.company} | ${o.title} | ${o.location || 'N/A'}${trustSuffix}${blacklistSuffix}`);
    }
    if (dryRun) {
      log('\n(dry run — run without --dry-run to save results)');
    } else {
      log(`\nResults saved to ${paths.pipelinePath} and ${paths.scanHistoryPath}`);
    }
  }

  log(`\n→ Run /career-ops pipeline to evaluate new offers.`);
  log('→ Share results and get help: https://discord.gg/8pRpHETxa4');

  return { healthRecords };
}

/**
 * @param {{ dryRun?: boolean, argv?: string[], manifestoPath?: string }} [opts]
 */
export function maybePrintManifestoNote(log, { dryRun = false, argv = process.argv, manifestoPath = '.manifesto-noted' } = {}) {
  if (!dryRun && process.stdout.isTTY && !argv.includes('--quiet') && !existsSync(manifestoPath)) {
    const osc8 = ['iTerm.app', 'WezTerm', 'vscode', 'ghostty', 'Hyper', 'Tabby'].includes(process.env.TERM_PROGRAM)
      || !!process.env.WT_SESSION || !!process.env.KITTY_WINDOW_ID
      || parseInt(process.env.VTE_VERSION || '0', 10) >= 5000;
    const link = osc8
      ? '\x1b]8;;https://career-ops.org/manifesto?utm_source=cli\x1b\\career-ops.org/manifesto\x1b]8;;\x1b\\'
      : 'career-ops.org/manifesto?utm_source=cli';
    log(`\nthe practice behind this tool has a name and a manifesto: ${link}`);
    try { writeFileSync(manifestoPath, `${new Date().toISOString()}\n`); } catch { /* best-effort */ }
  }
}
