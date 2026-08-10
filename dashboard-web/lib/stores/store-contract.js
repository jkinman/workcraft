const REQUIRED_CAREER_OPS_STORE_METHODS = [
  'readProfile',
  'writeProfile',
  'readCv',
  'writeCv',
  'readPortals',
  'writePortals',
  'readAgentProfile',
  'writeAgentProfile',
  'readPipeline',
  'writePipeline',
  'listEvaluations',
  'readEvaluation',
  'writeEvaluation',
  'putGeneratedFile',
  'getGeneratedFile'
];

const REQUIRED_OBJECT_STORE_METHODS = [
  'putObject',
  'getObject',
  'getSignedUrl'
];

function assertStoreContract(store, methods, name) {
  const missing = methods.filter(method => typeof store?.[method] !== 'function');
  if (missing.length) {
    throw new Error(`${name} is missing methods: ${missing.join(', ')}`);
  }
}

function assertCareerOpsStore(store) {
  assertStoreContract(store, REQUIRED_CAREER_OPS_STORE_METHODS, 'CareerOpsStore');
}

function assertObjectStore(store) {
  assertStoreContract(store, REQUIRED_OBJECT_STORE_METHODS, 'CareerOpsObjectStore');
}

module.exports = {
  REQUIRED_CAREER_OPS_STORE_METHODS,
  REQUIRED_OBJECT_STORE_METHODS,
  assertCareerOpsStore,
  assertObjectStore
};
