const fs = require('fs/promises');
const path = require('path');

const SCAN_SYNC_PATHS = [
  'data/pipeline.md',
  'data/scan-history.tsv'
];

const SCAN_MATERIALIZE_PATHS = [
  'portals.yml',
  'data/pipeline.md',
  'data/scan-history.tsv',
  'data/applications.md'
];

async function materializeTenantForScan(tenantId, client, tempRoot) {
  const { data, error } = await client
    .from('tenant_documents')
    .select('path, content')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to load tenant documents: ${error.message}`);
  }

  const rowsByPath = new Map((data || []).map(row => [row.path, row.content]));
  for (const relPath of SCAN_MATERIALIZE_PATHS) {
    const content = rowsByPath.get(relPath);
    if (content == null) continue;

    const absPath = path.join(tempRoot, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
  }

  if (!rowsByPath.has('portals.yml')) {
    throw new Error('portals.yml not found for tenant scan job');
  }

  return tempRoot;
}

async function syncScanArtifacts(tenantId, client, tempRoot) {
  for (const relPath of SCAN_SYNC_PATHS) {
    const absPath = path.join(tempRoot, relPath);
    try {
      const content = await fs.readFile(absPath, 'utf8');
      const { error } = await client
        .from('tenant_documents')
        .upsert(
          {
            tenant_id: tenantId,
            path: relPath,
            content,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'tenant_id,path' }
        );

      if (error) {
        throw new Error(`Failed to sync ${relPath}: ${error.message}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }
}

module.exports = {
  SCAN_MATERIALIZE_PATHS,
  SCAN_SYNC_PATHS,
  materializeTenantForScan,
  syncScanArtifacts
};
