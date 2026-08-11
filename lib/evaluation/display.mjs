/**
 * Console display helpers for evaluator CLIs.
 */

/**
 * @param {import('../llm/prompt-assembly.mjs').EvaluationPromptInput & { budgetReport?: object }} assembled
 */
export function logBudgetReport(assembled) {
  const budgetReport = assembled.budgetReport;
  if (!budgetReport) return;

  if (budgetReport.compressed) {
    console.log(`📊  Token budget: ${budgetReport.beforeTokens} → ${budgetReport.afterTokens} tokens (saved ${budgetReport.beforeTokens - budgetReport.afterTokens})`);
    console.log(`    Trimmed sections: ${budgetReport.removed.join(', ')}`);
    if (budgetReport.overBudget) {
      console.log(`    ⚠️  Still ${budgetReport.afterTokens - budgetReport.budget} tokens over budget after compression`);
    }
  } else if (budgetReport.overBudget) {
    console.log(`⚠️  Token budget: ${budgetReport.totalTokens} tokens exceeds ${budgetReport.budget} limit by ${budgetReport.totalTokens - budgetReport.budget}`);
  } else if (budgetReport.totalTokens != null) {
    console.log(`📊  Token budget: ${budgetReport.totalTokens} tokens (within ${budgetReport.budget} limit)`);
  }
}

/**
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.evaluationText
 */
export function printEvaluationHeader({ title, evaluationText }) {
  console.log('\n' + '═'.repeat(66));
  console.log(`  CAREER-OPS EVALUATION — powered by ${title}`);
  console.log('═'.repeat(66) + '\n');
  console.log(evaluationText);
}

/**
 * @param {import('./score-summary.mjs').ScoreSummary} summary
 */
export function printEvaluationFooter(summary) {
  console.log('\n' + '─'.repeat(66));
  console.log(`  Score: ${summary.score}/5  |  Archetype: ${summary.archetype}  |  Legitimacy: ${summary.legitimacy}`);
  console.log('─'.repeat(66) + '\n');
}

/**
 * @param {import('./persist.mjs').persistEvaluationReport extends Function ? Awaited<ReturnType<import('./persist.mjs').persistEvaluationReport>> : never} persistResult
 */
export function logPersistResult(persistResult, { trackerMode = 'hint' } = {}) {
  if (persistResult.saved) {
    console.log(`\n✅  Report saved: reports/${persistResult.filename}`);
    if (trackerMode === 'hint' && persistResult.trackerHint) {
      console.log(`\n📊  Tracker entry (add to data/applications.md):`);
      console.log(`    ${persistResult.trackerHint}`);
    }
    if (persistResult.trackerPath) {
      const rel = persistResult.trackerPath.split('/batch/').pop();
      console.log(`📊  Tracker addition saved: batch/tracker-additions/${rel ?? persistResult.trackerPath}`);
    }
    if (persistResult.mergeOutput) {
      console.log(persistResult.mergeOutput);
      console.log('📊  Tracker merged into data/applications.md.');
    }
    if (persistResult.mergeError) {
      console.warn(`⚠️   Report saved, but could not merge tracker addition into data/applications.md: ${persistResult.mergeError}`);
    }
  } else if (persistResult.error) {
    console.warn(`⚠️   Could not save report: ${persistResult.error}`);
  }
  if (persistResult.releaseError) {
    console.warn(`⚠️   Could not release report reservation: ${persistResult.releaseError}`);
  }
}
