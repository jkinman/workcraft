const { LocalCareerOpsStore } = require('./local-career-ops-store');
const { LocalObjectStore } = require('./local-object-store');
const { SupabaseCareerOpsStore } = require('./supabase-career-ops-store');
const { SupabaseObjectStore } = require('./supabase-object-store');
const { assertCareerOpsStore, assertObjectStore } = require('./store-contract');

function storageAdapterFromEnv(env = process.env) {
  const adapter = env.CAREER_OPS_STORAGE_ADAPTER || (env.CAREER_OPS_TENANT_MODE === 'hosted' ? 'supabase' : 'local');
  if (!['local', 'supabase'].includes(adapter)) {
    throw new Error(`Unsupported CAREER_OPS_STORAGE_ADAPTER: ${adapter}`);
  }
  return adapter;
}

function createCareerOpsStore({ dataClient, tenantContext = {}, env = process.env } = {}) {
  const adapter = storageAdapterFromEnv(env);
  const store = adapter === 'supabase'
    ? new SupabaseCareerOpsStore({ tenantId: tenantContext.tenantId, env })
    : new LocalCareerOpsStore(dataClient);

  assertCareerOpsStore(store);
  return store;
}

function createCareerOpsObjectStore({ dataClient, tenantContext = {}, env = process.env } = {}) {
  const adapter = storageAdapterFromEnv(env);
  const store = adapter === 'supabase'
    ? new SupabaseObjectStore({ tenantId: tenantContext.tenantId, env })
    : new LocalObjectStore(dataClient);

  assertObjectStore(store);
  return store;
}

module.exports = {
  createCareerOpsObjectStore,
  createCareerOpsStore,
  storageAdapterFromEnv
};
