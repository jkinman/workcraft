const { execFile } = require('child_process');
const { promisify } = require('util');
const CONFIG = require('../../config');

const execFilePromise = promisify(execFile);

function createTenantCliRunner(dataClient) {
  return {
    runNodeScript(scriptName, args = [], options = {}) {
      return execFilePromise('node', [scriptName, ...args], {
        cwd: CONFIG.CAREER_OPS_PATH,
        timeout: options.timeout || 120_000,
        maxBuffer: options.maxBuffer || 1024 * 1024,
        env: {
          ...process.env,
          CAREER_OPS_DATA_ROOT: dataClient.tenantRoot()
        }
      });
    },

    /** Canonical tracker mutation via set-status.mjs facade. */
    async setTrackerStatus(selector, state, extraArgs = [], options = {}) {
      const args = [selector, state, '--json', ...extraArgs];
      const { stdout } = await this.runNodeScript('set-status.mjs', args, options);
      return JSON.parse(stdout);
    }
  };
}

module.exports = {
  createTenantCliRunner
};
