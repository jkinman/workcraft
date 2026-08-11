import { existsSync, mkdtempSync, readFileSync } from 'fs';
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

function postRequest(url, body, tenantId = 'tenant-a') {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(body)
  });
}

const COMPLETE_ANSWERS = {
  fullName: 'Jordan Lee',
  email: 'jordan@example.com',
  location: { city: 'Vancouver', region: 'BC', country: 'Canada' },
  workModes: ['remote'],
  roleFocus: ['software'],
  seniority: ['Senior']
};

describe('onboarding route', () => {
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

  it('rejects incomplete onboarding payloads with 400', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-onboarding-route-'));
    const { POST } = await importRoute('../app/api/onboarding/route.js', rootPath);

    const response = await POST(postRequest('http://localhost/api/onboarding', { answers: {} }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/work style/i);
    expect(existsSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'))).toBe(false);
  });

  it('completes onboarding and writes tenant profile and portals files', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-onboarding-route-'));
    const { POST } = await importRoute('../app/api/onboarding/route.js', rootPath);

    const response = await POST(postRequest('http://localhost/api/onboarding', { answers: COMPLETE_ANSWERS }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.completed).toBe(true);
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8')).toContain('Jordan Lee');
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'portals.yml'), 'utf8')).toContain('Software Engineer');
  });
});
