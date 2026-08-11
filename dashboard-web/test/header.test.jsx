import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../ui/Header';

vi.mock('../ui/AuthControls', () => ({
  AuthControls: () => <div data-testid="auth-controls">auth</div>
}));

describe('Header', () => {
  it('renders navigation, stats, and tenant context', () => {
    render(<Header activeView="ranked" tenantId="local-dev" stats={{ dream: 1, strong: 2, good: 3, total: 6 }} />);

    expect(screen.getByText('~/career-ops/dashboard')).toBeTruthy();
    expect(screen.getByText('tenant: local-dev')).toBeTruthy();
    expect(screen.getByText('analytics /eval')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('highlights manage navigation and hides tenant pill when auth is enabled', () => {
    render(<Header activeView="manage" tenantId="user-123" showAuth stats={{ dream: 0, strong: 0, good: 0, total: 0 }} />);

    expect(screen.getByRole('link', { name: /tune \/manage/i }).className).toContain('active');
    expect(screen.queryByText(/tenant:/)).toBeNull();
    expect(screen.getByTestId('auth-controls')).toBeTruthy();
  });

  it('shows tenant pill in local mode without auth', () => {
    render(<Header activeView="scan" tenantId="local-dev" />);

    expect(screen.getByText('tenant: local-dev')).toBeTruthy();
    expect(screen.queryByTestId('auth-controls')).toBeNull();
  });
});
