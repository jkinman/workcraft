import { describe, expect, it } from 'vitest';
import stateManager from '../state-manager';
import stateService from '../lib/services/state-service';

const { parseFrontmatter, buildFrontmatter } = stateManager;
const { transitionReportContent } = stateService;

describe('state service', () => {
  it('round trips frontmatter history', () => {
    const frontmatter = buildFrontmatter('applied', [{ state: 'applied', date: '2026-05-25' }]);

    expect(parseFrontmatter(`${frontmatter}# Evaluation: Acme - Engineer`)).toEqual({
      state: 'applied',
      state_history: [{ state: 'applied', date: '2026-05-25' }]
    });
  });

  it('transitions report content through valid state changes', () => {
    const content = `${buildFrontmatter('evaluated', [{ state: 'evaluated', date: '2026-05-24' }])}# Evaluation: Acme - Engineer`;
    const result = transitionReportContent(content, 'applied', '2026-05-25');

    expect(result.success).toBe(true);
    expect(result.previous).toBe('evaluated');
    expect(result.state).toBe('applied');
    expect(result.content).toContain('state: applied');
    expect(result.history).toHaveLength(2);
  });

  it('rejects invalid transitions', () => {
    const content = `${buildFrontmatter('evaluated', [])}# Evaluation: Acme - Engineer`;
    const result = transitionReportContent(content, 'offer', '2026-05-25');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
  });
});
