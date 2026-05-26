import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalCareerOpsPath;

async function importRoute(routePath, rootPath) {
  vi.resetModules();
  process.env.CAREER_OPS_PATH = rootPath;
  return import(routePath);
}

function request(url, body, tenantId = 'tenant-a') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(body)
  });
}

describe('api routes', () => {
  beforeEach(() => {
    originalCareerOpsPath = process.env.CAREER_OPS_PATH;
  });

  afterEach(() => {
    if (originalCareerOpsPath === undefined) {
      delete process.env.CAREER_OPS_PATH;
    } else {
      process.env.CAREER_OPS_PATH = originalCareerOpsPath;
    }
    vi.resetModules();
  });

  it('queues jobs into the tenant pipeline', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const { POST } = await importRoute('../app/api/queue/route.js', rootPath);

    const response = await POST(request('http://localhost/api/queue', {
      url: 'https://jobs.ashbyhq.com/acme/123',
      notes: 'Staff Engineer - remote'
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'data', 'pipeline.md'), 'utf8')).toContain('Acme | Staff Engineer');
  });

  it('rejects invalid state transitions before writing report content', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const reportsDir = join(rootPath, 'tenants', 'tenant-a', 'reports');
    mkdirSync(reportsDir, { recursive: true });
    writeFileSync(join(reportsDir, '001-acme.md'), `---
state: evaluated
state_history:
  - {state: evaluated, date: "2026-05-24"}
---

# Evaluation: Acme - Engineer
`);

    const { POST } = await importRoute('../app/api/transition-state/route.js', rootPath);
    const response = await POST(request('http://localhost/api/transition-state', {
      slug: 'acme',
      newState: 'offer'
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(readFileSync(join(reportsDir, '001-acme.md'), 'utf8')).toContain('state: evaluated');
  });

  it('rejects unsafe download filenames', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const { GET } = await importRoute('../app/download-pdf/route.js', rootPath);

    const response = await GET(new Request('http://localhost/download-pdf?file=../secret.pdf', {
      headers: { 'x-tenant-id': 'tenant-a' }
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(existsSync(join(rootPath, 'tenants', 'tenant-a', 'output', 'secret.pdf'))).toBe(false);
  });
});
