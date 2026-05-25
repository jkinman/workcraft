// styles.js - Terminal-themed CSS (Catppuccin Mocha)
function getStyles() {
  return `
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

:root {
  --bg: #121221;
  --bg-alt: #1a1a2a;
  --bg-card: #1e1e2e;
  --bg-hover: #292839;
  --border: #313244;
  --border-light: #45464f;
  --text: #e3e0f7;
  --text-muted: #c6c5d1;
  --text-dim: #90909a;
  --primary: #d8dbff;
  --primary-dim: #bac3ff;
  --primary-bg: #414b83;
  --success: #99d595;
  --success-bg: #19511f;
  --warning: #f9e2af;
  --error: #ffb4ab;
  --error-bg: #93000a;
  --pink: #ffd2dc;
  --pink-bg: #85324e;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Space Mono', monospace;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  font-size: 14px;
  min-height: 100vh;
}

/* Header / Nav */
.header {
  background: var(--bg-alt);
  border-bottom: 1px solid var(--border);
  padding: 0;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.header-top h1 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: -0.02em;
}

.header-top h1 a {
  color: var(--primary);
  text-decoration: none;
}

.breadcrumb {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  color: var(--text-dim);
}

.breadcrumb::before {
  content: '~/career-ops';
  color: var(--success);
}

.nav-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.nav-btn {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 14px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-btn:hover, .nav-btn.active {
  background: var(--primary);
  color: var(--bg);
  border-color: var(--primary);
}

/* Stats Bar */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
}

.stat-cell {
  background: var(--bg-alt);
  padding: 12px 16px;
  text-align: center;
}

.stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 24px;
  font-weight: 700;
  display: block;
}

.stat-value.dream { color: var(--success); }
.stat-value.strong { color: var(--warning); }
.stat-value.good { color: var(--primary-dim); }

.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  margin-top: 4px;
}

/* Container */
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
}

/* Section Headers */
.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed var(--border);
}

.section-title::before {
  content: '## ';
  color: var(--primary-dim);
}

/* Terminal Prompt */
.prompt {
  color: var(--success);
  margin-right: 8px;
}

.prompt::after {
  content: '>';
}

/* Job Table */
.job-table {
  width: 100%;
  border-collapse: collapse;
}

.job-table th {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.job-table th:last-child {
  text-align: right;
}

.job-row {
  border-bottom: 1px dashed var(--border);
  cursor: pointer;
  transition: background 0.1s;
}

.job-row:hover {
  background: var(--bg-hover);
}

.job-row td {
  padding: 12px;
  vertical-align: middle;
}

.job-row td:last-child {
  text-align: right;
}

/* Status Badges */
.status-badge {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  border: 1px solid var(--border);
  display: inline-block;
}

.status-badge.status-evaluated { background-color: rgba(144,144,154,0.1); color: var(--text-dim); border-color: var(--text-dim); }
.status-badge.status-applied { background-color: rgba(153,213,149,0.1); color: var(--success); border-color: var(--success); }
.status-badge.status-interview { background-color: rgba(216,219,255,0.1); color: var(--primary); border-color: var(--primary); }
.status-badge.status-offer { background-color: rgba(153,213,149,0.2); color: #c3fcd4; border-color: #c3fcd4; font-weight: 700; }
.status-badge.status-rejected { background-color: rgba(255,180,171,0.1); color: var(--error); border-color: var(--error); }
.status-badge.status-pending { background-color: rgba(144,144,154,0.1); color: var(--text-dim); border-color: var(--border); }
.status-badge.status-reviewing { background-color: rgba(249,226,175,0.1); color: var(--warning); border-color: var(--warning); }

/* Score Blocks */
.score-block {
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  padding: 4px 8px;
  display: inline-block;
}

.score-a { color: var(--success); }
.score-b { color: var(--warning); }
.score-c { color: var(--primary-dim); }
.score-d { color: var(--text-muted); }
.score-f { color: var(--error); }

/* Progress Bar */
.progress-bar {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
}

.progress-bar .fill { color: var(--success); }
.progress-bar .empty { color: var(--border); }

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  padding: 16px;
  margin-bottom: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.card-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.card-subtitle {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

/* Detail Blocks (A-G) */
.detail-block {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-left: 3px solid var(--primary-dim);
  padding: 16px;
  margin-bottom: 12px;
}

.detail-block.success { border-left-color: var(--success); }
.detail-block.warning { border-left-color: var(--warning); }
.detail-block.error { border-left-color: var(--error); }

.block-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--primary-dim);
  margin-bottom: 12px;
}

.block-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted);
}

.block-content ul {
  list-style: none;
  padding: 0;
}

.block-content li {
  padding: 4px 0;
  padding-left: 16px;
  position: relative;
}

.block-content li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--primary-dim);
}

.block-content li.match::before { content: '[+]'; color: var(--success); font-size: 10px; }
.block-content li.gap::before { content: '[-]'; color: var(--error); font-size: 10px; }

/* Buttons */
.btn {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 16px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
  transition: all 0.15s;
}

.btn:hover {
  background: var(--primary);
  color: var(--bg);
  border-color: var(--primary);
}

.btn-primary {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-primary:hover {
  background: var(--primary);
  color: var(--bg);
}

.btn-success {
  border-color: var(--success);
  color: var(--success);
}

.btn-success:hover {
  background: var(--success);
  color: var(--bg);
}

/* Verdict Banner */
.verdict-banner {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 12px 16px;
  border: 1px solid;
  margin-bottom: 16px;
}

.verdict-apply { color: var(--success); border-color: var(--success); background: rgba(153,213,149,0.08); }
.verdict-strong { color: var(--warning); border-color: var(--warning); background: rgba(249,226,175,0.08); }
.verdict-consider { color: var(--primary-dim); border-color: var(--primary-dim); background: rgba(186,195,255,0.08); }
.verdict-skip { color: var(--error); border-color: var(--error); background: rgba(255,180,171,0.08); }

/* Top Picks */
.top-picks {
  margin-bottom: 24px;
}

.top-pick-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 3px solid var(--success);
  padding: 12px 16px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.1s;
}

.top-pick-item:hover {
  background: var(--bg-hover);
}

.top-pick-company {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 14px;
}

.top-pick-role {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

.top-pick-score {
  font-family: 'Space Mono', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--success);
  text-decoration: none;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-dim);
  font-size: 13px;
}

.empty-state::before {
  content: '[EMPTY]';
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  color: var(--border);
  margin-bottom: 12px;
}

/* Responsive */
@media (max-width: 640px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .job-table th:nth-child(4),
  .job-table td:nth-child(4) {
    display: none;
  }
  
  .header-top {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .nav-buttons {
    width: 100%;
  }
  
  .nav-btn {
    flex: 1;
    text-align: center;
    padding: 10px 8px;
    font-size: 11px;
  }
  
  .card-header {
    flex-direction: column;
  }
}

/* PDF Status Messages */
.pdf-status {
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: var(--bg-alt);
}

.pdf-status.success {
  border-color: var(--success);
  color: var(--success);
  background: rgba(153,213,149,0.08);
}

.pdf-status.error {
  border-color: var(--error);
  color: var(--error);
  background: rgba(255,180,171,0.08);
}

/* Scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); }
::-webkit-scrollbar-thumb:hover { background: var(--border-light); }
</style>
  `;
}

module.exports = { getStyles };
