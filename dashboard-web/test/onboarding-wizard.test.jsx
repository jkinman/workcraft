import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OnboardingWizard } from '../ui/onboarding/OnboardingWizard';

const OPTIONS = {
  workModes: ['remote', 'hybrid', 'onsite'],
  roleFocus: [{ id: 'software', label: 'Software Engineering' }],
  seniority: ['Senior']
};

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows client validation errors and skips the API when required fields are missing', async () => {
    render(<OnboardingWizard options={OPTIONS} initialAnswers={{ workModes: [], roleFocus: [] }} />);

    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/pick at least one work style/i)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits when validation passes', async () => {
    fetch.mockResolvedValue({
      json: async () => ({ success: true })
    });
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '/' });

    render(
      <OnboardingWizard
        options={OPTIONS}
        initialAnswers={{
          workModes: ['remote'],
          roleFocus: ['software'],
          location: { country: 'Canada' },
          fullName: 'Jordan Lee',
          email: 'jordan@example.com'
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /finish setup/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/onboarding', expect.objectContaining({ method: 'POST' }));
    });

    locationSpy.mockRestore();
  });
});
