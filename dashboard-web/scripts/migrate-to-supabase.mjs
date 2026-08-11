#!/usr/bin/env node
/**
 * migrate-to-supabase.mjs
 *
 * Copies all tenant data from the local filesystem into Supabase.
 * Run once before switching CAREER_OPS_TENANT_MODE=hosted.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhb... \
 *   node dashboard-web/scripts/migrate-to-supabase.mjs
 *
 * Optional:
 *   --tenant <id>   Migrate only one tenant folder (default: all under tenants/)
 *   --dry-run       Print what would be migrated without writing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tenantFlag = args.indexOf('--tenant');
const targetTenant = tenantFlag !== -1 ? args[tenantFlag + 1] : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Text file extensions to migrate into tenant_documents table
const TEXT_EXTENSIONS = new Set(['.md', '.yml', '.yaml', '.txt', '.json', '.tsv']);
// Binary extensions to migrate into Supabase Storage
const BINARY_EXTENSIONS = new Set(['.pdf']);
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'career-ops-files';

function findTenantDirs(rootPath) {
  const tenantsDir = join(rootPath, 'tenants');
  if (!existsSync(tenantsDir)) return [];

  return readdirSync(tenantsDir)
    .filter(name => !name.startsWith('.'))
    .filter(name => !targetTenant || name === targetTenant)
    .map(name => ({ tenantId: name, tenantPath: join(tenantsDir, name) }));
}

function collectFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const results = [];

  for (const entry of readdirSync(dir)) {
    if (entry === '.gitkeep') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...collectFiles(fullPath, base));
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'));
      if (TEXT_EXTENSIONS.has(ext) || BINARY_EXTENSIONS.has(ext)) {
        results.push({
          fullPath,
          relPath: relative(base, fullPath),
          ext,
          size: stat.size
        });
      }
    }
  }

  return results;
}

async function migrateTextFile(tenantId, relPath, fullPath) {
  const content = readFileSync(fullPath, 'utf8');
  if (dryRun) {
    console.log(`  [dry] text  ${relPath} (${content.length} chars)`);
    return;
  }

  const { error } = await supabase
    .from('tenant_documents')
    .upsert(
      { tenant_id: tenantId, path: relPath, content, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,path' }
    );

  if (error) throw new Error(`Failed to write ${relPath}: ${error.message}`);
  console.log(`  ✓ text   ${relPath}`);
}

async function migrateBinaryFile(tenantId, relPath, fullPath) {
  const content = readFileSync(fullPath);
  const storageKey = `${tenantId}/${relPath}`;

  if (dryRun) {
    console.log(`  [dry] binary ${relPath} (${content.length} bytes)`);
    return;
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, content, { upsert: true, contentType: 'application/pdf' });

  if (error) throw new Error(`Failed to upload ${relPath}: ${error.message}`);
  console.log(`  ✓ binary ${relPath}`);
}

async function main() {
  // Find the repo root (where tenants/ lives)
  const rootPath = join(new URL(import.meta.url).pathname, '..', '..', '..');

  const tenants = findTenantDirs(rootPath);

  if (tenants.length === 0) {
    console.log('No tenant directories found. Nothing to migrate.');
    return;
  }

  console.log(`\nMigrating ${tenants.length} tenant(s) to Supabase${dryRun ? ' (DRY RUN)' : ''}...\n`);

  let totalText = 0;
  let totalBinary = 0;
  let errors = 0;

  for (const { tenantId, tenantPath } of tenants) {
    console.log(`Tenant: ${tenantId}`);
    const files = collectFiles(tenantPath);

    for (const file of files) {
      try {
        if (BINARY_EXTENSIONS.has(file.ext)) {
          await migrateBinaryFile(tenantId, file.relPath, file.fullPath);
          totalBinary++;
        } else {
          await migrateTextFile(tenantId, file.relPath, file.fullPath);
          totalText++;
        }
      } catch (err) {
        console.error(`  ✗ ${file.relPath}: ${err.message}`);
        errors++;
      }
    }
    console.log('');
  }

  console.log('─'.repeat(45));
  console.log(`Text files:   ${totalText}`);
  console.log(`Binary files: ${totalBinary}`);
  if (errors > 0) console.log(`Errors:       ${errors}`);
  if (dryRun) console.log('\n(dry run — nothing was written)');
  else console.log('\nMigration complete.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
