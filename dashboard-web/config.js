// config.js - Configuration and constants
const path = require('path');

const CONFIG = {
  PORT: process.env.PORT || 3000,
  CAREER_OPS_PATH: path.join(__dirname, '..'),
  DATA_DIR: 'data',
  PIPELINE_FILE: 'pipeline.md'
};

module.exports = CONFIG;