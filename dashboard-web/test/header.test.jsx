import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../ui/Header';

describe('Header', () => {
  it('renders navigation, stats, and tenant context', () => {
    render(<Header activeView="ranked" tenantId="local-dev" stats={{ dream: 1, strong: 2, good: 3, total: 6 }} />);

    expect(screen.getByText('~/career-ops/dashboard')).toBeTruthy();
    expect(screen.getByText('tenant: local-dev')).toBeTruthy();
    expect(screen.getByText('analytics /eval')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });
});
