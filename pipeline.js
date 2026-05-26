// pipeline.js - Pipeline data parsing and management
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');
const {
  addEntryToPipelineContent,
  emptyPipeline,
  inferPipelineEntry,
  parsePipelineContent
} = require('./lib/services/pipeline-service');

function parsePipeline() {
  const pipelinePath = path.join(CONFIG.CAREER_OPS_PATH, CONFIG.DATA_DIR, CONFIG.PIPELINE_FILE);
  
  if (!fs.existsSync(pipelinePath)) {
    return emptyPipeline();
  }

  const content = fs.readFileSync(pipelinePath, 'utf8');
  return parsePipelineContent(content);
}

function addToPipeline(url, notes) {
  const entryData = inferPipelineEntry(url, notes);
  const pipelinePath = path.join(CONFIG.CAREER_OPS_PATH, CONFIG.DATA_DIR, CONFIG.PIPELINE_FILE);
  const content = fs.existsSync(pipelinePath) ? fs.readFileSync(pipelinePath, 'utf8') : '';
  fs.writeFileSync(pipelinePath, addEntryToPipelineContent(content, entryData));
  
  return entryData;
}

module.exports = { parsePipeline, addToPipeline, parsePipelineContent, inferPipelineEntry, addEntryToPipelineContent };