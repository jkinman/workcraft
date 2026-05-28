import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalCareerOpsPath;
let originalNodeEnv;
const require = createRequire(import.meta.url);

function resetDashboardRequireCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('/dashboard-web/')) {
      delete require.cache[key];
    }
  }
}

async function importRoute(routePath, rootPath) {
  vi.resetModules();
  resetDashboardRequireCache();
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
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalCareerOpsPath === undefined) {
      delete process.env.CAREER_OPS_PATH;
    } else {
      process.env.CAREER_OPS_PATH = originalCareerOpsPath;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    resetDashboardRequireCache();
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

  it('queues jobs into isolated tenant pipelines under the same root', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const { POST } = await importRoute('../app/api/queue/route.js', rootPath);

    const tenantAResponse = await POST(request('http://localhost/api/queue', {
      url: 'https://jobs.ashbyhq.com/acme/123',
      notes: 'Staff Engineer - remote'
    }, 'tenant-a'));
    const tenantBResponse = await POST(request('http://localhost/api/queue', {
      url: 'https://jobs.ashbyhq.com/beta/456',
      notes: 'Product Engineer - remote'
    }, 'tenant-b'));

    expect(tenantAResponse.status).toBe(200);
    expect(tenantBResponse.status).toBe(200);

    const tenantA = readFileSync(join(rootPath, 'tenants', 'tenant-a', 'data', 'pipeline.md'), 'utf8');
    const tenantB = readFileSync(join(rootPath, 'tenants', 'tenant-b', 'data', 'pipeline.md'), 'utf8');

    expect(tenantA).toContain('Acme | Staff Engineer');
    expect(tenantA).not.toContain('Beta | Product Engineer');
    expect(tenantB).toContain('Beta | Product Engineer');
    expect(tenantB).not.toContain('Acme | Staff Engineer');
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

  it('transitions only the requested tenant report when slugs collide', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const tenantAReports = join(rootPath, 'tenants', 'tenant-a', 'reports');
    const tenantBReports = join(rootPath, 'tenants', 'tenant-b', 'reports');
    mkdirSync(tenantAReports, { recursive: true });
    mkdirSync(tenantBReports, { recursive: true });
    const report = `---
state: evaluated
state_history:
  - {state: evaluated, date: "2026-05-24"}
---

# Evaluation: Acme - Engineer
`;
    writeFileSync(join(tenantAReports, '001-acme.md'), report);
    writeFileSync(join(tenantBReports, '001-acme.md'), report);

    const { POST } = await importRoute('../app/api/transition-state/route.js', rootPath);
    const response = await POST(request('http://localhost/api/transition-state', {
      slug: 'acme',
      newState: 'applied'
    }, 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(readFileSync(join(tenantAReports, '001-acme.md'), 'utf8')).toContain('state: applied');
    expect(readFileSync(join(tenantBReports, '001-acme.md'), 'utf8')).toContain('state: evaluated');
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

  it('does not allow one tenant to download another tenant output with the same filename', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const tenantBOutput = join(rootPath, 'tenants', 'tenant-b', 'output');
    mkdirSync(tenantBOutput, { recursive: true });
    writeFileSync(join(tenantBOutput, 'cv-test-user-acme-2026-05-25.pdf'), 'tenant-b-pdf');
    const { GET } = await importRoute('../app/download-pdf/route.js', rootPath);

    const response = await GET(new Request('http://localhost/download-pdf?file=cv-test-user-acme-2026-05-25.pdf', {
      headers: { 'x-tenant-id': 'tenant-a' }
    }));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
  });

  it('reports scanner setup requirements before running scan', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    const { POST } = await importRoute('../app/api/scan/route.js', rootPath);

    const response = await POST(new Request('http://localhost/api/scan?dryRun=true', {
      method: 'POST',
      headers: { 'x-tenant-id': 'tenant-a' }
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.code).toBe('setup_required');
    expect(json.missing).toEqual(['portals', 'pipeline']);
  });

  it('initializes defaults into only the requested tenant root', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-api-'));
    mkdirSync(join(rootPath, 'templates'), { recursive: true });
    mkdirSync(join(rootPath, 'config'), { recursive: true });
    writeFileSync(join(rootPath, 'templates', 'portals.example.yml'), 'tracked_companies: []\n');
    writeFileSync(join(rootPath, 'config', 'profile.example.yml'), 'candidate:\n  full_name: Default User\n');
    const { POST, GET } = await importRoute('../app/api/setup/route.js', rootPath);

    const response = await POST(request('http://localhost/api/setup', { target: 'all' }, 'tenant-a'));
    const json = await response.json();
    const tenantBStatus = await GET(new Request('http://localhost/api/setup', {
      headers: { 'x-tenant-id': 'tenant-b' }
    })).then(res => res.json());

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.initialized).toEqual(['portals', 'profile', 'pipeline']);
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'portals.yml'), 'utf8')).toContain('tracked_companies');
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8')).toContain('Default User');
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'data', 'pipeline.md'), 'utf8')).toContain('## Pending');
    expect(tenantBStatus.status.files.portals).toBe(false);
    expect(existsSync(join(rootPath, 'tenants', 'tenant-b', 'portals.yml'))).toBe(false);
  });
});
