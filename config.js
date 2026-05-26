// config.js - Configuration and constants
const path = require('path');

const CONFIG = {
  PORT: process.env.PORT || 3000,
  CAREER_OPS_PATH: process.env.CAREER_OPS_PATH || path.join(__dirname, '..'),
  DATA_DIR: 'data',
  PIPELINE_FILE: 'pipeline.md',
  DASHBOARD_URL: process.env.DASHBOARD_URL || `http://localhost:${process.env.PORT || 3000}`
};

module.exports = CONFIG;