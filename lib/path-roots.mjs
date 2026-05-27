import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const SYSTEM_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function resolveDataRoot(env = process.env, systemRoot = SYSTEM_ROOT) {
  return env.CAREER_OPS_DATA_ROOT || systemRoot;
}

function resolveApplicationsPath(dataRoot) {
  const dataApplicationsPath = join(dataRoot, 'data', 'applications.md');
  return existsSync(dataApplicationsPath)
    ? dataApplicationsPath
    : join(dataRoot, 'applications.md');
}

function resolveCareerOpsPaths(env = process.env) {
  const systemRoot = SYSTEM_ROOT;
  const dataRoot = resolveDataRoot(env, systemRoot);

  return {
    systemRoot,
    dataRoot,
    portalsPath: join(dataRoot, 'portals.yml'),
    scanHistoryPath: join(dataRoot, 'data', 'scan-history.tsv'),
    pipelinePath: join(dataRoot, 'data', 'pipeline.md'),
    applicationsPath: resolveApplicationsPath(dataRoot),
    trackerAdditionsDir: join(dataRoot, 'batch', 'tracker-additions'),
    reportsDir: join(dataRoot, 'reports'),
    statesPath: existsSync(join(systemRoot, 'templates', 'states.yml'))
      ? join(systemRoot, 'templates', 'states.yml')
      : join(systemRoot, 'states.yml')
  };
}

export {
  SYSTEM_ROOT,
  resolveApplicationsPath,
  resolveCareerOpsPaths,
  resolveDataRoot
};
