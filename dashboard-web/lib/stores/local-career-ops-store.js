class LocalCareerOpsStore {
  constructor(dataClient) {
    this.dataClient = dataClient;
    this.adapter = 'local';
  }

  readProfile() {
    return this.dataClient.readProfile();
  }

  writeProfile(content) {
    this.dataClient.writeProfile(content);
  }

  readCv() {
    return this.dataClient.readCv();
  }

  writeCv(content) {
    this.dataClient.writeCv(content);
  }

  readPortals() {
    return this.dataClient.readPortals();
  }

  writePortals(content) {
    this.dataClient.writePortals(content);
  }

  readAgentProfile() {
    return this.dataClient.readAgentProfile();
  }

  writeAgentProfile(content) {
    this.dataClient.writeAgentProfile(content);
  }

  readPipeline() {
    return this.dataClient.readPipeline();
  }

  writePipeline(content) {
    this.dataClient.writePipeline(content);
  }

  listEvaluations() {
    return this.dataClient.listReports();
  }

  readEvaluation(filename) {
    return this.dataClient.readReport(filename);
  }

  writeEvaluation(filename, content) {
    this.dataClient.writeReport(filename, content);
  }

  putGeneratedFile(file) {
    return this.dataClient.putGeneratedFile(file);
  }

  getGeneratedFile(filename) {
    return this.dataClient.getGeneratedFile(filename);
  }
}

module.exports = {
  LocalCareerOpsStore
};
