function createScanService(dataClient) {
  return {
    getStats() {
      let totalScanned = 0;
      let lastScanDate = null;
      const portalBreakdown = {};
      let recentScans = [];
      const scanHistory = dataClient.readScanHistory();

      if (scanHistory) {
        const lines = scanHistory.split('\n').filter(line => line.trim());
        const dataLines = lines.slice(1);
        totalScanned = dataLines.length;

        for (const line of dataLines) {
          const parts = line.split('\t');
          if (parts.length < 6) continue;
          const date = parts[1];
          const portal = parts[2];

          portalBreakdown[portal] = (portalBreakdown[portal] || 0) + 1;
          if (!lastScanDate || date > lastScanDate) lastScanDate = date;
        }

        recentScans = dataLines
          .filter(line => line.split('\t')[1] === lastScanDate)
          .map(line => {
            const parts = line.split('\t');
            return {
              url: parts[0],
              date: parts[1],
              portal: parts[2],
              title: parts[3],
              company: parts[5]
            };
          })
          .slice(-20);
      }

      const pipelineJobs = [];
      const pipeline = dataClient.readPipeline();
      if (pipeline) {
        const matches = pipeline.matchAll(/^- \[ \] (.+)$/gm);
        for (const match of matches) {
          const parts = match[1].split('|').map(part => part.trim());
          if (parts.length >= 3) {
            pipelineJobs.push({ url: parts[0], company: parts[1], role: parts[2] });
          }
        }
      }

      const reportFiles = dataClient.listReports()
        .sort((a, b) => b.stat.mtime - a.stat.mtime);

      const recentEvaluations = reportFiles.slice(0, 10).map(file => {
        const content = dataClient.readReport(file.filename) || '';
        const titleMatch = content.match(/^#\s*(?:Evaluation|Evaluation Report|Job Evaluation):\s*(.+?)\s*[—\-–]\s*(.+)$/m);
        const scoreMatch = content.match(/\*\*Score:\*\*\s*([0-9.]+)/);
        const dateMatch = content.match(/\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/);

        return {
          filename: path.basename(file.filename),
          company: titleMatch ? titleMatch[1].trim() : 'Unknown',
          role: titleMatch ? titleMatch[2].trim() : 'Unknown',
          score: scoreMatch ? parseFloat(scoreMatch[1]) : null,
          date: dateMatch ? dateMatch[1] : null
        };
      });

      return {
        totalScanned,
        lastScanDate,
        portalBreakdown,
        recentScans,
        pendingJobs: pipelineJobs.length,
        pipelineJobs: pipelineJobs.slice(-10),
        totalEvaluated: reportFiles.length,
        recentEvaluations,
        companiesEnabled: getEnabledCompanyCount(dataClient)
      };
    }
  };
}

function getEnabledCompanyCount(dataClient) {
  const portals = dataClient.readPortals();
  if (!portals) return 0;
  const yaml = require('js-yaml');
  const config = yaml.load(portals);
  return (config.tracked_companies || []).filter(company => company.enabled !== false).length;
}

module.exports = {
  createScanService
};
