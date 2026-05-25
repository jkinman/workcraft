// config.js - Configuration and constants
const path = require('path');

const CONFIG = {
  PORT: process.env.PORT || 3000,
  CAREER_OPS_PATH: path.join(__dirname, '..'),
  DATA_DIR: 'data',
  PIPELINE_FILE: 'pipeline.md',
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://192.168.0.50:3000'
};

module.exports = CONFIG;