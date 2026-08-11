#!/usr/bin/env node
/**
 * Canonical filesystem transition CLI — tracker, report frontmatter, status log.
 * Used by Go dashboard and local integration tests (not Supabase tenants).
 */

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { createFilesystemDataClient } from './fs-data-client.mjs';
import { transitionApplicationState } from './transition-sync.mjs';
import { acquireTrackerLock, trackerLockDirFor } from '../filesystem-lock.mjs';

function usage() {
  console.error(`Usage: node lib/tracker/cli-transition.mjs --state STATE (--slug SLUG | --report N) [options]

Options:
  --data-root PATH   Tenant/data root (defaults to CAREER_OPS_DATA_ROOT or repo root)
  --slug SLUG        Report slug fragment (dashboard-web style)
  --report N         Report number — selects reports/{N}-*.md
  --state STATE      Canonical state label or alias
  --note TEXT        Optional note appended to tracker row
  --source ID        Status-log source tag (default: cli-transition)
  --json             JSON result on stdout
`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    dataRoot: process.env.CAREER_OPS_DATA_ROOT || '',
    slug: '',
    report: '',
    state: '',
    note: '',
    source: 'cli-transition',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data-root') opts.dataRoot = argv[++i];
    else if (a === '--slug') opts.slug = argv[++i];
    else if (a === '--report') opts.report = argv[++i];
    else if (a === '--state') opts.state = argv[++i];
    else if (a === '--note') opts.note = argv[++i];
    else if (a === '--source') opts.source = argv[++i];
    else if (a === '--json') opts.json = true;
    else usage();
  }
  if (!opts.state || (!opts.slug && !opts.report)) usage();
  return opts;
}

function slugFromReportNumber(client, reportNum) {
  const padded = String(reportNum).padStart(3, '0');
  for (const file of client.listReports()) {
    if (file.filename.startsWith(`${padded}-`)) {
      return file.filename.replace(/\.md$/, '');
    }
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.dataRoot) {
    process.env.CAREER_OPS_DATA_ROOT = opts.dataRoot;
  }
  const client = createFilesystemDataClient(opts.dataRoot || undefined);
  const paths = client.paths;
  const lock = await acquireTrackerLock(trackerLockDirFor(paths.applicationsPath), {
    timeoutMs: Number(process.env.CAREER_OPS_TRACKER_LOCK_TIMEOUT_MS) || 60_000,
    retryMs: Number(process.env.CAREER_OPS_TRACKER_LOCK_RETRY_MS) || 75,
    staleMs: Number(process.env.CAREER_OPS_TRACKER_LOCK_STALE_MS) || 10 * 60_000,
    lockLabel: 'tracker',
    tracker: paths.applicationsPath,
  });

  try {
    const slug = opts.slug || slugFromReportNumber(client, opts.report);
    if (!slug) {
      const err = { success: false, error: `Report not found: ${opts.report || opts.slug}` };
      console.log(JSON.stringify(err));
      process.exit(2);
    }

    const result = await transitionApplicationState(client, {
      slug,
      newState: opts.state,
      note: opts.note || null,
      source: opts.source,
    });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (!result.success) {
      console.error(result.error);
    } else {
      console.log(`OK ${result.previous} → ${result.state} (#${result.trackerNum})`);
    }
    process.exit(result.success ? 0 : 1);
  } finally {
    lock.release();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { parseArgs, slugFromReportNumber };
