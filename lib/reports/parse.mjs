
import { parseReportFrontmatter, stateBadgeClass } from './frontmatter.mjs';

function populateBlockA(blockA, key, val) {
  if (key.includes('level') || key.includes('seniority')) blockA.level = val;
  else if (key.includes('salary') || key.includes('comp')) blockA.salary = val;
  else if (key.includes('location') || key.includes('remote')) blockA.location = val;
  else if (key.includes('stack') || key.includes('tech')) blockA.stack = val;
  else if (key.includes('reportsto')) blockA.reportsTo = val;
  else if (key.includes('travel')) blockA.travel = val;
  else if (key.includes('focus')) blockA.focus = val;
  else if (key.includes('archetype') || key.includes('arquetipo')) blockA.archetype = val;
  else if (key.includes('domain')) blockA.domain = val;
  else if (key.includes('function')) blockA.function = val;
  else if (key.includes('compensation')) blockA.compensation = val;
  else if (key.includes('teamsize') || key.includes('team')) blockA.teamSize = val;
}

function parseCvMatchTable(tableLines, blockB) {
  for (const line of tableLines) {
    const cells = line.split('|').map(c => c.trim()).filter(c => c && c !== '---');
    if (cells.length >= 3 && !cells[0].match(/^(JD Requirement|Requirement|Requisito)/i)) {
      const match = cells[1];
      const evidence = cells[2];
      if (match && match.includes('✅')) {
        blockB.matches.push(`${cells[0]}: ${evidence}`);
      } else if (match && (match.includes('❌') || match.includes('⚠️'))) {
        blockB.gaps.push(`${cells[0]}: ${evidence}`);
      }
    }
  }
}

