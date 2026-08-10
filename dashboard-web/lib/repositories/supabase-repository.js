const { createSupabaseServerClient } = require('./supabase-client');
const { tenantStorageKey } = require('./storage-keys');

const DEFAULT_BUCKET = 'career-ops-files';

/**
 * SupabaseRepository implements the same interface as LocalCareerOpsRepository
 * but stores tenant documents in Postgres (text) and Supabase Storage (binary).
 *
 * Text reads are served from an in-memory cache populated by initialize().
 * Binary reads and output listings use Supabase Storage directly.
 */
class SupabaseRepository {
  constructor({ tenantId, client, env = process.env } = {}) {
    if (!tenantId) throw new Error('SupabaseRepository requires a tenantId');
    this.tenantId = tenantId;
    this.storageAdapter = 'supabase';
    this.client = client || createSupabaseServerClient(env);
    this.bucket = env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    // cache: Map<path, { content: string, updated_at: string }>
    this._cache = new Map();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Fetch all text documents for this tenant in one query.
   * Call once per request before services are used.
   */
  async initialize() {
    const { data, error } = await this.client
      .from('tenant_documents')
      .select('path, content, updated_at')
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`SupabaseRepository.initialize failed: ${error.message}`);

    this._cache.clear();
    for (const row of data || []) {
      this._cache.set(row.path, { content: row.content, updated_at: row.updated_at });
    }
  }

  // ── Path helpers (tenant-relative logical keys) ──────────────────────────────

  tenantRoot() { return ''; }
  profilePath() { return 'config/profile.yml'; }
  portalsPath() { return 'portals.yml'; }
  agentProfilePath() { return 'modes/_profile.md'; }
  cvPath() { return 'cv.md'; }
  articleDigestPath() { return 'article-digest.md'; }
  storyBankPath() { return 'interview-prep/story-bank.md'; }
  dataPath(filename) { return `data/${filename}`; }
  reportsDir() { return 'reports'; }
  outputDir() { return 'output'; }
  interviewPrepDir() { return 'interview-prep'; }
  jdsDir() { return 'jds'; }

  storageKey(relPath) {
    return tenantStorageKey(this.tenantId, relPath);
  }

  // ── Sync reads (text from cache) ─────────────────────────────────────────────

  exists(key) {
    return this._cache.has(key);
  }

  readText(key) {
    const entry = this._cache.get(key);
    return entry ? entry.content : null;
  }

  async readBinary(key) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(this.storageKey(key));

    if (error) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  // ── Async writes ─────────────────────────────────────────────────────────────

  async writeText(key, content) {
    // Optimistic cache update so subsequent reads in this request see the new value
    this._cache.set(key, { content, updated_at: new Date().toISOString() });

    const { error } = await this.client
      .from('tenant_documents')
      .upsert(
        { tenant_id: this.tenantId, path: key, content, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id,path' }
      );

    if (error) throw new Error(`SupabaseRepository.writeText(${key}) failed: ${error.message}`);
  }

  async writeBinary(key, content) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(this.storageKey(key), content, { upsert: true, contentType: 'application/pdf' });

    if (error) throw new Error(`SupabaseRepository.writeBinary(${key}) failed: ${error.message}`);
  }

  async getSignedUrl(key, expiresIn = 3600) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(this.storageKey(key), expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }

  // ── Directory listings (text from cache) ────────────────────────────────────

  listMarkdownReports() {
    const prefix = 'reports/';
    const results = [];
    for (const [key, entry] of this._cache) {
      if (key.startsWith(prefix) && key.endsWith('.md') && key !== 'reports/.gitkeep') {
        results.push({
          filename: key.slice(prefix.length),
          path: key,
          stat: { mtime: new Date(entry.updated_at) }
        });
      }
    }
    return results;
  }

  listFilesInDirectory(dir, predicate = () => true) {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    const results = [];
    for (const [key, entry] of this._cache) {
      if (key.startsWith(prefix)) {
        const filename = key.slice(prefix.length);
        // Exclude sub-directories (no further slashes) and .gitkeep
        if (filename && !filename.includes('/') && filename !== '.gitkeep' && predicate(filename)) {
          results.push({
            filename,
            path: key,
            stat: { mtime: new Date(entry.updated_at) }
          });
        }
      }
    }
    return results;
  }

  // ── Storage listing (binary files) ──────────────────────────────────────────

  async listStorageFiles(prefix) {
    const storagePrefix = this.storageKey(prefix.endsWith('/') ? prefix.slice(0, -1) : prefix);
    const { data, error } = await this.client.storage.from(this.bucket).list(storagePrefix, {
      sortBy: { column: 'updated_at', order: 'desc' }
    });

    if (error) return [];

    return (data || [])
      .filter(item => item.name && item.name !== '.gitkeep')
      .map(item => ({
        filename: item.name,
        path: `${prefix}/${item.name}`.replace(/\/+/g, '/'),
        stat: { mtime: new Date(item.updated_at), size: item.metadata?.size ?? null }
      }));
  }

  async listOutputFiles() {
    return this.listStorageFiles(this.outputDir());
  }
}

module.exports = { SupabaseRepository };
