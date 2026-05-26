// migrate-states.js
const fs = require('fs');
const path = require('path');
const { STATES, buildFrontmatter, parseFrontmatter } = require('./state-manager');

const reportsDir = path.join(__dirname, '..', 'reports');
const applicationsMdPath = path.join(__dirname, '..', 'data', 'applications.md');

// 1. Update all reports to have frontmatter
const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  const reportPath = path.join(reportsDir, file);
  const content = fs.readFileSync(reportPath, 'utf8');
  const fm = parseFrontmatter(content);

  if (fm.state === STATES.EVALUATED && fm.state_history.length === 0) {
    const newHistory = [{ state: STATES.EVALUATED, date: new Date().toISOString().split('T')[0] }];
    const newFrontmatter = buildFrontmatter(STATES.EVALUATED, newHistory);
    let newContent;
    if (content.startsWith('---')) {
        newContent = content.replace(/^---\\n[\\s\\S]*?\\n---\\n\\n?/, newFrontmatter);
    } else {
        newContent = newFrontmatter + content;
    }
    fs.writeFileSync(reportPath, newContent);
    console.log(`Updated frontmatter for ${file}`);
  }
}

// 2. Update applications.md with varied states for demo
let appContent = fs.readFileSync(applicationsMdPath, 'utf8');
const lines = appContent.split('\\n');
const newLines = lines.map(line => {
    if (line.includes('Gumloop') && line.includes('024')) return line.replace('Evaluated', 'Applied');
    if (line.includes('Gumloop') && line.includes('023')) return line.replace('Evaluated', 'Interview');
    if (line.includes('WorkOS') && line.includes('018')) return line.replace('Evaluated', 'Offer');
    if (line.includes('Sierra') && line.includes('016')) return line.replace('Evaluated', 'Rejected');
    if (line.includes('Vercel') && line.includes('019')) return line.replace('Evaluated', 'Applied');
    return line;
});
fs.writeFileSync(applicationsMdPath, newLines.join('\\n'));
console.log('Updated applications.md with new states.');
