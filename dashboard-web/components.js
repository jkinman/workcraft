// components.js - HTML component builders for the dashboard

function renderHeader(stats) {
  const { dream, strong, good, total } = stats;
  
  return `
    <div class="header">
        <div class="header-top">
            <h1>🎯 Career-Ops Dashboard</h1>
            <div class="nav-buttons">
                <a href="/?view=ranked" class="nav-btn ${stats.view === 'ranked' ? 'active' : ''}">Ranked</a>
                <a href="/?view=pipeline" class="nav-btn ${stats.view === 'pipeline' ? 'active' : ''}">Pipeline</a>
                <a href="/queue" class="nav-btn queue">+ Queue Job</a>
            </div>
        </div>
        <div class="stats">
            <div class="stat">
                <span class="stat-value" style="color: #3fb950;">${dream}</span>
                <span>Dream</span>
            </div>
            <div class="stat">
                <span class="stat-value" style="color: #f0883e;">${strong}</span>
                <span>Strong</span>
            </div>
            <div class="stat">
                <span class="stat-value" style="color: #58a6ff;">${good}</span>
                <span>Good</span>
            </div>
            <div class="stat">
                <span class="stat-value">${total}</span>
                <span>Total Evaluated</span>
            </div>
        </div>
    </div>
  `;
}

function renderTopPicks(jobs) {
  const dreamJobs = jobs.filter(j => j.score >= 4.5).slice(0, 3);
  
  if (dreamJobs.length === 0) {
    return '';
  }
  
  return `
    <div class="top-picks">
        <h2>⭐ Top Picks (Apply Now)</h2>
        <div class="top-picks-list">
            ${dreamJobs.map(job => `
                <div class="top-pick-item">
                    <div class="top-pick-info">
                        <div class="top-pick-company">${job.company}</div>
                        <div class="top-pick-role">${job.role}</div>
                    </div>
                    <div class="top-pick-score">${job.score}/5</div>
                </div>
            `).join('')}
        </div>
    </div>
  `;
}

function renderEvalCard(e, key) {
  const verdictClass = e.verdict.includes('APPLY NOW') ? 'verdict-apply' : 
                       e.verdict.includes('blocked') || e.verdict.includes('80hr') ? 'verdict-blocked' :
                       e.verdict.includes('Consider') ? 'verdict-consider' : 'verdict-decent';
  
  return `
    <div class="eval-card">
        <div class="eval-header">
            <div>
                <div class="eval-rank">#${e.rank}</div>
                <div class="eval-company">${e.company}</div>
                <div class="eval-role">${e.role}</div>
                ${e.archetype ? `<div class="eval-archetype">${e.archetype}</div>` : ''}
            </div>
            <div class="eval-score">
                <div class="score-value" style="color: ${e.verdict.includes('APPLY NOW') ? '#3fb950' : e.verdict.includes('blocked') ? '#f85149' : '#f0883e'}">${e.score}/5</div>
                <div class="score-label">${e.scoreLabel}</div>
            </div>
        </div>
        
        <div class="eval-meta">
            <div class="meta-item">
                <span class="meta-label">Comp:</span>
                <span class="meta-value">${e.comp}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Location:</span>
                <span class="meta-value">${e.location}</span>
            </div>
        </div>
        
        <div class="eval-footer">
            <div class="eval-verdict ${verdictClass}">${e.verdict}</div>
            <div>
                <a href="${e.url}" target="_blank" class="btn btn-view">View Job</a>
                <button onclick="toggleDetails('details-${key}')" class="btn btn-details">Full A-G</button>
                <button onclick="generatePDF('${e.company}', '${e.role}', '${e.archetype || ''}')" class="btn btn-generate">Generate CV</button>
                <button onclick="generateCoverLetter('${e.company}', '${e.role}', '${e.archetype || ''}')" class="btn btn-cover">Cover Letter</button>
            </div>
        </div>
        <div id="pdf-status-${key}" class="pdf-status"></div>
        <div id="cover-status-${key}" class="pdf-status"></div>
        
        <div id="details-${key}" class="details-content">
            ${renderDetails(e)}
        </div>
    </div>
  `;
}