export function parseReport(content, filename) {
  const lines = content.split('\n');
  const evalObj = {
    filename,
    blockA: {}, blockB: { matches: [], gaps: [] },
    blockC: {}, blockD: {}, blockE: { hooks: [] },
    blockF: { stories: [] }, blockG: {},
    state: 'evaluated', state_history: []
  };

  // Parse frontmatter
  
  const fm = parseReportFrontmatter(content);
  evalObj.state = fm.state;
  evalObj.state_history = fm.state_history;

  // Add the css class directly to the object
  
  evalObj.statusClass = stateBadgeClass(fm.state);


  let currentBlock = null;
  let inTable = false;
  let tableBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Title line variants
    // "# Evaluation: Company — Role" or "# Evaluation Report: Company — Role" or "# Evaluation: Company — Role"
    // or "# Job Evaluation: Company — Role"
    if (line.match(/^#\s*(Evaluation|Evaluation|Evaluation Report|Job Evaluation):\s*(.+)/i)) {
      const match = line.match(/^#\s*(?:Evaluation|Evaluation|Evaluation Report|Job Evaluation):\s*(.+?)\s*[—\-–]\s*(.+)$/i);
      if (match) {
        evalObj.company = match[1].trim();
        evalObj.role = match[2].trim();
      }
      continue;
    }

    // Metadata lines — handle BOTH formats:
    // New: **Date:** value  OR  Old: **Fecha:** value (colon inside stars)
    const metaMatch = line.match(/^\*\*([^:]+):\*\*\s*(.+)/);
    if (metaMatch) {
      const key = metaMatch[1].trim().toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'date' || key === 'fecha') evalObj.date = val;
      else if (key === 'url') evalObj.url = val;
      else if (key === 'archetype' || key === 'arquetipo') evalObj.archetype = val;
      else if (key === 'score' || key === 'puntuación' || key === 'puntuacion') {
        const scoreMatch = val.match(/([0-9.]+)/);
        if (scoreMatch) evalObj.score = parseFloat(scoreMatch[1]);
      }
      else if (key === 'legitimacy') evalObj.legitimacy = val;
      continue;
    }

    // Section headers — handle BOTH formats:
    // "## Block A: Role Summary" (old) or "## A) Role Summary" (new) or "## A) Resumen del Rol" (Spanish)
    const sectionMatch = line.match(/^##\s*(?:Block\s+)?([A-H])[):\s]\s*(.+)/i);
    if (sectionMatch) {
      currentBlock = sectionMatch[1].toUpperCase();
      inTable = false;
      tableBuffer = [];
      continue;
    }

    // Table parsing — MUST come after section detection but BEFORE section-specific handlers
    if (line.startsWith('|') && currentBlock) {
      // For Block A, parse table rows directly (they're key-value pairs)
      if (currentBlock === 'A') {
        const tableRow = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/);
        if (tableRow) {
          const key = tableRow[1].toLowerCase().replace(/\s+/g, '');
          const val = tableRow[2].trim();
          populateBlockA(evalObj.blockA, key, val);
        }
        continue;
      }
      // For Block B, buffer the table for later parsing
      if (currentBlock === 'B') {
        inTable = true;
        tableBuffer.push(line);
        continue;
      }
      // For Block E, parse personalization table rows
      if (currentBlock === 'E') {
        const tableRow = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (tableRow) {
          const section = tableRow[2].trim();
          const change = tableRow[3].trim();
          evalObj.blockE.hooks.push(`${section}: ${change}`);
        }
        continue;
      }
      // For Block F, parse STAR+R story table rows
      if (currentBlock === 'F') {
        const tableRow = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (tableRow) {
          evalObj.blockF.stories.push(`${tableRow[1].trim()}: ${tableRow[2].trim()}`);
        }
        continue;
      }
      // For Block G, parse legitimacy signal table rows
      if (currentBlock === 'G') {
        const tableRow = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
        if (tableRow && !tableRow[1].includes('Signal') && !tableRow[1].includes('---')) {
          const signal = tableRow[1].trim();
          const finding = tableRow[2].trim();
          const weight = tableRow[3].trim();
          evalObj.blockG.legitimacy = (evalObj.blockG.legitimacy || '') + ` • ${signal}: ${finding} [${weight}]`;
        }
        continue;
      }
      continue;
    }

    if (inTable && !line.startsWith('|') && currentBlock === 'B') {
      parseCvMatchTable(tableBuffer, evalObj.blockB);
      inTable = false;
      tableBuffer = [];
      continue;
    }

    // Block A: Role Basics
    if (currentBlock === 'A') {
      // Try table row format: | **Key** | Value |
      const tableRow = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|/);
      if (tableRow) {
        const key = tableRow[1].toLowerCase().replace(/\s+/g, '');
        const val = tableRow[2].trim();
        populateBlockA(evalObj.blockA, key, val);
        continue;
      }
      // Try inline format: **Key:** Value
      const inline = line.match(/^\*\*(.+?)\*\*:\s*(.+)/);
      if (inline) {
        const key = inline[1].toLowerCase().replace(/\s+/g, '');
        const val = inline[2].trim();
        populateBlockA(evalObj.blockA, key, val);
        continue;
      }
    }

    // Block B: Match/Gap lists
    if (currentBlock === 'B') {
      if (line.match(/^[-*]\s*\*\*(Match|Strong|Moderate|Adequate|Weak)/i)) {
        const matchText = line.replace(/^[-*]\s*\*\*.*?\*\*:\s*/, '').trim();
        if (matchText) evalObj.blockB.matches.push(matchText);
      }
      if (line.match(/^[-*]\s*\*\*(Gap|Minor|Major)/i)) {
        const gapText = line.replace(/^[-*]\s*\*\*.*?\*\*:\s*/, '').trim();
        if (gapText) evalObj.blockB.gaps.push(gapText);
      }
      continue;
    }

    // Block C: Strategy
    if (currentBlock === 'C') {
      const targetMatch = line.match(/^\*\*Target Level\*\*:\s*(.+)/i);
      if (targetMatch) evalObj.blockC.targetLevel = targetMatch[1].trim();
      const strategyMatch = line.match(/^\*\*Strategy\*\*:\s*(.+)/i);
      if (strategyMatch) evalObj.blockC.strategy = strategyMatch[1].trim();
      // Also capture "Sell Senior Without Lying" and "If Downleveled" plan headers
      if (line.match(/^###\s*"?(.+?)"?\s*Plan/i)) {
        evalObj.blockC.strategy = (evalObj.blockC.strategy || '') + ' | ' + line.replace(/^###\s*/, '').trim();
      }
      // Capture numbered list items as strategy bullets
      if (line.match(/^\d+\.\s+\*\*/)) {
        const strategyText = line.replace(/^\d+\.\s+/, '').trim();
        evalObj.blockC.strategy = (evalObj.blockC.strategy || '') + ' • ' + strategyText;
      }
      continue;
    }

    // Block E: Hooks / Personalization
    if (currentBlock === 'E') {
      // Table rows with personalization items
      const tableRow = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
      if (tableRow) {
        const section = tableRow[2].trim();
        const change = tableRow[3].trim();
        evalObj.blockE.hooks.push(`${section}: ${change}`);
      }
      // Simple list items
      if ((line.startsWith('- ') || line.startsWith('* ')) && line.length > 10) {
        evalObj.blockE.hooks.push(line.replace(/^[-*]\s+/, '').trim());
      }
      const blockerMatch = line.match(/^\*\*Blocker\*\*:\s*(.+)/i);
      if (blockerMatch) evalObj.blockE.blocker = blockerMatch[1].trim();
      continue;
    }

    // Block F: Stories / Interview Prep
    if (currentBlock === 'F') {
      // Table rows from STAR+R stories
      const tableRow = line.match(/^\|\s*\d+\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
      if (tableRow) {
        evalObj.blockF.stories.push(`${tableRow[1].trim()}: ${tableRow[2].trim()}`);
      }
      // Simple list items
      if ((line.startsWith('- ') || line.startsWith('* ')) && line.length > 10) {
        evalObj.blockF.stories.push(line.replace(/^[-*]\s+/, '').trim());
      }
      // "Present:" / "How to frame:" lines
      if (line.match(/^(Present|How to frame|Recommended|Red-Flag)/i)) {
        evalObj.blockF.stories.push(line.trim());
      }
      continue;
    }

    // Block G: Legitimacy
    if (currentBlock === 'G') {
      const assessMatch = line.match(/^\*\*Assessment[:\*]*\s*(.+)/i);
      if (assessMatch) evalObj.blockG.legitimacy = assessMatch[1].trim();
      // Table rows from legitimacy signals
      const tableRow = line.match(/^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
      if (tableRow && !tableRow[1].includes('Signal') && !tableRow[1].includes('---')) {
        const signal = tableRow[1].trim();
        const finding = tableRow[2].trim();
        const weight = tableRow[3].trim();
        evalObj.blockG.legitimacy = (evalObj.blockG.legitimacy || '') + ` • ${signal}: ${finding} [${weight}]`;
      }
      if (line.startsWith('- ') && line.includes('Confidence')) {
        evalObj.blockG.legitimacy = line.replace('- ', '').trim();
      }
      continue;
    }

    // Score in section header: "## Score: 4.3 / 5.0" or "## Block A — Role-Profile Fit (Score: 4.8/5)"
    // or "## F. Score" followed by "**4.6 / 5.0**"
    const scoreSectionMatch = line.match(/^##\s*Score:\s*([0-9.]+)/i) ||
                               line.match(/\(Score:\s*([0-9.]+)\/5\)/i);
    if (scoreSectionMatch && !evalObj.score) {
      evalObj.score = parseFloat(scoreSectionMatch[1]);
      continue;
    }

    // Bold score line: "**4.6 / 5.0**" or "**Score: 4.6/5**"
    const boldScoreMatch = line.match(/^\*\*([0-9.]+)\s*\/\s*5\.0?\*\*$/) ||
                          line.match(/^\*\*Score:\s*([0-9.]+)\/5\*\*$/i);
    if (boldScoreMatch && !evalObj.score) {
      evalObj.score = parseFloat(boldScoreMatch[1]);
      continue;
    }

    // Final Score line: "### **Final Score: 3.8/5**"
    const finalScoreMatch = line.match(/Final Score:\s*([0-9.]+)/i);
    if (finalScoreMatch) {
      evalObj.score = parseFloat(finalScoreMatch[1]);
      continue;
    }

    // Final recommendation / verdict
    if (line.match(/^##\s*(Final Recommendation|Verdict|Recommendation|Recomendación)/i)) {
      currentBlock = 'VERDICT';
      continue;
    }
    if (currentBlock === 'VERDICT' && line.startsWith('**')) {
      evalObj.verdict = line.replace(/\*\*/g, '').trim();
    }
  }

  // Derive missing fields
  if (!evalObj.verdict) {
    if (evalObj.score >= 4.5) evalObj.verdict = 'APPLY NOW';
    else if (evalObj.score >= 4.0) evalObj.verdict = 'STRONG MATCH';
    else if (evalObj.score >= 3.5) evalObj.verdict = 'CONSIDER';
    else evalObj.verdict = 'SKIP';
  }

  if (!evalObj.scoreLabel) {
    if (evalObj.score >= 4.5) evalObj.scoreLabel = 'DREAM ROLE';
    else if (evalObj.score >= 4.0) evalObj.scoreLabel = 'STRONG MATCH';
    else if (evalObj.score >= 3.5) evalObj.scoreLabel = 'GOOD FIT';
    else evalObj.scoreLabel = 'WEAK MATCH';
  }

  if (!evalObj.comp) {
    // Try blockA first, then fall back to body text extraction
    evalObj.comp = evalObj.blockA?.salary || evalObj.blockA?.compensation || evalObj.blockA?.comp;
    if (!evalObj.comp || evalObj.comp === 'Not specified') {
      // Extract from body text: look for compensation/salary patterns
      const compMatch = content.match(/\*\*Compensation\*\*[:\s]*([^\n]+)/i) ||
                         content.match(/\*\*Salary\*\*[:\s]*([^\n]+)/i) ||
                         content.match(/\|\s*\*\*Compensation\*\*\s*\|\s*([^|]+)\s*\|/);
      if (compMatch) evalObj.comp = compMatch[1].trim();
    }
    if (!evalObj.comp) evalObj.comp = 'Not specified';
  }

  if (!evalObj.location) {
    evalObj.location = evalObj.blockA?.location || evalObj.blockA?.remote;
    if (!evalObj.location || evalObj.location === 'Not specified') {
      // Extract from body text: look for location/remote patterns
      const locMatch = content.match(/\*\*Location\*\*[:\s]*([^\n]+)/i) ||
                        content.match(/\*\*Remote\*\*[:\s]*([^\n]+)/i) ||
                        content.match(/\|\s*\*\*Location\*\*\s*\|\s*([^|]+)\s*\|/);
      if (locMatch) evalObj.location = locMatch[1].trim();
    }
    if (!evalObj.location) evalObj.location = 'Not specified';
  }

  // Derive evaluation depth based on A-G block presence
  const hasBlockA = Object.keys(evalObj.blockA).length > 0;
  const hasBlockB = evalObj.blockB.matches.length > 0 || evalObj.blockB.gaps.length > 0;
  const hasBlockC = evalObj.blockC.targetLevel || evalObj.blockC.strategy;
  const hasBlockD = evalObj.blockD.notes || evalObj.blockD.assessment;
  const hasBlockE = evalObj.blockE.hooks.length > 0;
  const hasBlockF = evalObj.blockF.stories.length > 0;
  const hasBlockG = evalObj.blockG.legitimacy;

  const agBlocksPresent = [hasBlockA, hasBlockB, hasBlockC, hasBlockD, hasBlockE, hasBlockF, hasBlockG].filter(Boolean).length;
  
  if (agBlocksPresent >= 5) {
    evalObj.evalDepth = 'full';
    evalObj.evalDepthLabel = 'FULL A-G';
  } else if (agBlocksPresent >= 2) {
    evalObj.evalDepth = 'partial';
    evalObj.evalDepthLabel = 'PARTIAL';
  } else {
    evalObj.evalDepth = 'screen';
    evalObj.evalDepthLabel = 'SCREEN';
  }

  if (!evalObj.url) {
    evalObj.url = '#';
  }

  return evalObj;
}

export { populateBlockA, parseCvMatchTable };
