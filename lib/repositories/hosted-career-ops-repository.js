class HostedCareerOpsRepository {
  constructor({ tenantId } = {}) {
    this.tenantId = tenantId;
  }

  unavailable() {
    throw new Error('HostedCareerOpsRepository is not implemented yet. Configure hosted storage before using CAREER_OPS_TENANT_MODE=hosted.');
  }

  tenantRoot() { return this.unavailable(); }
  dataPath() { return this.unavailable(); }
  reportsDir() { return this.unavailable(); }
  outputDir() { return this.unavailable(); }
  profilePath() { return this.unavailable(); }
  portalsPath() { return this.unavailable(); }
  agentProfilePath() { return this.unavailable(); }
  interviewPrepDir() { return this.unavailable(); }
  cvPath() { return this.unavailable(); }
  exists() { return this.unavailable(); }
  readText() { return this.unavailable(); }
  readBinary() { return this.unavailable(); }
  writeText() { return this.unavailable(); }
  writeBinary() { return this.unavailable(); }
  listMarkdownReports() { return this.unavailable(); }
  listFilesInDirectory() { return this.unavailable(); }
}

module.exports = {
  HostedCareerOpsRepository
};
