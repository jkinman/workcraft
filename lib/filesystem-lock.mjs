/**
 * Advisory filesystem locks shared by tracker, batch, and pipeline writers.
 *
 * Domain modules supply lock directory names and env overrides; this module
 * owns acquisition, stale recovery, and token-verified release.
 */

import {
  readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync, realpathSync,
} from 'fs';
import { join, dirname, basename, resolve, relative, isAbsolute, sep } from 'path';
import { createHash, randomUUID } from 'crypto';
import { tmpdir } from 'os';

/** Minimum age before directory age alone may condemn an ownerless lock. */
export const OWNERLESS_GRACE_MS = 1_000;

function pathIsInside(childPath, parentDir) {
  const relativePath = relative(parentDir, childPath);
  return relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

function readLockOwner(lockDir) {
  try {
    return JSON.parse(readFileSync(join(lockDir, 'owner.json'), 'utf-8'));
  } catch {
    return null;
  }
}

function sameLockDirectory(left, right) {
  return left.dev === right.dev && left.ino === right.ino
    && (left.ino !== 0 || left.birthtimeMs === right.birthtimeMs);
}

function lockCanRecover(lockDir, staleMs) {
  const owner = readLockOwner(lockDir);
  if (owner?.pid) return !processIsAlive(owner.pid);

  try {
    return Date.now() - statSync(lockDir).mtimeMs > Math.max(staleMs, OWNERLESS_GRACE_MS);
  } catch {
    return true;
  }
}

/**
 * Resolve a lock directory under the OS temp dir from a stable key + prefix.
 *
 * @param {string} lockKey - Stable hash input (e.g. canonical tracker path).
 * @param {string} prefix - Domain prefix (e.g. career-ops-merge-tracker-).
 * @param {string} [envVar] - Optional env override name.
 */
export function resolveTempLockDir(lockKey, prefix, envVar) {
  const digest = createHash('sha256').update(lockKey).digest('hex').slice(0, 16);
  const tmpRoot = realpathSync(tmpdir());
  const fallback = join(tmpRoot, `${prefix}${digest}.lock`);
  const envValue = envVar ? process.env[envVar] : undefined;
  if (!envValue || !isAbsolute(envValue)) return fallback;

  const candidate = resolve(envValue);
  const parentDir = dirname(candidate);
  const canonicalParent = existsSync(parentDir) ? realpathSync(parentDir) : resolve(parentDir);
  if (!pathIsInside(canonicalParent, tmpRoot)) return fallback;
  if (!basename(candidate).startsWith(prefix)) return fallback;
  return candidate;
}

/**
 * Acquire an exclusive filesystem lock directory.
 *
 * @param {string} lockDir
 * @param {object} [options]
 * @param {number} [options.timeoutMs=60000]
 * @param {number} [options.retryMs=75]
 * @param {number} [options.staleMs=600000]
 * @param {Record<string, unknown>} [options.ownerMeta] - Extra owner.json fields.
 * @param {Function} [options.removeLock]
 */
export async function acquireFilesystemLock(lockDir, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const retryMs = options.retryMs ?? 75;
  const staleMs = options.staleMs ?? 10 * 60_000;
  const recoverGuardDir = `${lockDir}.recover`;
  const token = randomUUID();
  const startedAt = Date.now();
  let attempts = 0;
  let staleRecovered = false;

  while (Date.now() - startedAt < timeoutMs) {
    attempts++;
    try {
      mkdirSync(lockDir);
      try {
        writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({
          pid: process.pid,
          token,
          started_at: new Date().toISOString(),
          ...(options.tracker ? { tracker: options.tracker } : {}),
          ...options.ownerMeta,
        }, null, 2));
      } catch (ownerErr) {
        rmSync(lockDir, { recursive: true, force: true });
        throw ownerErr;
      }

      let ownerVerified = false;
      let verifiedDir = null;
      let released = false;
      const removeLock = typeof options.removeLock === 'function'
        ? options.removeLock
        : path => rmSync(path, { recursive: true, force: true });

      return {
        attempts,
        waitMs: Date.now() - startedAt,
        staleRecovered,
        token,
        release() {
          if (released) return;
          if (ownerVerified) {
            let currentDir;
            try {
              currentDir = statSync(lockDir);
            } catch (err) {
              if (err?.code === 'ENOENT') {
                released = true;
                return;
              }
              throw err;
            }
            if (!sameLockDirectory(verifiedDir, currentDir)) {
              released = true;
              return;
            }
            const owner = readLockOwner(lockDir);
            if (owner && owner.token !== token) {
              released = true;
              return;
            }
            if (!owner && existsSync(join(lockDir, 'owner.json'))) {
              throw new Error(`Cannot verify lock ownership at ${lockDir}`);
            }
          } else {
            let beforeRead;
            try {
              beforeRead = statSync(lockDir);
            } catch (err) {
              if (err?.code === 'ENOENT') {
                released = true;
                return;
              }
              throw err;
            }
            const owner = readLockOwner(lockDir);
            if (owner?.token !== token) {
              if (owner) released = true;
              else throw new Error(`Cannot verify lock ownership at ${lockDir}`);
              return;
            }
            const afterRead = statSync(lockDir);
            if (!sameLockDirectory(beforeRead, afterRead)) {
              released = true;
              return;
            }
            ownerVerified = true;
            verifiedDir = afterRead;
          }
          removeLock(lockDir);
          released = true;
        },
      };
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;

      let hasRecoverGuard = false;
      try {
        mkdirSync(recoverGuardDir);
        hasRecoverGuard = true;
      } catch (guardErr) {
        if (guardErr?.code !== 'EEXIST') throw guardErr;
        if (lockCanRecover(recoverGuardDir, staleMs)) {
          rmSync(recoverGuardDir, { recursive: true, force: true });
        }
      }

      if (hasRecoverGuard) {
        try {
          if (lockCanRecover(lockDir, staleMs)) {
            rmSync(lockDir, { recursive: true, force: true });
            staleRecovered = true;
            continue;
          }
        } finally {
          rmSync(recoverGuardDir, { recursive: true, force: true });
        }
      }

      await sleep(retryMs);
    }
  }

  const timeoutErr = new Error(
    options.lockLabel
      ? `Timed out waiting for ${options.lockLabel} lock at ${lockDir}`
      : `Timed out waiting for lock at ${lockDir}`,
  );
  timeoutErr.code = 'LOCK_TIMEOUT';
  throw timeoutErr;
}

/** Tracker lock directory for a canonical applications.md path. */
export function trackerLockDirFor(appsFile) {
  return resolveTempLockDir(appsFile, 'career-ops-merge-tracker-', 'CAREER_OPS_TRACKER_LOCK');
}

/** Batch state lock directory for a batch-state.tsv path. */
export function batchStateLockDirFor(stateFilePath) {
  return resolveTempLockDir(stateFilePath, 'career-ops-batch-state-', 'CAREER_OPS_BATCH_STATE_LOCK');
}

/** Follow-ups lock directory. */
export function followupsLockDirFor(followupsPath) {
  return resolveTempLockDir(followupsPath, 'career-ops-followups-', 'CAREER_OPS_FOLLOWUPS_LOCK');
}

/** Back-compat alias used by tracker-utils callers. */
export async function acquireTrackerLock(lockDir, options = {}) {
  return acquireFilesystemLock(lockDir, { ...options, lockLabel: 'tracker' });
}
