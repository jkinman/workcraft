import { describe, expect, it } from 'vitest';
import {
  collectValidationErrors,
  normalizeAnswers,
  validateAnswers
} from '../lib/services/onboarding-validation';

describe('onboarding validation — shared client/server rules', () => {
  it('requires a work mode, a role, and a location', () => {
    expect(collectValidationErrors({})).toEqual([
      'Pick at least one work style (remote, hybrid, or on-site).',
      'Pick at least one role focus or add a keyword.',
      'Add your location (city or country).'
    ]);
  });

  it('requires a city for hybrid or on-site roles', () => {
    expect(
      collectValidationErrors({
        workModes: ['onsite'],
        roleFocus: ['software'],
        location: { country: 'Canada' }
      })
    ).toContain('Add your city for hybrid or on-site roles.');
  });

  it('accepts a complete remote answer set', () => {
    expect(
      collectValidationErrors({
        workModes: ['remote'],
        roleFocus: ['software'],
        location: { country: 'Canada' }
      })
    ).toEqual([]);
  });

  it('normalizes comma-separated custom keywords', () => {
    const answers = normalizeAnswers({
      workModes: ['remote'],
      roleFocus: ['software'],
      location: { country: 'Canada' },
      customKeywords: 'Founding Engineer, Founding Engineer'
    });
    expect(answers.customKeywords).toEqual(['Founding Engineer']);
    expect(() => validateAnswers(answers)).not.toThrow();
  });
});
