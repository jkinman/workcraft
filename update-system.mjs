#!/usr/bin/env node

/**
 * update-system.mjs — Safe auto-updater for career-ops
 *
 * Updates ONLY system layer files (modes, scripts, dashboard, templates).
 * NEVER touches user data (cv.md, profile.yml, _profile.md, data/, reports/).
 *
 * Usage:
 *   node update-system.mjs check      # Check if update available
 *   node update-system.mjs apply      # Apply update (after user confirms)
 *   node update-system.mjs rollback   # Rollback last update
 *   node update-system.mjs dismiss    # Dismiss update check
 *
 * See DATA_CONTRACT.md for the full system/user layer definitions.
 */

import { execFileSync, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

const CANONICAL_REPO = 'https://github.com/santifer/career-ops.git';
const RAW_VERSION_URL = 'https://raw.githubusercontent.com/santifer/career-ops/main/VERSION';
const RELEASES_API = 'https://api.github.com/repos/santifer/career-ops/releases/latest';

// System layer paths — ONLY these files get updated.
// Fork layer paths are filtered out even when a system directory is updated.
export const SYSTEM_PATHS = [
  'modes/_shared.md',
  'modes/_profile.template.md',
  'modes/oferta.md',
  'modes/pdf.md',
  'modes/scan.md',
  'modes/batch.md',
  'modes/apply.md',
  'modes/auto-pipeline.md',
  'modes/contacto.md',
  'modes/deep.md',
  'modes/ofertas.md',
  'modes/pipeline.md',
  'modes/project.md',
  'modes/tracker.md',
  'modes/training.md',
  'modes/de/',
  'CLAUDE.md',
  'AGENTS.md',
  'generate-pdf.mjs',
  'merge-tracker.mjs',
  'verify-pipeline.mjs',
  'dedup-tracker.mjs',
  'normalize-statuses.mjs',
  'cv-sync-check.mjs',
  'update-system.mjs',
  'batch/batch-prompt.md',
  'batch/batch-runner.sh',
  'dashboard/',
  'templates/',
  'fonts/',
  '.claude/skills/',
  'docs/',
  'VERSION',
  'DATA_CONTRACT.md',
  'CONTRIBUTING.md',
  'README.md',
  'LICENSE',
  'CITATION.cff',
  '.github/',
  'package.json',
];

export const FORK_PATHS = [
  'dashboard-web/',
  'lib/path-roots.mjs',
  'docs/HOSTED_VERCEL_READINESS.md',
  'docs/FORK_LAYER.md',
];

// User layer paths — NEVER touch these (safety check)
export const USER_PATHS = [
  'cv.md',
  'config/profile.yml',
  'modes/_profile.md',
  'portals.yml',
  'article-digest.md',
  'interview-prep/story-bank.md',
  'data/',
  'reports/',
  'output/',
  'jds/',
];

function localVersion() {
  const vPath = join(ROOT, 'VERSION');
  return existsSync(vPath) ? readFileSync(vPath, 'utf-8').trim() : '0.0.0';
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', timeout: 30000 }).trim();
}

function pathMatches(candidate, protectedPath) {
  return protectedPath.endsWith('/')
    ? candidate.startsWith(protectedPath)
    : candidate === protectedPath;
}

export function isForkPath(path) {
  return FORK_PATHS.some(forkPath => pathMatches(path, forkPath));
}

function remoteFilesForPath(ref, path) {
  if (!path.endsWith('/')) return [path];
  try {
    return git('ls-tree', '-r', '--name-only', ref, '--', path)
      .split('\n')
      .map(file => file.trim())
      .filter(Boolean);
  } catch {
    return [path];
  }
}

export function filterForkPaths(paths) {
  return paths.filter(path => !isForkPath(path));
}

function checkoutPathFromRef(ref, path) {
  const paths = filterForkPaths(remoteFilesForPath(ref, path));
  if (paths.length === 0) return [];
  git('checkout', ref, '--', ...paths);
  return paths;
}

function checkoutSystemPath(path) {
  return checkoutPathFromRef('FETCH_HEAD', path);
}

function gitStatusEntries() {
  const status = git('status', '--porcelain');
  if (!status) return [];

  return status.split('\n')
    .filter(Boolean)
    .map(line => ({
      code: line.slice(0, 2),
      path: line.slice(3),
    }));
}

function revertPaths(paths) {
  if (paths.length === 0) return;
  git('checkout', '--', ...paths);
}

function addPaths(paths) {
  if (paths.length === 0) return;
  git('add', '--', ...paths);
}

// ── CHECK ───────────────────────────────────────────────────────

async function check() {
  // Respect dismiss flag
  if (existsSync(join(ROOT, '.update-dismissed'))) {
    console.log(JSON.stringify({ status: 'dismissed' }));
    return;
  }

  const local = localVersion();
  let remote;

  try {
    const res = await fetch(RAW_VERSION_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    remote = (await res.text()).trim();
  } catch {
    console.log(JSON.stringify({ status: 'offline', local }));
    return;
  }

  if (compareVersions(local, remote) >= 0) {
    console.log(JSON.stringify({ status: 'up-to-date', local, remote }));
    return;
  }

  // Fetch changelog from GitHub releases
  let changelog = '';
  try {
    const res = await fetch(RELEASES_API, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.ok) {
      const release = await res.json();
      changelog = release.body || '';
    }
  } catch {
    // No changelog available, that's OK
  }

  console.log(JSON.stringify({
    status: 'update-available',
    local,
    remote,
    changelog: changelog.slice(0, 500),
  }));
}

// ── APPLY ───────────────────────────────────────────────────────

async function apply() {
  const local = localVersion();
  const initialStatusPaths = new Set(gitStatusEntries().map(entry => entry.path));

  // Check for lock
  const lockFile = join(ROOT, '.update-lock');
  if (existsSync(lockFile)) {
    console.error('Update already in progress (.update-lock exists). If stuck, delete it manually.');
    process.exit(1);
  }

  // Create lock
  writeFileSync(lockFile, new Date().toISOString());

  try {
    // 1. Backup: create branch
    const backupBranch = `backup-pre-update-${local}`;
    try {
      git('branch', backupBranch);
      console.log(`Backup branch created: ${backupBranch}`);
    } catch {
      console.log(`Backup branch already exists (${backupBranch}), continuing...`);
    }

    // 2. Fetch from canonical repo
    console.log('Fetching latest from upstream...');
    git('fetch', CANONICAL_REPO, 'main');

    // 3. Checkout system files only
    console.log('Updating system files...');
    const updated = [];
    for (const path of SYSTEM_PATHS) {
      try {
        updated.push(...checkoutSystemPath(path));
      } catch {
        // File may not exist in remote (new additions), skip
      }
    }

    // 4. Validate: check NO user files were touched
    let userFileTouched = false;
    try {
      for (const entry of gitStatusEntries()) {
        const file = entry.path;
        if (initialStatusPaths.has(file)) continue;
        for (const protectedPath of [...USER_PATHS, ...FORK_PATHS]) {
          if (pathMatches(file, protectedPath)) {
            console.error(`SAFETY VIOLATION: Protected file was modified: ${file}`);
            userFileTouched = true;
          }
        }
      }
    } catch {
      // git status failed, skip validation
    }

    if (userFileTouched) {
    console.error('Aborting: protected files were touched. Rolling back...');
      revertPaths(updated);
      process.exit(1);
    }

    // 5. Install any new dependencies
    try {
      execSync('npm install --silent', { cwd: ROOT, timeout: 60000 });
    } catch {
      console.log('npm install skipped (may need manual run)');
    }

    // 6. Commit the update
    const remote = localVersion(); // Re-read after checkout updated VERSION
    try {
      const pathsToStage = [...updated];
      const dismissFile = join(ROOT, '.update-dismissed');
      if (existsSync(dismissFile)) {
        unlinkSync(dismissFile);
        pathsToStage.push('.update-dismissed');
      }
      addPaths(pathsToStage);
      git('commit', '-m', `chore: auto-update system files to v${remote}`);
    } catch {
      // Nothing to commit (already up to date)
    }

    console.log(`\nUpdate complete: v${local} → v${remote}`);
    console.log(`Updated ${updated.length} system paths.`);
    console.log(`Rollback available: node update-system.mjs rollback`);

  } finally {
    // Remove lock
    if (existsSync(lockFile)) unlinkSync(lockFile);
  }
}

// ── ROLLBACK ────────────────────────────────────────────────────

function rollback() {
  // Find most recent backup branch
  try {
    const branches = git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads/backup-pre-update-*');
    const branchList = branches.split('\n').map(b => b.trim()).filter(Boolean);

    if (branchList.length === 0) {
      console.error('No backup branches found. Nothing to rollback.');
      process.exit(1);
    }

    const latest = branchList[0];
    console.log(`Rolling back to: ${latest}`);

    // Checkout system files from backup branch
    const restored = [];
    for (const path of SYSTEM_PATHS) {
      try {
        restored.push(...checkoutPathFromRef(latest, path));
      } catch {
        // File may not have existed in backup
      }
    }

    addPaths(restored);
    git('commit', '-m', `chore: rollback system files from ${latest}`);

    console.log(`Rollback complete. System files restored from ${latest}.`);
    console.log('Your data (CV, profile, tracker, reports) was not affected.');
  } catch (err) {
    console.error('Rollback failed:', err.message);
    process.exit(1);
  }
}

// ── DISMISS ─────────────────────────────────────────────────────

function dismiss() {
  writeFileSync(join(ROOT, '.update-dismissed'), new Date().toISOString());
  console.log('Update check dismissed. Run "node update-system.mjs check" or say "check for updates" to re-enable.');
}

// ── MAIN ────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'check';

  switch (cmd) {
    case 'check': await check(); break;
    case 'apply': await apply(); break;
    case 'rollback': rollback(); break;
    case 'dismiss': dismiss(); break;
    default:
      console.log('Usage: node update-system.mjs [check|apply|rollback|dismiss]');
      process.exit(1);
  }
}
