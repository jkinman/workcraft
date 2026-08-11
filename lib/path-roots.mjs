/**
 * Workspace path catalog — canonical roots for CLI, batch, dashboard worker,
 * and discovery modules. Entry facades stay at the repository root; they import
 * from here instead of duplicating join()/env logic.
 */

import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SYSTEM_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** @typedef {ReturnType<typeof resolveCareerOpsPaths>} CareerOpsPaths */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [systemRoot]
 */
function resolveDataRoot(env = process.env, systemRoot = SYSTEM_ROOT) {
  return env.CAREER_OPS_DATA_ROOT || systemRoot;
}

/**
 * @param {string} dataRoot
 */
function resolveApplicationsPath(dataRoot) {
  const dataApplicationsPath = join(dataRoot, 'data', 'applications.md');
  return existsSync(dataApplicationsPath)
    ? dataApplicationsPath
    : join(dataRoot, 'applications.md');
}

/**
 * @param {string} [systemRoot]
 */
function resolveStatesPath(systemRoot = SYSTEM_ROOT) {
  const templatesPath = join(systemRoot, 'templates', 'states.yml');
  return existsSync(templatesPath) ? templatesPath : join(systemRoot, 'states.yml');
}

/**
 * Build the full workspace path catalog for tenant-aware callers.
 *
 * When `CAREER_OPS_DATA_ROOT` is unset, `dataRoot` equals `systemRoot` so
 * local-dev scripts keep cwd-compatible defaults without changing entrypoints.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {CareerOpsPaths}
 */
function resolveCareerOpsPaths(env = process.env) {
  const systemRoot = SYSTEM_ROOT;
  const dataRoot = resolveDataRoot(env, systemRoot);
  const batchDir = join(dataRoot, 'batch');
  const applicationsPath = resolveApplicationsPath(dataRoot);
  const trackerDir = dirname(applicationsPath);

  return {
    systemRoot,
    dataRoot,
    cvPath: join(dataRoot, 'cv.md'),
    profilePath: env.CAREER_OPS_PROFILE || join(dataRoot, 'config', 'profile.yml'),
    portalsPath: env.CAREER_OPS_PORTALS || join(dataRoot, 'portals.yml'),
    scanHistoryPath: env.CAREER_OPS_SCAN_HISTORY || join(dataRoot, 'data', 'scan-history.tsv'),
    scanRunsPath: join(dataRoot, 'data', 'scan-runs.tsv'),
    portalHealthPath: join(dataRoot, 'data', 'portal-health.tsv'),
    pipelinePath: env.CAREER_OPS_PIPELINE || join(dataRoot, 'data', 'pipeline.md'),
    blacklistPath: join(dataRoot, 'data', 'blacklist.md'),
    followUpsPath: join(dataRoot, 'data', 'follow-ups.md'),
    applicationsPath,
    statusLogPath: join(trackerDir, 'status-log.tsv'),
    pdfIndexPath: join(dataRoot, 'data', 'pdf-index.tsv'),
    trackerAdditionsDir: env.CAREER_OPS_ADDITIONS || join(batchDir, 'tracker-additions'),
    batchDir,
    batchStatePath: join(batchDir, 'batch-state.tsv'),
    batchInputPath: join(batchDir, 'batch-input.tsv'),
    batchPromptPath: join(batchDir, 'batch-prompt.md'),
    batchLogsDir: join(batchDir, 'logs'),
    batchStateLockDir: join(batchDir, '.batch-state.lock'),
    reportsDir: env.CAREER_OPS_REPORTS || join(dataRoot, 'reports'),
    jdsDir: join(dataRoot, 'jds'),
    outputDir: join(dataRoot, 'output'),
    statesPath: resolveStatesPath(systemRoot),
    trackerAliasesPath: join(systemRoot, 'tracker-aliases.json'),
    trackerContractPath: join(systemRoot, 'templates', 'tracker-contract.json'),
    modesDir: join(systemRoot, 'modes'),
    templatesDir: join(systemRoot, 'templates'),
    cvTemplateHtml: join(systemRoot, 'templates', 'cv-template.html'),
    cvTemplateTex: join(systemRoot, 'templates', 'cv-template.tex'),
    cvTemplateCover: join(systemRoot, 'templates', 'cover-letter-template.html'),
    pluginsDir: join(systemRoot, 'plugins'),
    pluginsLocalDir: join(dataRoot, 'plugins.local'),
    pluginsLockPath: join(dataRoot, 'plugins.lock'),
    pluginsConfigPath: join(dataRoot, 'config', 'plugins.yml'),
    providersDir: join(systemRoot, 'providers'),
    dashboardWebRoot: join(systemRoot, 'dashboard-web'),
    dashboardGoRoot: join(systemRoot, 'dashboard'),
  };
}

