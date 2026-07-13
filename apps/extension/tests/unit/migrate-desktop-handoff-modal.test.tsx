/**
 * MigrateDesktopHandoffModal — the extension's migration CTA target
 * (MIGRATION_STATUS.md S5 addendum: the funnel is extension → desktop):
 *   - connected: points at the desktop app's own "Migrate from another
 *     tool" entry and says progress mirrors here;
 *   - not connected: the desktop install pitch;
 *   - never renders the desktop modal's scan affordance — the ladder's
 *     RPCs don't answer on this host.
 */

import MigrateDesktopHandoffModal from '@openheaders/ui/workbench/components/import/MigrateDesktopHandoffModal';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('MigrateDesktopHandoffModal', () => {
  it('routes a connected desktop to its own migration entry', () => {
    render(<MigrateDesktopHandoffModal open onClose={() => {}} connected />);
    expect(screen.getByText('Your desktop app is connected')).toBeTruthy();
    expect(screen.getByText(/choose “Migrate from another tool”/)).toBeTruthy();
    expect(screen.getByText(/progress appears here in the corner/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Detect and import data' })).toBeNull();
  });

  it('pitches the desktop install when not connected', () => {
    render(<MigrateDesktopHandoffModal open onClose={() => {}} connected={false} />);
    expect(screen.getByText('This needs the desktop app')).toBeTruthy();
    expect(screen.getByText(/Install the Open Headers desktop app/)).toBeTruthy();
    expect(screen.queryByText('Your desktop app is connected')).toBeNull();
  });

  it('renders nothing while closed', () => {
    render(<MigrateDesktopHandoffModal open={false} onClose={() => {}} connected />);
    expect(screen.queryByText('Migrate from another tool')).toBeNull();
  });
});
