const { createSupabaseServerClient } = require('./supabase-client');

const DEFAULT_BUCKET = 'career-ops-files';

class SupabaseObjectStore {
  constructor({ tenantId, bucket, client, env = process.env } = {}) {
    this.tenantId = tenantId;
    this.bucket = bucket || env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    this.client = client || createSupabaseServerClient(env);
    this.adapter = 'supabase';
  }

  scopedKey(key) {
    if (!this.tenantId) {
      throw new Error('SupabaseObjectStore requires a tenantId.');
    }
    return `users/${this.tenantId}/${key}`;
  }

  async putObject({ key, content, contentType = 'application/octet-stream', metadata = {} }) {
    const storageKey = this.scopedKey(key);
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(storageKey, content, {
        contentType,
        upsert: true,
        metadata
      });

    if (error) throw error;

    return {
      key: storageKey,
      bucket: this.bucket,
      contentType,
      metadata,
      storage: 'supabase'
    };
  }

  async getObject(key) {
    const storageKey = this.scopedKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).download(storageKey);
    if (error) return null;

    return {
      key: storageKey,
      content: data,
      storage: 'supabase'
    };
  }

  async getSignedUrl(key, expiresIn = 60 * 60) {
    const storageKey = this.scopedKey(key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresIn);

    if (error) throw error;
    return data.signedUrl;
  }
}

module.exports = {
  DEFAULT_BUCKET,
  SupabaseObjectStore
};
