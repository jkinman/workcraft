/**
 * Tracker core module — stable contract exports for parsing, states, locks, mutation.
 */

export {
  LEGACY_COLMAP,
  HEADER_ALIASES,
  SCORE_CELL_RE,
  SEPARATOR_ROW_RE,
  looksLikeScoreCell,
  isSeparatorRow,
  detectColumns,
  isHeaderRow,
  parseTrackerRow,
  extractTrackerReportNumbers,
  normalizeTextKey,
} from '../../tracker-parse.mjs';

export {
  rebuildRow,
  normalizeCompany,
  cell,
  resolveTrackerPath,
  resolveWorkspaceRoot,
  resolvePdfIndexPath,
  canonicalizeTrackerPath,
  openTrackerTransaction,
  writeFileAtomic,
  loadCanonicalStates,
  resolveCanonicalState,
  CLI_EXIT,
  makeCliFailWith,
  acquireTrackerLockForCli,
  OWNERLESS_GRACE_MS,
  acquireTrackerLock,
  trackerLockDirFor,
} from '../../tracker-utils.mjs';

export {
  buildTrackerContract,
  writeTrackerContract,
  validateTrackerContract,
  CONTRACT_VERSION,
} from './contract.mjs';

export {
  appendStatusLogEntry,
  statusLogPathForTracker,
} from './status-log.mjs';
