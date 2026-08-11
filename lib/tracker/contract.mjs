/**
 * Machine-readable tracker contract shared by Node and Go dashboard runtimes.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import yaml from 'js-yaml';
import { HEADER_ALIASES, LEGACY_COLMAP, SCORE_CELL_RE, SEPARATOR_ROW_RE } from '../../tracker-parse.mjs';
import { loadCanonicalStates } from '../../tracker-utils.mjs';

export const CONTRACT_VERSION = 1;

/**
 * @param {object} [options]
 * @param {string} [options.statesPath]
 * @param {string} [options.aliasesPath]
 */
export function buildTrackerContract({ statesPath, aliasesPath } = {}) {
  const states = statesPath ? loadCanonicalStates(statesPath) : [];
  const headerAliases = aliasesPath
    ? JSON.parse(readFileSync(aliasesPath, 'utf8'))
    : HEADER_ALIASES;

  return {
    contractVersion: CONTRACT_VERSION,
    generatedBy: 'lib/tracker/contract.mjs',
    headerAliases,
    legacyColumnMap: LEGACY_COLMAP,
    scoreCellPattern: SCORE_CELL_RE.source,
    separatorRowPattern: SEPARATOR_ROW_RE.source,
    requiredHeaderFields: ['num', 'company', 'role', 'score', 'status'],
    states: states.map(s => ({
      id: s.id,
      label: s.label,
      aliases: s.aliases,
    })),
    statusLogColumns: ['trackerNum', 'date', 'from', 'to', 'source'],
    cliExitCodes: {
      OK: 0,
      USAGE: 1,
      NOT_FOUND: 2,
      AMBIGUOUS: 3,
      LOCK_TIMEOUT: 4,
    },
  };
}

/**
 * @param {string} outputPath
 * @param {object} [options]
 */
export function writeTrackerContract(outputPath, options = {}) {
  const contract = buildTrackerContract(options);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  return contract;
}

/**
 * Validate an on-disk contract against live sources.
 *
 * @param {string} contractPath
 * @param {object} [options]
 */
export function validateTrackerContract(contractPath, options = {}) {
  const onDisk = JSON.parse(readFileSync(contractPath, 'utf8'));
  const live = buildTrackerContract(options);
  const mismatches = [];

  if (onDisk.contractVersion !== live.contractVersion) {
    mismatches.push('contractVersion');
  }
  if (JSON.stringify(onDisk.headerAliases) !== JSON.stringify(live.headerAliases)) {
    mismatches.push('headerAliases');
  }
  if (JSON.stringify(onDisk.states) !== JSON.stringify(live.states)) {
    mismatches.push('states');
  }

  return { valid: mismatches.length === 0, mismatches, onDisk, live };
}

/** Load states.yml directly (for Go parity checks without tracker-utils). */
export function loadStatesDocument(statesPath) {
  return yaml.load(readFileSync(statesPath, 'utf8'));
}
