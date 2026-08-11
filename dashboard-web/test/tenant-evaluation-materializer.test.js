import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { EVAL_MATERIALIZE_REL_PATHS, EVAL_SYNC_REL_PATHS } from '../../lib/evaluation/paths.mjs';
import {
  materializeTenantForEvaluation,
  syncEvaluationArtifacts,
} from '../lib/worker/tenant-materializer';
import { runEvaluationJob } from '../lib/worker/job-executor';
import { createRecordingTenantDocumentsClient } from './fakes/recording-supabase-tenant-documents-client';

function seedEvaluationDocuments(tenantId, overrides = {}) {
  const base = {
    tenant_id: tenantId,
    path: 'cv.md',
    content: '# Candidate\n## Engineer\n',
  };
  return [
    base,
    {
      tenant_id: tenantId,
      path: 'config/profile.yml',
      content: 'spend_tier: standard\n',
    },
    {
      tenant_id: tenantId,
      path: 'data/applications.md',
      content: [
        '# Applications Tracker',
        '',
        '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
        '|---|------|---------|------|-------|--------|-----|--------|-------|',
        '',
      ].join('\n'),
    },
    {
      tenant_id: tenantId,
      path: 'modes/_profile.md',
      content: '# Targeting\n',
    },
    {
      tenant_id: tenantId,
      path: 'article-digest.md',
      content: '# Proof points\n',
    },
    {
      tenant_id: tenantId,
      path: 'portals.yml',
      content: 'tracked_companies: []\n',
    },
  ].map((doc) => {
    if (overrides[doc.path]) {
      return { ...doc, content: overrides[doc.path] };
    }
    return doc;
  });
}

