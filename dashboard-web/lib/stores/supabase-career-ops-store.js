const { createSupabaseServerClient } = require('./supabase-client');

class SupabaseCareerOpsStore {
  constructor({ tenantId, client, env = process.env } = {}) {
    this.tenantId = tenantId;
    this.client = client || createSupabaseServerClient(env);
    this.adapter = 'supabase';
  }

  notImplemented(method) {
    throw new Error(`SupabaseCareerOpsStore.${method} is not implemented yet. Create schema tables before enabling this operation.`);
  }

  readProfile() { return this.notImplemented('readProfile'); }
  writeProfile() { return this.notImplemented('writeProfile'); }
  readCv() { return this.notImplemented('readCv'); }
  writeCv() { return this.notImplemented('writeCv'); }
  readPortals() { return this.notImplemented('readPortals'); }
  writePortals() { return this.notImplemented('writePortals'); }
  readAgentProfile() { return this.notImplemented('readAgentProfile'); }
  writeAgentProfile() { return this.notImplemented('writeAgentProfile'); }
  readPipeline() { return this.notImplemented('readPipeline'); }
  writePipeline() { return this.notImplemented('writePipeline'); }
  listEvaluations() { return this.notImplemented('listEvaluations'); }
  readEvaluation() { return this.notImplemented('readEvaluation'); }
  writeEvaluation() { return this.notImplemented('writeEvaluation'); }
  putGeneratedFile() { return this.notImplemented('putGeneratedFile'); }
  getGeneratedFile() { return this.notImplemented('getGeneratedFile'); }
}

module.exports = {
  SupabaseCareerOpsStore
};
