// components.js - Terminal-themed HTML components

function renderHeader(stats, dashboardUrl, activeView = 'ranked') {
  const { dream, strong, good, total } = stats;

  return `
    <div class="header">
        <div class="header-top">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="/logo.png" alt="Angry Mob" style="height:40px;width:auto;">
                <div>
                    <h1><a href="${dashboardUrl}/">~/career-ops/dashboard</a></h1>
                    <div class="breadcrumb">/${activeView}</div>
                </div>
            </div>
            <div class="nav-buttons">
                <a href="${dashboardUrl}/?view=ranked" class="nav-btn ${activeView === 'ranked' ? 'active' : ''}">analytics /eval</a>
                <a href="${dashboardUrl}/?view=pipeline" class="nav-btn ${activeView === 'pipeline' ? 'active' : ''}">list_alt /tracker</a>
                <a href="${dashboardUrl}/scan" class="nav-btn ${activeView === 'scan' ? 'active' : ''}">radar /scan</a>
            </div>
        </div>
        <div class="stats-bar">
            <div class="stat-cell">
                <span class="stat-value dream">${dream}</span>
                <span class="stat-label">DREAM [A]</span>
            </div>
            <div class="stat-cell">
                <span class="stat-value strong">${strong}</span>
                <span class="stat-label">STRONG [B]</span>
            </div>
            <div class="stat-cell">
                <span class="stat-value good">${good}</span>
                <span class="stat-label">GOOD [C]</span>
            </div>
            <div class="stat-cell">
                <span class="stat-value">${total}</span>
                <span class="stat-label">TOTAL EVAL</span>
            </div>
        </div>
    </div>
  `;
}

function renderTopPicks(jobs, dashboardUrl) {
  const dreamJobs = jobs.filter(j => j.score >= 4.5).slice(0, 3);

  if (dreamJobs.length === 0) {
    return '';
  }

  const { slugify } = require('./report-parser');

  return `
    <div class="section-title">PRIORITY_TARGETS [APPLY NOW]</div>
    <div class="top-picks">
        ${dreamJobs.map(job => {
          const slug = slugify(job.company, job.url, job.filename);
          return `
            <a href="${dashboardUrl}/job/${slug}" style="text-decoration:none;color:inherit;">
                <div class="top-pick-item">
                    <div>
                        <div class="top-pick-company">${job.company}</div>
                        <div class="top-pick-role">${job.role}</div>
                    </div>
                    <span class="top-pick-score">[ ${job.score.toFixed(1)} ]</span>
                </div>
            </a>
          `;
        }).join('')}
    </div>
  `;
}

function scoreToGrade(score) {
  if (score >= 4.5) return { grade: 'A', class: 'score-a' };
  if (score >= 4.0) return { grade: 'B', class: 'score-b' };
  if (score >= 3.5) return { grade: 'C', class: 'score-c' };
  if (score >= 3.0) return { grade: 'D', class: 'score-d' };
  return { grade: 'F', class: 'score-f' };
}

function statusToBadge(status) {
  const map = {
    'pending': 'status-pending',
    'inprogress': 'status-reviewing',
    'applied': 'status-applied',
    'interview': 'status-interview',
    'rejected': 'status-rejected',
    'reviewing': 'status-reviewing'
  };
  return map[status?.toLowerCase().replace(/\s+/g, '')] || 'status-pending';
}

function renderEvalRow(e, dashboardUrl) {
  const sg = scoreToGrade(e.score);
  const { slugify } = require('./report-parser');
  const { getState, getStateMeta } = require('./state-manager');
  const slug = slugify(e.company, e.url, e.filename);
  const jobDetailUrl = `${dashboardUrl}/job/${slug}`;
  const stateInfo = getStateMeta(e.state);

  // Evaluation depth indicator (3 states: screen / partial / full)
  const depthDots = e.evalDepth === 'full' ? 
    '<span style="color:var(--success);font-size:10px;" title="Full A-G evaluation">[●●●]</span>' :
    e.evalDepth === 'partial' ? 
    '<span style="color:var(--warning);font-size:10px;" title="Partial analysis">[●●○]</span>' :
    '<span style="color:var(--text-dim);font-size:10px;" title="Quick screen">[●○○]</span>';

  return `
    <tr class="job-row" onclick="window.location='${jobDetailUrl}'">
        <td>
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="status-badge ${e.statusClass}">[${e.state.toUpperCase()}]</span>
                <span style="display:flex;align-items:center;" title="${e.evalDepth === 'full' ? 'Full A-G analysis' : e.evalDepth === 'partial' ? 'Partial analysis' : 'Quick screen'}">${depthDots}</span>
            </div>
        </td>
        <td><span class="score-block ${sg.class}">[ ${sg.grade} ] ${e.score?.toFixed(1) || '?'}</span></td>
        <td>
            <div style="font-weight:600;">${e.role}</div>
            <div style="font-size:12px;color:var(--text-dim);">@${e.company?.toUpperCase().replace(/\s+/g, '_')}</div>
        </td>
        <td style="font-size:12px;color:var(--text-dim);">${e.date || '--'}</td>
    </tr>
  `;
}

