import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { profileObjectToYaml, profileToObject } from '../lib/services/profile-schema';

const YAML = `# comment
candidate:
  full_name: Joel Kinman
  email: joel@example.com
  location: vancouver, bc, canada
target_roles:
  primary:
    - Customer Support
    - Customer Success
  archetypes:
    - name: Customer Support / Success
      fit: primary
compensation:
  target_range: ''
  currency: USD
location:
  country: canada
  city: vancouver
  work_modes:
    - remote
onboarding:
  completed: true
  completed_at: '2026-05-29T06:50:43.753Z'
`;

describe('profile-schema — profileToObject', () => {
  it('parses candidate, target roles, comp, location', () => {
    const obj = profileToObject(YAML);
    expect(obj.candidate.full_name).toBe('Joel Kinman');
    expect(obj.targetRoles).toEqual(['Customer Support', 'Customer Success']);
    expect(obj.compensation.currency).toBe('USD');
    expect(obj.location.city).toBe('vancouver');
    expect(obj.location.work_modes).toEqual(['remote']);
  });

  it('handles empty input', () => {
    const obj = profileToObject('');
    expect(obj.candidate.full_name).toBe('');
    expect(obj.targetRoles).toEqual([]);
  });
});

describe('profile-schema — save preserves unknown keys', () => {
  it('keeps archetypes and onboarding markers on round trip', () => {
    const obj = profileToObject(YAML);
    obj.candidate.email = 'new@example.com';
    obj.targetRoles = ['AI Engineer'];

    const out = profileObjectToYaml(obj, YAML);
    const reparsed = yaml.load(out);

    expect(reparsed.candidate.email).toBe('new@example.com');
    expect(reparsed.target_roles.primary).toEqual(['AI Engineer']);
    // untouched keys survive
    expect(reparsed.target_roles.archetypes).toEqual([{ name: 'Customer Support / Success', fit: 'primary' }]);
    expect(reparsed.onboarding.completed).toBe(true);
    expect(reparsed.onboarding.completed_at).toBe('2026-05-29T06:50:43.753Z');
  });
});