/**
 * Cwd-relative catalog for non-tenant discovery/scan mode (legacy behavior).
 *
 * @param {string} [cwd]
 * @param {NodeJS.ProcessEnv} [env]
 */
function resolveLocalWorkspacePaths(cwd = process.cwd(), env = process.env) {
  const systemRoot = SYSTEM_ROOT;
  const batchDir = join(cwd, 'batch');
  const applicationsPath = resolveApplicationsPath(cwd);
  const trackerDir = dirname(applicationsPath);

  return {
    systemRoot,
    dataRoot: cwd,
    cvPath: join(cwd, 'cv.md'),
    profilePath: env.CAREER_OPS_PROFILE || join(cwd, 'config', 'profile.yml'),
    portalsPath: env.CAREER_OPS_PORTALS || join(cwd, 'portals.yml'),
    scanHistoryPath: env.CAREER_OPS_SCAN_HISTORY || join(cwd, 'data', 'scan-history.tsv'),
    scanRunsPath: join(cwd, 'data', 'scan-runs.tsv'),
    portalHealthPath: join(cwd, 'data', 'portal-health.tsv'),
    pipelinePath: env.CAREER_OPS_PIPELINE || join(cwd, 'data', 'pipeline.md'),
    blacklistPath: join(cwd, 'data', 'blacklist.md'),
    followUpsPath: join(cwd, 'data', 'follow-ups.md'),
    applicationsPath,
    statusLogPath: join(trackerDir, 'status-log.tsv'),
    pdfIndexPath: join(cwd, 'data', 'pdf-index.tsv'),
    trackerAdditionsDir: join(batchDir, 'tracker-additions'),
    batchDir,
    batchStatePath: join(batchDir, 'batch-state.tsv'),
    batchInputPath: join(batchDir, 'batch-input.tsv'),
    batchPromptPath: join(batchDir, 'batch-prompt.md'),
    batchLogsDir: join(batchDir, 'logs'),
    batchStateLockDir: join(batchDir, '.batch-state.lock'),
    reportsDir: join(cwd, 'reports'),
    jdsDir: join(cwd, 'jds'),
    outputDir: join(cwd, 'output'),
    statesPath: resolveStatesPath(systemRoot),
    trackerAliasesPath: join(systemRoot, 'tracker-aliases.json'),
    trackerContractPath: join(systemRoot, 'templates', 'tracker-contract.json'),
    modesDir: join(systemRoot, 'modes'),
    templatesDir: join(systemRoot, 'templates'),
    cvTemplateHtml: join(systemRoot, 'templates', 'cv-template.html'),
    cvTemplateTex: join(systemRoot, 'templates', 'cv-template.tex'),
    cvTemplateCover: join(systemRoot, 'templates', 'cover-letter-template.html'),
    pluginsDir: join(systemRoot, 'plugins'),
    pluginsLocalDir: join(cwd, 'plugins.local'),
    pluginsLockPath: join(cwd, 'plugins.lock'),
    pluginsConfigPath: join(cwd, 'config', 'plugins.yml'),
    providersDir: join(systemRoot, 'providers'),
    dashboardWebRoot: join(systemRoot, 'dashboard-web'),
    dashboardGoRoot: join(systemRoot, 'dashboard'),
  };
}

export {
  SYSTEM_ROOT,
  resolveApplicationsPath,
  resolveCareerOpsPaths,
  resolveDataRoot,
  resolveLocalWorkspacePaths,
  resolveStatesPath,
};
