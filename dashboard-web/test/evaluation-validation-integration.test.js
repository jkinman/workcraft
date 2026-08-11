import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { createDataClient } from '../lib/data/career-ops-data-client';
import { LocalCareerOpsRepository } from '../lib/repositories/local-career-ops-repository';
import { createEvaluationService } from '../lib/services/evaluation-service';

function makeEvaluationWorkspace(rootPath) {
  mkdirSync(join(rootPath, 'config'), { recursive: true });
  mkdirSync(join(rootPath, 'data'), { recursive: true });
  mkdirSync(join(rootPath, 'modes'), { recursive: true });
  writeFileSync(join(rootPath, 'cv.md'), '# Candidate\n## Engineer\n');
  writeFileSync(join(rootPath, 'config/profile.yml'), 'spend_tier: standard\n');
  writeFileSync(join(rootPath, 'modes/_shared.md'), '# shared\n');
  writeFileSync(join(rootPath, 'modes/oferta.md'), '# oferta\n');
  writeFileSync(join(rootPath, 'data/applications.md'), [
    '# Applications Tracker',
    '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '',
  ].join('\n'));
}

describe('evaluation validation integration', () => {
  it('rejects private job URLs before posting reader or gateway run', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'co-eval-validate-'));
    process.env.CAREER_OPS_PATH = rootPath;
    process.env.CAREER_OPS_EVAL_FAKE = '1';
    makeEvaluationWorkspace(rootPath);

    const repository = new LocalCareerOpsRepository({ tenantId: 'local-dev', rootPath });
    const dataClient = createDataClient(repository);
    const evaluation = createEvaluationService(dataClient);

    await expect(
      evaluation.run({ url: 'http://127.0.0.1/jobs/1' }),
    ).rejects.toThrow(/Private|internal|blocked|not allowed/i);

    expect(existsSync(join(rootPath, 'reports'))).toBe(false);
  });

  it('accepts long pasted JD without invoking URL validation', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'co-eval-text-'));
    process.env.CAREER_OPS_PATH = rootPath;
    process.env.CAREER_OPS_EVAL_FAKE = '1';
    makeEvaluationWorkspace(rootPath);

    const repository = new LocalCareerOpsRepository({ tenantId: 'local-dev', rootPath });
    const dataClient = createDataClient(repository);
    const evaluation = createEvaluationService(dataClient);

    const result = await evaluation.run({
      jdText: 'Senior backend engineer role with distributed systems ownership. '.repeat(3),
      notes: 'validation integration',
    });

    expect(result.success).toBe(true);
    expect(existsSync(join(rootPath, 'reports'))).toBe(true);
  });
});