describe('tenant evaluation materializer', () => {
  it('materializes declared evaluation inputs for the tenant workspace', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-materialize-'));
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'));

    await materializeTenantForEvaluation('tenant-a', stub, tempRoot);

    for (const relPath of EVAL_MATERIALIZE_REL_PATHS) {
      expect(existsSync(join(tempRoot, relPath))).toBe(true);
      const stored = stub.documents.find((doc) => doc.path === relPath)?.content;
      expect(readFileSync(join(tempRoot, relPath), 'utf8')).toBe(stored);
    }
    expect(stub.recordings.selects).toEqual([
      expect.objectContaining({ table: 'tenant_documents', column: 'tenant_id', tenantId: 'tenant-a' }),
    ]);
  });

  it('requires cv.md and rejects evaluation jobs without it', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-required-'));
    const docs = seedEvaluationDocuments('tenant-a').filter((doc) => doc.path !== 'cv.md');
    const stub = createRecordingTenantDocumentsClient(docs);

    await expect(materializeTenantForEvaluation('tenant-a', stub, tempRoot)).rejects.toThrow(
      'cv.md not found for tenant job',
    );
    // Non-required paths may be written before the required-path guard fires.
    expect(existsSync(join(tempRoot, 'config/profile.yml'))).toBe(true);
    expect(existsSync(join(tempRoot, 'cv.md'))).toBe(false);
  });

  it('propagates tenant document load failures without writing partial inputs', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-load-fail-'));
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'), {
      selectError: { message: 'connection refused' },
    });

    await expect(materializeTenantForEvaluation('tenant-a', stub, tempRoot)).rejects.toThrow(
      'Failed to load tenant documents: connection refused',
    );
    expect(existsSync(join(tempRoot, 'cv.md'))).toBe(false);
  });

  it('syncs allowlisted evaluation artifacts and markdown reports only', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-sync-'));
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'));

    await materializeTenantForEvaluation('tenant-a', stub, tempRoot);

    writeFileSync(
      join(tempRoot, 'data/applications.md'),
      '# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n',
    );
    writeFileSync(join(tempRoot, 'data/llm-usage.jsonl'), '{"route":"fake"}\n');
    mkdirSync(join(tempRoot, 'reports'), { recursive: true });
    writeFileSync(join(tempRoot, 'reports/001-acme-2026-08-11.md'), '# Report\n');
    writeFileSync(join(tempRoot, 'reports/draft.txt'), 'ignore me');
    writeFileSync(join(tempRoot, 'cv.md'), '# mutated\n');
    mkdirSync(join(tempRoot, 'secrets'), { recursive: true });
    writeFileSync(join(tempRoot, 'secrets/local-only.txt'), 'never sync');

    await syncEvaluationArtifacts('tenant-a', stub, tempRoot);

    const syncedPaths = stub.recordings.upserts.map((entry) => entry.row.path).sort();
    expect(syncedPaths).toEqual([
      'data/applications.md',
      'data/llm-usage.jsonl',
      'reports/001-acme-2026-08-11.md',
    ]);
    expect(syncedPaths).not.toContain('cv.md');
    expect(syncedPaths).not.toContain('secrets/local-only.txt');
    expect(syncedPaths).not.toContain('reports/draft.txt');

    for (const relPath of EVAL_SYNC_REL_PATHS) {
      expect(stub.recordings.upserts.some((entry) => entry.row.path === relPath)).toBe(true);
    }
    for (const entry of stub.recordings.upserts) {
      expect(entry.opts).toEqual({ onConflict: 'tenant_id,path' });
      expect(entry.row.tenant_id).toBe('tenant-a');
    }
  });

  it('does not write cross-tenant or unlisted paths during sync', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-tenant-scope-'));
    const tenantADocs = seedEvaluationDocuments('tenant-a');
    const tenantBDocs = seedEvaluationDocuments('tenant-b').map((doc) => ({
      ...doc,
      content: doc.path === 'cv.md' ? '# Tenant B CV\n' : doc.content,
    }));
    const stub = createRecordingTenantDocumentsClient([...tenantADocs, ...tenantBDocs]);

    await materializeTenantForEvaluation('tenant-a', stub, tempRoot);
    writeFileSync(join(tempRoot, 'data/applications.md'), '# tenant-a tracker\n');
    mkdirSync(join(tempRoot, 'output'), { recursive: true });
    writeFileSync(join(tempRoot, 'output/unlisted.pdf'), '%PDF');

    await syncEvaluationArtifacts('tenant-a', stub, tempRoot);

    expect(stub.recordings.upserts.every((entry) => entry.row.tenant_id === 'tenant-a')).toBe(true);
    expect(stub.recordings.upserts.some((entry) => entry.row.path === 'output/unlisted.pdf')).toBe(false);

    const tenantBTracker = stub.documents.find(
      (doc) => doc.tenant_id === 'tenant-b' && doc.path === 'data/applications.md',
    );
    expect(tenantBTracker.content).toContain('# Applications Tracker');
  });

  it('skips missing allowlisted files on sync and continues with present artifacts', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-sync-skip-'));
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'));

    await materializeTenantForEvaluation('tenant-a', stub, tempRoot);
    writeFileSync(join(tempRoot, 'data/applications.md'), '# updated tracker\n');

    await syncEvaluationArtifacts('tenant-a', stub, tempRoot);

    const syncedPaths = stub.recordings.upserts.map((entry) => entry.row.path);
    expect(syncedPaths).toContain('data/applications.md');
    expect(syncedPaths).not.toContain('data/llm-usage.jsonl');
  });

  it('surfaces sync upsert failures after prior allowlisted writes (no rollback)', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'co-eval-sync-fail-'));
    let upsertCount = 0;
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'), {
      upsertHook(row) {
        upsertCount += 1;
        if (row.path === 'data/llm-usage.jsonl') {
          return { error: { message: 'disk full' } };
        }
        return null;
      },
    });

    await materializeTenantForEvaluation('tenant-a', stub, tempRoot);
    writeFileSync(join(tempRoot, 'data/applications.md'), '# tracker after eval\n');
    writeFileSync(join(tempRoot, 'data/llm-usage.jsonl'), '{"route":"fake"}\n');

    await expect(syncEvaluationArtifacts('tenant-a', stub, tempRoot)).rejects.toThrow(
      'Failed to sync data/llm-usage.jsonl: disk full',
    );

    const syncedBeforeFailure = stub.documents.find(
      (doc) => doc.tenant_id === 'tenant-a' && doc.path === 'data/applications.md',
    );
    expect(syncedBeforeFailure.content).toContain('tracker after eval');
    expect(upsertCount).toBeGreaterThanOrEqual(2);
  });

  it('does not sync evaluation artifacts when the worker evaluation fails', async () => {
    const stub = createRecordingTenantDocumentsClient(seedEvaluationDocuments('tenant-a'));

    await expect(runEvaluationJob({
      tenantId: 'tenant-a',
      jobType: 'evaluation',
      payload: { jdText: 'too short' },
    }, { client: stub })).rejects.toThrow(/80 characters/);
    expect(stub.recordings.upserts).toHaveLength(0);
  });
});
