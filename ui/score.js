function scoreToGrade(score = 0) {
  if (score >= 4.5) return { grade: 'A', className: 'score-a' };
  if (score >= 4.0) return { grade: 'B', className: 'score-b' };
  if (score >= 3.5) return { grade: 'C', className: 'score-c' };
  if (score >= 3.0) return { grade: 'D', className: 'score-d' };
  return { grade: 'F', className: 'score-f' };
}

module.exports = { scoreToGrade };
