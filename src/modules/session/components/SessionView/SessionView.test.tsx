// @vitest-environment jsdom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionView } from './SessionView';
import { selectTestAction } from '@/modules/session/actions';

vi.mock('@/modules/session/actions', () => ({
  selectTestAction: vi.fn(),
  endSessionAction: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('SessionView', () => {
  let startedAt: string;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    startedAt = new Date().toISOString();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('shows Poprawne badge after clicking Zleć on a correct test', async () => {
    vi.mocked(selectTestAction).mockResolvedValue({
      validatorResult: 'correct',
      category: 'critical',
    });

    render(
      <SessionView
        sessionId='test-session-id'
        timeLimitSeconds={3600}
        startedAt={startedAt}
        tests={[
          { id: 'test-eko', name: 'EKG 12-odprowadzeniowe' },
          { id: 'test-rtg', name: 'RTG klatki' },
        ]}
        classifications={{ 'test-eko': 'critical', 'test-rtg': 'acceptable' }}
        initialEvents={[]}
        sessionOutcome='in_progress'
      />,
    );

    const card = screen.getByLabelText('Przeciągnij: EKG 12-odprowadzeniowe');
    const button = within(card).getByRole('button', { name: 'Zleć' });
    await userEvent.setup({ delay: null }).click(button);

    const orderedCard = await screen.findByLabelText(
      'Zmień kolejność: EKG 12-odprowadzeniowe',
    );
    expect(within(orderedCard).getByText('Poprawne')).toBeInTheDocument();
  });
});
