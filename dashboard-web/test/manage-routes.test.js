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

function putRequest(url, body, tenantId = 'tenant-a') {
  return new Request(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': tenantId
    },
    body: JSON.stringify(body)
  });
}

function getRequest(url, tenantId = 'tenant-a') {
  return new Request(url, { headers: { 'x-tenant-id': tenantId } });
}

describe('manage routes', () => {
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

  it('saves profile YAML into the requesting tenant root only', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-manage-'));
    const { PUT } = await importRoute('../app/api/manage/profile/route.js', rootPath);

    const response = await PUT(putRequest('http://localhost/api/manage/profile', {
      content: 'candidate:\n  full_name: Jane Smith\n'
    }, 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8')).toContain('Jane Smith');
    expect(existsSync(join(rootPath, 'tenants', 'tenant-b', 'config', 'profile.yml'))).toBe(false);
  });

  it('rejects invalid portals YAML with 400 and does not write', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-manage-'));
    const { PUT } = await importRoute('../app/api/manage/portals/route.js', rootPath);

    const response = await PUT(putRequest('http://localhost/api/manage/portals', {
      content: 'tracked_companies: : :\n'
    }, 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(existsSync(join(rootPath, 'tenants', 'tenant-a', 'portals.yml'))).toBe(false);
  });

  it('returns the structured resume from a raw markdown save', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-manage-'));
    const { PUT, GET } = await importRoute('../app/api/manage/resume/route.js', rootPath);

    await PUT(putRequest('http://localhost/api/manage/resume', {
      content: '# Jane Smith\n## ML Engineer\n\n### Summary\nBuilder.\n\n### Skills\n- **Backend (90/100):** Node\n\n### Experience\n**Acme** | Staff | 2020-2024\n'
    }, 'tenant-a'));

    const response = await GET(getRequest('http://localhost/api/manage/resume', 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.hasContent).toBe(true);
    expect(json.resume.name).toBe('Jane Smith');
    expect(json.resume.skills.backend).toEqual(['Node']);
    expect(json.resume.experience[0]).toMatchObject({ company: 'Acme', role: 'Staff', date: '2020-2024' });
  });

  it('saves a structured resume payload as cv.md markdown', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-manage-'));
    const { PUT } = await importRoute('../app/api/manage/resume/route.js', rootPath);

    const response = await PUT(putRequest('http://localhost/api/manage/resume', {
      resume: {
        name: 'Jane Smith',
        tagline: 'ML Engineer',
        contact: { email: 'jane@example.com' },
        summary: 'Builder.',
        strengths: ['Ships fast'],
        skills: { frontend: ['React'] },
        experience: [{ company: 'Acme', role: 'Staff', date: '2020-2024', description: 'Led things.', highlights: ['Shipped X'], technologies: ['Node'] }]
      }
    }, 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    const written = readFileSync(join(rootPath, 'tenants', 'tenant-a', 'cv.md'), 'utf8');
    expect(written).toContain('# Jane Smith');
    expect(written).toContain('*Led things.*');
    expect(written).toContain('- Technologies: Node');
  });

  it('saves a structured profile payload as profile.yml', async () => {
    const rootPath = mkdtempSync(join(tmpdir(), 'career-ops-manage-'));
    const { PUT } = await importRoute('../app/api/manage/profile/route.js', rootPath);

    const response = await PUT(putRequest('http://localhost/api/manage/profile', {
      profile: { candidate: { full_name: 'Jane Smith' }, targetRoles: ['AI Engineer'] }
    }, 'tenant-a'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    const written = readFileSync(join(rootPath, 'tenants', 'tenant-a', 'config', 'profile.yml'), 'utf8');
    expect(written).toContain('Jane Smith');
    expect(written).toContain('AI Engineer');
  });
});
