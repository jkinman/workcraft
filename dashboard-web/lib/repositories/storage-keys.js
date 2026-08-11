function tenantStorageKey(tenantId, relPath) {
  return `${tenantId}/${relPath}`;
}

module.exports = {
  tenantStorageKey
};