function renderDetails(e) {
  let detailsHtml = '<div class="details-grid">';
  
  // Block A: Role Basics
  if (e.blockA) {
    const aContent = [];
    if (e.blockA.level) aContent.push(`Level: ${e.blockA.level}`);
    if (e.blockA.salary) aContent.push(`Comp: ${e.blockA.salary}`);
    if (e.blockA.location) aContent.push(`Location: ${e.blockA.location}`);
    if (e.blockA.stack) aContent.push(`Stack: ${e.blockA.stack}`);
    
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">A - Role Basics</div>
        <div class="block-value">${aContent.join('<br>')}</div>
      </div>
    `;
  }
  
  // Block B: Match Analysis
  if (e.blockB) {
    const matches = e.blockB.matches?.slice(0, 3).join('<br>• ') || '';
    const gaps = e.blockB.gaps?.slice(0, 2).join('<br>• ') || '';
    
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">B - Match Analysis</div>
        <div class="block-value">
          <strong>Matches:</strong><br>• ${matches}<br><br>
          <strong>Gaps:</strong><br>• ${gaps}
        </div>
      </div>
    `;
  }
  
  // Block C: Strategy
  if (e.blockC) {
    const cContent = [];
    if (e.blockC.targetLevel) cContent.push(`Target: ${e.blockC.targetLevel}`);
    if (e.blockC.strategy) cContent.push(`Strategy: ${e.blockC.strategy}`);
    
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">C - Application Strategy</div>
        <div class="block-value">${cContent.join('<br>')}</div>
      </div>
    `;
  }
  
  // Block D: Compensation
  if (e.blockD) {
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">D - Compensation</div>
        <div class="block-value">${e.blockD.notes || 'N/A'}</div>
      </div>
    `;
  }
  
  // Block E: Hooks & Positioning
  if (e.blockE) {
    const hooks = e.blockE.hooks?.slice(0, 2).join('<br>• ') || '';
    const blocker = e.blockE.blocker ? `<br><br><strong>Blocker:</strong> ${e.blockE.blocker}` : '';
    
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">E - Positioning</div>
        <div class="block-value">• ${hooks}${blocker}</div>
      </div>
    `;
  }
  
  // Block F: Interview Stories
  if (e.blockF) {
    const stories = e.blockF.stories?.slice(0, 3).join('<br>• ') || '';
    
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">F - Interview Stories</div>
        <div class="block-value">• ${stories}</div>
      </div>
    `;
  }
  
  // Block G: Legitimacy
  if (e.blockG) {
    detailsHtml += `
      <div class="detail-block">
        <div class="block-title">G - Legitimacy Check</div>
        <div class="block-value">${e.blockG.legitimacy || 'N/A'}</div>
      </div>
    `;
  }
  
  detailsHtml += '</div>';
  return detailsHtml;
}

function renderPipelineView(jobs) {
  if (jobs.pending.length === 0) {
    return '<div class="section-title">Raw Pipeline</div><div class="empty-state">No pending jobs in pipeline</div>';
  }
  
  return `
    <div class="section-title">Raw Pipeline (${jobs.total} jobs)</div>
    <div class="job-list">
        ${jobs.pending.map(job => `
            <div class="job-item">
                <div>
                    <div class="job-company">${job.company}</div>
                    <div class="job-role">${job.role}</div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span class="status-badge status-${job.status}">${job.status}</span>
                    <a href="${job.url}" target="_blank" class="btn btn-view">View</a>
                    <button onclick="queueForEval('${job.url}', '${job.company}', '${job.role}')" class="btn btn-eval">Evaluate</button>
                </div>
            </div>
        `).join('')}
    </div>
  `;
}

module.exports = { 
  renderHeader, 
  renderTopPicks, 
  renderEvalCard, 
  renderDetails,
  renderPipelineView 
};
