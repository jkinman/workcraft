// pdf-generator.js — legacy facade delegating to pdf-bundle-generator + lib/profile bridge
const pdfBundle = require('./pdf-bundle-generator');
const { loadDashboardProfile } = require('./lib/profile-bridge');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

async function generateTailoredCV(company, role, jobDescription, options = {}) {
  return pdfBundle.generateResumePDF(company, role, jobDescription, options);
}

function loadProfile() {
  const profilePath = path.join(CONFIG.CAREER_OPS_PATH, 'config', 'profile.yml');
  if (!fs.existsSync(profilePath)) {
    return loadDashboardProfile('');
  }
  return loadDashboardProfile(fs.readFileSync(profilePath, 'utf8'));
}

module.exports = {
  generateTailoredCV,
  extractKeywords: pdfBundle.extractKeywords,
  detectFormat: pdfBundle.detectFormat,
  loadProfile,
};
