/**
 * Recording Supabase stub for tenant_documents materialization/sync tests.
 */

function cloneDocuments(documents) {
  return documents.map((doc) => ({ ...doc }));
}

function createRecordingTenantDocumentsClient(initialDocuments = [], options = {}) {
  const documents = cloneDocuments(initialDocuments);
  const recordings = {
    selects: [],
    upserts: [],
  };

  const client = {
    documents,
    recordings,
    from(table) {
      if (table !== 'tenant_documents') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select(columns = '*') {
          return {
            eq(column, tenantId) {
              recordings.selects.push({ table, columns, column, tenantId });
              if (options.selectError) {
                return Promise.resolve({ data: null, error: options.selectError });
              }
              const data = documents.filter((row) => row.tenant_id === tenantId);
              return Promise.resolve({ data: cloneDocuments(data), error: null });
            },
          };
        },
        upsert(row, opts = {}) {
          recordings.upserts.push({ row: { ...row }, opts: { ...opts } });
          if (options.upsertError) {
            return Promise.resolve({ error: options.upsertError });
          }
          if (typeof options.upsertHook === 'function') {
            const hookResult = options.upsertHook(row, documents);
            if (hookResult?.error) {
              return Promise.resolve({ error: hookResult.error });
            }
          }
          const index = documents.findIndex(
            (doc) => doc.tenant_id === row.tenant_id && doc.path === row.path,
          );
          if (index === -1) documents.push({ ...row });
          else documents[index] = { ...row };
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return client;
}

module.exports = {
  createRecordingTenantDocumentsClient,
};
