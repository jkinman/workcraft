const fs = require('fs/promises');
const path = require('path');

let discoveryPathsModule;
let evaluationPathsModule;

async function loadDiscoveryPaths() {
  if (!discoveryPathsModule) {
    discoveryPathsModule = await import('../../../lib/discovery/paths.mjs');
  }
  return discoveryPathsModule;
}

async function loadEvaluationPaths() {
  if (!evaluationPathsModule) {
    evaluationPathsModule = await import('../../../lib/evaluation/paths.mjs');
  }
  return evaluationPathsModule;
}

async function materializeTenantDocuments(tenantId, client, tempRoot, relPaths, { requiredPath } = {}) {
  const { data, error } = await client
    .from('tenant_documents')
    .select('path, content')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`Failed to load tenant documents: ${error.message}`);
  }

  const rowsByPath = new Map((data || []).map(row => [row.path, row.content]));
  for (const relPath of relPaths) {
    const content = rowsByPath.get(relPath);
    if (content == null) continue;

    const absPath = path.join(tempRoot, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf8');
  }

  if (requiredPath && !rowsByPath.has(requiredPath)) {
    throw new Error(`${requiredPath} not found for tenant job`);
  }

  return tempRoot;
}

async function syncTenantDocuments(tenantId, client, tempRoot, relPaths) {
  for (const relPath of relPaths) {
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

async function syncTenantReportFiles(tenantId, client, tempRoot) {
  const reportsDir = path.join(tempRoot, 'reports');
  let entries = [];
  try {
    entries = await fs.readdir(reportsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const filename of entries) {
    if (!filename.endsWith('.md')) continue;
    const relPath = `reports/${filename}`;
    const content = await fs.readFile(path.join(reportsDir, filename), 'utf8');
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
  }
}

async function materializeTenantForScan(tenantId, client, tempRoot) {
  const { SCAN_MATERIALIZE_REL_PATHS } = await loadDiscoveryPaths();
  return materializeTenantDocuments(tenantId, client, tempRoot, SCAN_MATERIALIZE_REL_PATHS, {
    requiredPath: 'portals.yml',
  });
}

async function syncScanArtifacts(tenantId, client, tempRoot) {
  const { SCAN_SYNC_REL_PATHS } = await loadDiscoveryPaths();
  return syncTenantDocuments(tenantId, client, tempRoot, SCAN_SYNC_REL_PATHS);
}

async function materializeTenantForEvaluation(tenantId, client, tempRoot) {
  const { EVAL_MATERIALIZE_REL_PATHS } = await loadEvaluationPaths();
  return materializeTenantDocuments(tenantId, client, tempRoot, EVAL_MATERIALIZE_REL_PATHS, {
    requiredPath: 'cv.md',
  });
}

async function syncEvaluationArtifacts(tenantId, client, tempRoot) {
  const { EVAL_SYNC_REL_PATHS } = await loadEvaluationPaths();
  await syncTenantDocuments(tenantId, client, tempRoot, EVAL_SYNC_REL_PATHS);
  await syncTenantReportFiles(tenantId, client, tempRoot);
}

module.exports = {
  loadDiscoveryPaths,
  loadEvaluationPaths,
  materializeTenantForScan,
  syncScanArtifacts,
  materializeTenantForEvaluation,
  syncEvaluationArtifacts,
};
