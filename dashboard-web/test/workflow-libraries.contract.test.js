#!/usr/bin/env node
/**
 * Workflow library contract tests — path catalogs, profile, tracker, locks,
 * documents adapters, and batch state/CLI adapters.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  resolveCareerOpsPaths,
  resolveDataRoot,
  resolveLocalWorkspacePaths,
  SYSTEM_ROOT,
} from '../../lib/path-roots.mjs';
import { readProfile, normalizeProfile } from '../../lib/profile/index.mjs';
import { parseOutputLanguage } from '../../lib/profile/language.mjs';
import {
  buildTrackerContract,
  validateTrackerContract,
  writeTrackerContract,
} from '../../lib/tracker/contract.mjs';
import {
  acquireFilesystemLock,
  OWNERLESS_GRACE_MS,
  trackerLockDirFor,
} from '../../lib/filesystem-lock.mjs';
import {
  upsertBatchStateRow,
  getBatchStatus,
  sanitizeBatchField,
} from '../../lib/batch/state.mjs';
import {
  BATCH_WORKER_ADAPTERS,
  resolveBatchWorkerAdapter,
  describeBatchEvaluation,
} from '../../lib/batch/cli-adapters.mjs';
import {
  repoRelativeManifestPath,
  updatePdfIndex,
} from '../../lib/documents/pdf-index.mjs';
import { validateLatexContent } from '../../lib/documents/latex.mjs';
import { validateCvSectionOrder } from '../../generate-pdf.mjs';

describe('workflow path catalogs', () => {
  it('separates system root from tenant data root', () => {
    const dataRoot = mkdtempSync(join(tmpdir(), 'co-data-'));
    mkdirSync(join(dataRoot, 'data'), { recursive: true });
    writeFileSync(join(dataRoot, 'data', 'applications.md'), '# tracker\n');

    const paths = resolveCareerOpsPaths({ CAREER_OPS_DATA_ROOT: dataRoot });
    expect(paths.dataRoot).toBe(dataRoot);
    expect(paths.systemRoot).toBe(SYSTEM_ROOT);
    expect(paths.applicationsPath).toBe(join(dataRoot, 'data', 'applications.md'));
    expect(paths.batchStatePath).toBe(join(dataRoot, 'batch', 'batch-state.tsv'));
    expect(paths.pdfIndexPath).toBe(join(dataRoot, 'data', 'pdf-index.tsv'));
  });

  it('defaults data root to system root locally', () => {
    expect(resolveDataRoot({})).toBe(SYSTEM_ROOT);
  });

  it('uses cwd-relative paths when no tenant root is set', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'co-cwd-'));
    const local = resolveLocalWorkspacePaths(cwd, {});
    expect(local.dataRoot).toBe(cwd);
    expect(local.portalsPath).toBe(join(cwd, 'portals.yml'));
  });
});

describe('profile read module', () => {
  it('parses language.output and spend_tier with defaults', () => {
    const profile = readProfile({
      profileYaml: [
        'language:',
        '  output: de',
        '  modes_dir: modes/de',
        'spend_tier: economy',
        'candidate:',
        '  full_name: Test User',
        'location:',
        '  country: Germany',
        '  timezone: CET',
      ].join('\n'),
    });
    expect(profile.outputLanguage).toBe('de');
    expect(profile.modesDir).toBe('modes/de');
    expect(profile.spendTier).toBe('economy');
    expect(profile.candidate.fullName).toBe('Test User');
    expect(profile.location.country).toBe('Germany');
  });

  it('keeps profile-language facade compatible', () => {
    expect(parseOutputLanguage('language:\n  output: fr')).toBe('fr');
    expect(normalizeProfile({}).spendTier).toBe('standard');
  });
});

describe('tracker contract artifact', () => {
  it('matches live states and aliases', () => {
    const paths = resolveCareerOpsPaths();
    writeTrackerContract(paths.trackerContractPath, {
      statesPath: paths.statesPath,
      aliasesPath: paths.trackerAliasesPath,
    });
    const result = validateTrackerContract(paths.trackerContractPath, {
      statesPath: paths.statesPath,
      aliasesPath: paths.trackerAliasesPath,
    });
    expect(result.valid).toBe(true);
    expect(result.onDisk.states.length).toBeGreaterThan(0);
    expect(result.onDisk.headerAliases.company).toBe('company');
  });

  it('exposes Go-parity header aliases', () => {
    const contract = buildTrackerContract({
      statesPath: resolveCareerOpsPaths().statesPath,
      aliasesPath: resolveCareerOpsPaths().trackerAliasesPath,
    });
    expect(contract.headerAliases.empresa).toBe('company');
    expect(contract.legacyColumnMap.score).toBe(5);
  });
});

describe('filesystem lock module', () => {
  it('acquires and releases a temp lock directory', async () => {
    const lockDir = join(mkdtempSync(join(tmpdir(), 'co-lock-')), 'test.lock');
    const lock = await acquireFilesystemLock(lockDir, { timeoutMs: 2000, retryMs: 25 });
    expect(lock.attempts).toBeGreaterThan(0);
    lock.release();
    expect(OWNERLESS_GRACE_MS).toBeGreaterThan(0);
    expect(trackerLockDirFor('/tmp/fake/applications.md')).toContain('career-ops-merge-tracker-');
  });
});

describe('batch state and CLI adapters', () => {
  it('sanitizes TSV-breaking characters and upserts rows', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'co-batch-'));
    const stateFile = join(dir, 'batch-state.tsv');
    expect(sanitizeBatchField('a\tb\nc')).toBe('a b c');

    await upsertBatchStateRow(stateFile, {
      id: '1',
      url: 'https://example.com/j/1',
      status: 'processing',
      started_at: 't0',
      completed_at: '-',
      report_num: '001',
      score: '-',
      error: 'ok',
      retries: '0',
    });
    expect(getBatchStatus(stateFile, '1')).toBe('processing');
  });

  it('describes installed worker adapters without executing them', () => {
    expect(Object.keys(BATCH_WORKER_ADAPTERS)).toEqual(expect.arrayContaining(['claude', 'codex', 'opencode']));
    const adapter = resolveBatchWorkerAdapter(['codex', 'claude']);
    expect(adapter?.id).toBeTruthy();
    expect(describeBatchEvaluation().provider).toBeTruthy();
  });
});
describe('batch run-worker CLI', () => {
  it('prints dry-run argv for claude backend without executing', async () => {
    const { parseArgs } = await import('../../lib/batch/run-worker.mjs');
    const opts = parseArgs([
      '--adapter', 'claude',
      '--prompt-file', '/tmp/prompt.md',
      '--log-file', '/tmp/out.log',
      '--dry-run',
    ]);
    expect(opts.adapter).toBe('claude');
    expect(opts.dryRun).toBe(true);
  });

  it('builds safe argv arrays for claude, codex, and opencode with spaced paths', async () => {
    const { BATCH_WORKER_ADAPTERS } = await import('../../lib/batch/cli-adapters.mjs');
    const spacedPrompt = '/tmp/batch prompts/resolved prompt.md';
    const promptText = 'Process batch offer per prompt file.';

    const claude = BATCH_WORKER_ADAPTERS.claude.buildArgs({
      promptFile: spacedPrompt,
      model: 'claude-sonnet-4',
      spendTier: 'standard',
    });
    expect(claude.args).toContain('--model');
    expect(claude.args).toContain('claude-sonnet-4');
    expect(claude.args).toContain('--append-system-prompt-file');
    expect(claude.args).toContain(spacedPrompt);

    const codex = BATCH_WORKER_ADAPTERS.codex.buildArgs({
      promptText,
      model: 'gpt-5',
    });
    expect(codex.args[0]).toBe('exec');
    expect(codex.args[1]).toBe(promptText);
    expect(codex.args).toContain('--model');
    expect(codex.args).toContain('gpt-5');

    const opencode = BATCH_WORKER_ADAPTERS.opencode.buildArgs({
      promptText,
      model: 'kimi-k2',
    });
    expect(opencode.args[0]).toBe('run');
    expect(opencode.args[1]).toBe(promptText);
    expect(opencode.args).toContain('kimi-k2');
  });
});

describe('canonical tracker transition', () => {
  it('syncs tracker, report frontmatter, and status log on local filesystem', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const { transitionApplicationState } = await import('../../lib/tracker/transition-sync.mjs');
    const { createFilesystemDataClient } = await import('../../lib/tracker/fs-data-client.mjs');

    const root = mkdtempSync(join(tmpdir(), 'co-transition-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'data', 'applications.md'), [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '| 3 | 2026-06-01 | Beta Co | Engineer | 4.0/5 | Evaluated | ❌ | [3](reports/003-beta-co.md) | |',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'reports', '003-beta-co.md'), [
      '---',
      'state: evaluated',
      'state_history:',
      '  - {state: evaluated, date: "2026-06-01"}',
      '---',
      '',
      '**Company:** Beta Co',
      '',
    ].join('\n'));

    process.env.CAREER_OPS_DATA_ROOT = root;
    const client = createFilesystemDataClient(root);
    const result = await transitionApplicationState(client, {
      slug: '003-beta-co',
      newState: 'Applied',
      source: 'contract-test',
    });
    expect(result.success).toBe(true);
    expect(readFileSync(join(root, 'data', 'applications.md'), 'utf8')).toContain('| Applied |');
    expect(readFileSync(join(root, 'reports', '003-beta-co.md'), 'utf8')).toContain('state: applied');
    expect(existsSync(join(root, 'data', 'status-log.tsv'))).toBe(true);
  });

  it('supports in-memory Supabase-style repository writes', async () => {
    const { transitionApplicationState } = await import('../../lib/tracker/transition-sync.mjs');
    const store = new Map([
      ['data/applications.md', [
        '# Applications Tracker',
        '',
        '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
        '|---|------|---------|------|-------|--------|-----|--------|-------|',
        '| 8 | 2026-06-02 | Gamma | PM | 3.5/5 | Evaluated | ❌ | [8](reports/008-gamma.md) | |',
        '',
      ].join('\n')],
      ['reports/008-gamma.md', [
        '---',
        'state: evaluated',
        'state_history:',
        '  - {state: evaluated, date: "2026-06-02"}',
        '---',
        '',
        '# Evaluation: Gamma — PM',
        '',
      ].join('\n')],
    ]);
    const logChunks = [];
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const client = {
      tenantRoot: () => '/tenant',
      readApplications: async () => store.get('data/applications.md'),
      trackerDocumentPath: () => 'data/applications.md',
      listReports: async () => [{ filename: '008-gamma.md' }],
      readReport: async (name) => store.get(`reports/${name}`),
      readStatusLog: async () => logChunks.join(''),
      appendStatusLog: async (chunk) => {
        await delay(5);
        logChunks.push(chunk);
      },
      writeStatusLog: async (content) => {
        logChunks.length = 0;
        logChunks.push(content);
      },
      mutateDocuments: async (mutations) => {
        const snapshots = new Map();
        const applied = [];
        async function rollbackApplied() {
          for (let i = applied.length - 1; i >= 0; i -= 1) {
            store.set(applied[i], snapshots.get(applied[i]));
          }
        }
        try {
          for (const { key, content } of mutations) {
            snapshots.set(key, store.get(key));
            await delay(5);
            store.set(key, content);
            applied.push(key);
          }
        } catch (err) {
          await rollbackApplied();
          throw err;
        }
        return { applied, rollback: rollbackApplied };
      },
    };

    const result = await transitionApplicationState(client, {
      slug: '008-gamma',
      newState: 'Responded',
      source: 'supabase-fake',
    });
    expect(result.success).toBe(true);
    expect(store.get('data/applications.md')).toContain('| Responded |');
    expect(store.get('reports/008-gamma.md')).toContain('state: responded');
    expect(logChunks.join('')).toContain('Responded');
  });

  it('matches dated canonical report filenames via tracker report link', async () => {
    const { transitionApplicationState } = await import('../../lib/tracker/transition-sync.mjs');
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');

    const root = mkdtempSync(join(tmpdir(), 'co-dated-report-'));
    mkdirSync(join(root, 'data'), { recursive: true });
    mkdirSync(join(root, 'reports'), { recursive: true });
    writeFileSync(join(root, 'data', 'applications.md'), [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '| 3 | 2026-08-10 | Beta Co | Engineer | 4.0/5 | Evaluated | ❌ | [3](reports/003-beta-co-2026-08-10.md) | |',
      '',
    ].join('\n'));
    writeFileSync(join(root, 'reports', '003-beta-co-2026-08-10.md'), [
      '---',
      'state: evaluated',
      'state_history:',
      '  - {state: evaluated, date: "2026-08-10"}',
      '---',
      '',
      '# Evaluation: Beta Co — Engineer',
      '',
    ].join('\n'));

    process.env.CAREER_OPS_DATA_ROOT = root;
    const { createFilesystemDataClient } = await import('../../lib/tracker/fs-data-client.mjs');
    const client = createFilesystemDataClient(root);
    const result = await transitionApplicationState(client, {
      slug: '003-beta-co-2026-08-10',
      newState: 'Applied',
      source: 'dated-report-test',
    });
    expect(result.success).toBe(true);
    expect(readFileSync(join(root, 'data', 'applications.md'), 'utf8')).toContain('| Applied |');
    expect(readFileSync(join(root, 'reports', '003-beta-co-2026-08-10.md'), 'utf8')).toContain('state: applied');
  });

  it('rolls back awaited async writes when a later write fails', async () => {
    const { transitionApplicationState } = await import('../../lib/tracker/transition-sync.mjs');
    const trackerBefore = [
      '# Applications Tracker',
      '',
      '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
      '|---|------|---------|------|-------|--------|-----|--------|-------|',
      '| 4 | 2026-08-10 | Delta | Engineer | 4.0/5 | Evaluated | ❌ | [4](reports/004-delta-2026-08-10.md) | |',
      '',
    ].join('\n');
    const reportBefore = [
      '---',
      'state: evaluated',
      'state_history:',
      '  - {state: evaluated, date: "2026-08-10"}',
      '---',
      '',
      '# Evaluation: Delta — Engineer',
    ].join('\n');
    const store = new Map([
      ['data/applications.md', trackerBefore],
      ['reports/004-delta-2026-08-10.md', reportBefore],
    ]);
    const writeOrder = [];
    const client = {
      tenantRoot: () => '/tenant',
      readApplications: async () => store.get('data/applications.md'),
      trackerDocumentPath: () => 'data/applications.md',
      listReports: async () => [{ filename: '004-delta-2026-08-10.md' }],
      readReport: async (name) => store.get(`reports/${name}`),
      readStatusLog: async () => '',
      appendStatusLog: async () => { writeOrder.push('status-log'); },
      mutateDocuments: async (mutations) => {
        const snapshots = new Map();
        const applied = [];
        async function rollbackApplied() {
          for (let i = applied.length - 1; i >= 0; i -= 1) {
            store.set(applied[i], snapshots.get(applied[i]));
          }
        }
        try {
          for (const { key, content } of mutations) {
            snapshots.set(key, store.get(key));
            if (key === 'data/applications.md') writeOrder.push('applications');
            if (key.startsWith('reports/')) {
              writeOrder.push('report');
              if (content !== reportBefore) {
                throw new Error('injected async report failure');
              }
            }
            store.set(key, content);
            applied.push(key);
          }
        } catch (err) {
          await rollbackApplied();
          throw err;
        }
        return { applied, rollback: rollbackApplied };
      },
    };

    const result = await transitionApplicationState(client, {
      slug: '004-delta-2026-08-10',
      newState: 'Applied',
      source: 'rollback-test',
    });
    expect(result.success).toBe(false);
    expect(store.get('data/applications.md')).toBe(trackerBefore);
    expect(store.get('reports/004-delta-2026-08-10.md')).toBe(reportBefore);
    expect(writeOrder.slice(0, 2)).toEqual(['applications', 'report']);
    expect(writeOrder).toContain('applications');
    expect(writeOrder.filter((step) => step === 'report').length).toBe(1);
    expect(writeOrder).not.toContain('status-log');
  });
});

describe('document module adapters', () => {
  it('writes pdf-index rows relative to repo root', () => {
    const dataRoot = mkdtempSync(join(tmpdir(), 'co-pdf-'));
    mkdirSync(join(dataRoot, 'output'), { recursive: true });
    const pdfPath = join(dataRoot, 'output', 'cv-test.pdf');
    writeFileSync(pdfPath, '%PDF-1.4');
    const rel = updatePdfIndex({ reportNum: '7', pdfPath, htmlPath: '', format: 'a4', dataRoot });
    expect(rel).toContain('output/cv-test.pdf');
    const manifest = readFileSync(join(dataRoot, 'data', 'pdf-index.tsv'), 'utf8');
    expect(manifest).toContain('7\t');
  });

  it('validates LaTeX template structure with fake compile-only mode', () => {
    const result = validateLatexContent('\\begin{document}\\end{document}', true);
    expect(result.issues).toEqual([]);
  });

  it('validates CV section order without browser', () => {
    const html = '<div class="section-title">Summary</div><div class="section-title">Experience</div>';
    const md = '## Summary\n## Experience';
    expect(() => validateCvSectionOrder(html, md)).not.toThrow();
    expect(repoRelativeManifestPath('')).toBe('');
  });

  it('writes path output, returns buffer, skips manifest, and closes fake browser', async () => {
    const { mkdtempSync, mkdirSync, readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const { tmpdir } = await import('os');
    const { renderHtmlToPdf, renderHtmlStringToPdfBuffer } = await import('../../lib/documents/html-playwright.mjs');

    const minimalPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
      + '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n'
      + '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n'
      + 'xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF\n',
      'latin1',
    );

    let browserClosed = false;
    const launchBrowser = async () => ({
      newContext: async () => ({
        newPage: async () => ({
          route: async () => {},
          goto: async () => {},
          evaluate: async () => {},
          pdf: async () => minimalPdf,
        }),
        close: async () => {},
      }),
      close: async () => { browserClosed = true; },
    });

    const dataRoot = mkdtempSync(join(tmpdir(), 'co-html-pdf-'));
    mkdirSync(join(dataRoot, 'output'), { recursive: true });
    const outputPath = join(dataRoot, 'output', 'cv-test.pdf');

    await renderHtmlToPdf('<html><body>CV</body></html>', outputPath, {
      launchBrowser,
      updateIndex: false,
      quiet: true,
      maxPages: 2,
    });
    expect(existsSync(outputPath)).toBe(true);
    expect(readFileSync(outputPath).length).toBeGreaterThan(0);
    expect(existsSync(join(dataRoot, 'data', 'pdf-index.tsv'))).toBe(false);
    expect(browserClosed).toBe(true);

    const bufferResult = await renderHtmlStringToPdfBuffer('<html><body>CV</body></html>', {
      launchBrowser,
      updateIndex: false,
      quiet: true,
      maxPages: 2,
    });
    expect(Buffer.isBuffer(bufferResult.pdfBuffer)).toBe(true);
    expect(bufferResult.pdfBuffer.length).toBeGreaterThan(0);
    expect(existsSync(join(dataRoot, 'data', 'pdf-index.tsv'))).toBe(false);
  });
});
