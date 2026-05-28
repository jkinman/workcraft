const fs = require('fs');
const path = require('path');
const CONFIG = require('../../config');

const EMPTY_PIPELINE = `# Pipeline

## Pending

## In Progress

## Applied

## Rejected
`;

function readTemplate(relativePath) {
  const templatePath = path.join(CONFIG.CAREER_OPS_PATH, relativePath);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Default template not found: ${relativePath}`);
  }
  return fs.readFileSync(templatePath, 'utf8');
}

function createSetupService(dataClient) {
  function getStatus() {
    const files = {
      cv: Boolean(dataClient.readCv()),
      profile: Boolean(dataClient.readProfile()),
      portals: Boolean(dataClient.readPortals()),
      pipeline: Boolean(dataClient.readPipeline())
    };

    return {
      files,
      ready: {
        queue: files.pipeline,
        scan: files.portals && files.pipeline,
        profile: files.cv && files.profile
      },
      missing: Object.entries(files)
        .filter(([, exists]) => !exists)
        .map(([name]) => name)
    };
  }

  function initialize(target = 'all') {
    const initialized = [];

    if ((target === 'all' || target === 'portals') && !dataClient.readPortals()) {
      dataClient.writePortals(readTemplate('templates/portals.example.yml'));
      initialized.push('portals');
    }

    if ((target === 'all' || target === 'profile') && !dataClient.readProfile()) {
      dataClient.writeProfile(readTemplate('config/profile.example.yml'));
      initialized.push('profile');
    }

    if ((target === 'all' || target === 'pipeline') && !dataClient.readPipeline()) {
      dataClient.writePipeline(EMPTY_PIPELINE);
      initialized.push('pipeline');
    }

    return {
      initialized,
      status: getStatus()
    };
  }

  function requireScanReady() {
    const status = getStatus();
    if (!status.ready.scan) {
      const missing = [];
      if (!status.files.portals) missing.push('portals');
      if (!status.files.pipeline) missing.push('pipeline');

      return {
        success: false,
        code: 'setup_required',
        error: 'Scanner setup is incomplete',
        missing,
        status
      };
    }

    return { success: true, status };
  }

  return {
    getStatus,
    initialize,
    requireScanReady
  };
}

module.exports = {
  EMPTY_PIPELINE,
  createSetupService
};
