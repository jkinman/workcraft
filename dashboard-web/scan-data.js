// scan-data.js — Real-time scan statistics from data files
const fs = require('fs');
const path = require('path');
const CONFIG = require('./config');

function getScanStats() {
  const careerOpsPath = CONFIG.CAREER_OPS_PATH;
  const scanHistoryPath = path.join(careerOpsPath, 'data', 'scan-history.tsv');
  const pipelinePath = path.join(careerOpsPath, 'data', 'pipeline.md');
  const reportsDir = path.join(careerOpsPath, 'reports');
  const portalsPath = path.join(careerOpsPath, 'portals.yml');

  // ── Scan History ────────────────────────────────────────────────────
  let totalScanned = 0;
  let lastScanDate = null;
  let portalBreakdown = {};
  let recentScans = [];

  if (fs.existsSync(scanHistoryPath)) {
    const lines = fs.readFileSync(scanHistoryPath, 'utf8').split('\n').filter(l => l.trim());
    const header = lines[0];
    const dataLines = lines.slice(1);
    totalScanned = dataLines.length;

    const dates = new Set();
    for (const line of dataLines) {
      const parts = line.split('\t');
      if (parts.length >= 6) {
        const date = parts[1];
        const portal = parts[2];
        const title = parts[3];
        const company = parts[5];

        dates.add(date);
        portalBreakdown[portal] = (portalBreakdown[portal] || 0) + 1;

        // Track most recent scan date
        if (!lastScanDate || date > lastScanDate) {
          lastScanDate = date;
        }
      }
    }

    // Get today's scans (most recent date)
    const todayScans = dataLines
      .filter(l => l.split('\t')[1] === lastScanDate)
      .map(l => {
        const parts = l.split('\t');
        return {
          url: parts[0],
          date: parts[1],
          portal: parts[2],
          title: parts[3],
          company: parts[5]
        };
      })
      .slice(-20); // Last 20

    recentScans = todayScans;
  }

  // ── Pipeline (Pending) ──────────────────────────────────────────────
  let pendingJobs = 0;
  let pipelineJobs = [];

  if (fs.existsSync(pipelinePath)) {
    const text = fs.readFileSync(pipelinePath, 'utf8');
    const matches = text.matchAll(/^- \[ \] (.+)$/gm);
    for (const match of matches) {
      pendingJobs++;
      const parts = match[1].split('|').map(p => p.trim());
      if (parts.length >= 3) {
        pipelineJobs.push({
          url: parts[0],
          company: parts[1],
          role: parts[2]
        });
      }
    }
  }

  // ── Evaluations (Reports) ───────────────────────────────────────────
  let totalEvaluated = 0;
  let recentEvaluations = [];

  if (fs.existsSync(reportsDir)) {
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith('.md'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(reportsDir, a));
        const statB = fs.statSync(path.join(reportsDir, b));
        return statB.mtime - statA.mtime;
      });

    totalEvaluated = files.length;

    // Get 10 most recent
    recentEvaluations = files.slice(0, 10).map(f => {
      const content = fs.readFileSync(path.join(reportsDir, f), 'utf8');
      const titleMatch = content.match(/^#\s*(?:Evaluation|Evaluation|Evaluation Report|Job Evaluation):\s*(.+?)\s*[—\-–]\s*(.+)$/m);
      const scoreMatch = content.match(/\*\*Score:\*\*\s*([0-9.]+)/);
      const dateMatch = content.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);

      return {
        filename: f,
        company: titleMatch ? titleMatch[1].trim() : 'Unknown',
        role: titleMatch ? titleMatch[2].trim() : 'Unknown',
        score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
        date: dateMatch ? dateMatch[1] : null
      };
    });
  }

  // ── Portals (Companies) ─────────────────────────────────────────────
  let companiesEnabled = 0;
  let companiesByPortal = {};

  if (fs.existsSync(portalsPath)) {
    const yaml = require('js-yaml');
    const config = yaml.load(fs.readFileSync(portalsPath, 'utf8'));
    const companies = config.tracked_companies || [];
    const enabled = companies.filter(c => c.enabled !== false);
    companiesEnabled = enabled.length;

    for (const c of enabled) {
      const url = c.careers_url || c.api || '';
      let portal = 'unknown';
      if (url.includes('greenhouse')) portal = 'greenhouse';
      else if (url.includes('ashbyhq')) portal = 'ashby';
      else if (url.includes('lever.co')) portal = 'lever';
      else if (url.includes('pinpointhq')) portal = 'pinpoint';
      else if (url.includes('ycombinator')) portal = 'ycombinator';

      companiesByPortal[portal] = (companiesByPortal[portal] || 0) + 1;
    }
  }

  return {
    totalScanned,
    lastScanDate,
    portalBreakdown,
    recentScans,
    pendingJobs,
    pipelineJobs: pipelineJobs.slice(-10),
    totalEvaluated,
    recentEvaluations,
    companiesEnabled,
    companiesByPortal
  };
}

module.exports = { getScanStats };
