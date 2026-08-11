/**
 * Filesystem-backed CareerOpsDataClient for canonical transition CLI/tests.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { resolveCareerOpsPaths } from '../path-roots.mjs';

/**
 * @param {string} [dataRoot]
 */
export function createFilesystemDataClient(dataRoot) {
  const paths = resolveCareerOpsPaths({
    ...process.env,
    CAREER_OPS_DATA_ROOT: dataRoot || process.env.CAREER_OPS_DATA_ROOT,
  });

  function readText(relPath) {
    const abs = join(paths.dataRoot, relPath);
    return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  }

  function writeText(relPath, content) {
    const abs = join(paths.dataRoot, relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  }

  return {
    tenantRoot() {
      return paths.dataRoot;
    },
    readApplications() {
      return existsSync(paths.applicationsPath)
        ? readFileSync(paths.applicationsPath, 'utf8')
        : null;
    },
    writeApplications(content) {
      writeFileSync(paths.applicationsPath, content, 'utf8');
    },
    trackerDocumentPath() {
      const rel = paths.applicationsPath.startsWith(paths.dataRoot)
        ? paths.applicationsPath.slice(paths.dataRoot.length + 1)
        : 'data/applications.md';
      return rel;
    },
    listReports() {
      if (!existsSync(paths.reportsDir)) return [];
      return readdirSync(paths.reportsDir)
        .filter((f) => f.endsWith('.md'))
        .map((filename) => ({ filename }));
    },
    readReport(filename) {
      const abs = join(paths.reportsDir, basename(filename));
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    },
    writeReport(filename, content) {
      const abs = join(paths.reportsDir, basename(filename));
      mkdirSync(join(abs, '..'), { recursive: true });
      writeFileSync(abs, content, 'utf8');
    },
    readStatusLog() {
      return readText('data/status-log.tsv');
    },
    appendStatusLog(chunk) {
      const key = 'data/status-log.tsv';
      const existing = readText(key) || '';
      writeText(key, `${existing}${chunk}`);
    },
    writeStatusLog(content) {
      writeText('data/status-log.tsv', content);
    },
    async mutateDocuments(mutations) {
      const snapshots = new Map();
      const applied = [];
      async function rollbackApplied() {
        for (let i = applied.length - 1; i >= 0; i -= 1) {
          const key = applied[i];
          const previous = snapshots.get(key);
          const abs = join(paths.dataRoot, key);
          if (previous == null) {
            if (existsSync(abs)) writeFileSync(abs, '', 'utf8');
          } else {
            writeText(key, previous);
          }
        }
      }
      try {
        for (const { key, content } of mutations) {
          snapshots.set(key, readText(key));
          writeText(key, content);
          applied.push(key);
        }
      } catch (err) {
        await rollbackApplied();
        throw err;
      }
      return { applied, rollback: rollbackApplied };
    },
    paths,
  };
}