function renderPipelineRow(job, dashboardUrl) {
  const badgeClass = statusToBadge(job.status);
  const statusLabel = job.status?.toUpperCase() || 'PENDING';

  return `
    <tr class="job-row">
        <td><span class="status-badge ${badgeClass}">[${statusLabel}]</span></td>
        <td colspan="2">
            <div style="font-weight:600;">${job.role}</div>
            <div style="font-size:12px;color:var(--text-dim);">@${job.company?.toUpperCase().replace(/\s+/g, '_')}</div>
        </td>
        <td>
            <a href="${job.url}" target="_blank" class="btn" style="padding:6px 10px;font-size:11px;">VIEW_RAW</a>
        </td>
    </tr>
  `;
}

function renderDetails(e) {
  let html = '';

  // Block A: Role Basics
  if (e.blockA && Object.keys(e.blockA).length > 0) {
    const items = [];
    if (e.blockA.level) items.push(`LEVEL: ${e.blockA.level}`);
    if (e.blockA.salary || e.blockA.compensation) items.push(`COMP: ${e.blockA.salary || e.blockA.compensation}`);
    if (e.blockA.location) items.push(`LOCATION: ${e.blockA.location}`);
    if (e.blockA.stack) items.push(`STACK: ${e.blockA.stack}`);
    if (e.blockA.teamSize) items.push(`TEAM: ${e.blockA.teamSize}`);

    html += `
      <div class="detail-block">
        <div class="block-title">A) ROLE_SUMMARY</div>
        <div class="block-content">${items.map(i => `<div style="margin-bottom:4px;"><span class="prompt"></span> ${i}</div>`).join('')}</div>
      </div>
    `;
  }

  // Block B: Match Analysis
  if (e.blockB && (e.blockB.matches?.length || e.blockB.gaps?.length)) {
    const matches = e.blockB.matches?.map(m => `<li class="match">${m}</li>`).join('') || '';
    const gaps = e.blockB.gaps?.map(g => `<li class="gap">${g}</li>`).join('') || '';

    html += `
      <div class="detail-block success">
        <div class="block-title">B) CV_MATCH_SIGNAL</div>
        <div class="block-content">
          <ul>${matches}</ul>
          ${gaps ? `<div style="margin-top:8px;color:var(--error);font-size:12px;">GAPS:</div><ul>${gaps}</ul>` : ''}
        </div>
      </div>
    `;
  }

  // Block C: Strategy
  if (e.blockC && (e.blockC.targetLevel || e.blockC.strategy)) {
    html += `
      <div class="detail-block">
        <div class="block-title">C) LEVELING_PATH</div>
        <div class="block-content">
          ${e.blockC.targetLevel ? `<div><span class="prompt"></span> TARGET: ${e.blockC.targetLevel}</div>` : ''}
          ${e.blockC.strategy ? `<div style="margin-top:8px;">${e.blockC.strategy}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Block D: Compensation
  if (e.blockD && (e.blockD.notes || e.blockD.assessment)) {
    html += `
      <div class="detail-block warning">
        <div class="block-title">D) COMP_AND_DEMAND</div>
        <div class="block-content">${e.blockD.notes || e.blockD.assessment || ''}</div>
      </div>
    `;
  }

  // Block E: Hooks
  if (e.blockE && e.blockE.hooks?.length) {
    html += `
      <div class="detail-block">
        <div class="block-title">E) POSITIONING_HOOKS</div>
        <div class="block-content">
          <ul>${e.blockE.hooks.map(h => `<li>${h}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  // Block F: Stories
  if (e.blockF && e.blockF.stories?.length) {
    html += `
      <div class="detail-block">
        <div class="block-title">F) INTERVIEW_STORIES</div>
        <div class="block-content">
          <ul>${e.blockF.stories.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  }

  // Block G: Legitimacy
  if (e.blockG && e.blockG.legitimacy) {
    html += `
      <div class="detail-block ${e.blockG.legitimacy?.toLowerCase().includes('high') ? 'success' : 'warning'}">
        <div class="block-title">G) LEGITIMACY_CHECK</div>
        <div class="block-content">${e.blockG.legitimacy}</div>
      </div>
    `;
  }

  return html;
}

function renderPipelineView(jobs, dashboardUrl) {
  if (!jobs.pending || jobs.pending.length === 0) {
    return '<div class="section-title">RAW_PIPELINE</div><div class="empty-state">No pending jobs in pipeline</div>';
  }

  return `
    <div class="section-title">RAW_PIPELINE (${jobs.total} JOBS)</div>
    <table class="job-table">
        <thead>
            <tr>
                <th>STATUS</th>
                <th colspan="2">ROLE / COMPANY</th>
                <th>ACTION</th>
            </tr>
        </thead>
        <tbody>
            ${jobs.pending.map(job => renderPipelineRow(job, dashboardUrl)).join('')}
        </tbody>
    </table>
  `;
}

function renderEvalTable(evals, dashboardUrl) {
  if (evals.length === 0) {
    return '<div class="empty-state">No evaluations found</div>';
  }

  return `
    <table class="job-table">
        <thead>
            <tr>
                <th>STATUS</th>
                <th>SCORE</th>
                <th>ROLE / COMPANY</th>
                <th>TIMESTAMP</th>
            </tr>
        </thead>
        <tbody>
            ${evals.map(e => renderEvalRow(e, dashboardUrl)).join('')}
        </tbody>
    </table>
  `;
}

module.exports = {
  renderHeader,
  renderTopPicks,
  renderDetails,
  renderPipelineView,
  renderEvalTable,
  scoreToGrade
};
