/**
 * ConsoleView — the Console tool window. Covers the rendered list (levels +
 * filters) and the never-silent empty / disabled surfaces keyed off the
 * inspected tab's CDP scope.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScope, setCdpEnabledSpy } = vi.hoisted(() => ({
  mockScope: { hasCdpCapability: true, cdpEnabled: true, cdpOwned: true },
  setCdpEnabledSpy: vi.fn(),
}));

vi.mock('@openheaders/ui/panel/data/use-inspected-tab-cdp', () => ({
  useInspectedTabCdp: () => mockScope,
}));

vi.mock('@openheaders/ui/workbench/settings/hooks', () => ({
  useSetting: () => [false, setCdpEnabledSpy],
}));

import { ConsoleView } from '@openheaders/ui/panel/components/ConsoleView';

function entry(text: string, over: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text }],
    timestamp: 1000,
    ...over,
  };
}

function renderView(entries: readonly ConsoleEntry[]) {
  return render(<ConsoleView entries={entries} onClear={vi.fn()} onHide={vi.fn()} />);
}

beforeEach(() => {
  mockScope.hasCdpCapability = true;
  mockScope.cdpEnabled = true;
  mockScope.cdpOwned = true;
  setCdpEnabledSpy.mockClear();
});

afterEach(cleanup);

describe('ConsoleView list', () => {
  const entries = [
    entry('a plain log from openheaders.io'),
    entry('a warning', { level: 'warning' }),
    entry('boom', { level: 'error', source: 'exception', url: 'https://openheaders.io/app.js', lineNumber: 41 }),
  ];

  it('renders one row per entry with its level + message', () => {
    const { container } = renderView(entries);
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(3);
    expect(container.querySelector('.dt-console-row[data-level="error"]')?.textContent).toContain('boom');
  });

  it('renders the source location 1-based', () => {
    const { container } = renderView(entries);
    expect(container.querySelector('.dt-console-loc')?.textContent).toBe('app.js:42');
  });

  it('filters to errors only', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Errors'));
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].getAttribute('data-level')).toBe('error');
  });

  it('warnings filter keeps warnings and errors', () => {
    const { container } = renderView(entries);
    fireEvent.click(screen.getByText('Warnings'));
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(2);
  });

  it('text filter narrows by message content', () => {
    const { container } = renderView(entries);
    fireEvent.change(container.querySelector('.dt-filter-input') as HTMLInputElement, {
      target: { value: 'boom' },
    });
    const rows = container.querySelectorAll('.dt-console-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('boom');
  });

  it('shows a no-match notice when the filter excludes everything', () => {
    const { container } = renderView(entries);
    fireEvent.change(container.querySelector('.dt-filter-input') as HTMLInputElement, {
      target: { value: 'nothing-matches' },
    });
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(0);
    expect(container.textContent).toContain('No console entries match your filter');
  });
});

describe('ConsoleView never-silent surfaces', () => {
  it('in scope but empty — capturing, waiting for output', () => {
    const { container } = renderView([]);
    expect(container.textContent).toContain('No console output yet');
  });

  it('host cannot do CDP — capture unavailable', () => {
    mockScope.hasCdpCapability = false;
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('Console capture needs Debug mode');
  });

  it('Debug mode off — offers to enable it', () => {
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('Enable Debug mode to view console logs');
    fireEvent.click(screen.getByRole('button', { name: 'Enable Debug mode' }));
    expect(setCdpEnabledSpy).toHaveBeenCalledWith(true);
  });

  it('Debug mode on but tab out of scope — steer to Debug mode', () => {
    mockScope.cdpOwned = false;
    const { container } = renderView([]);
    expect(container.textContent).toContain('This tab is outside Debug mode');
  });

  it('capture stopped mid-session — keeps the captured entries under a banner', () => {
    mockScope.cdpEnabled = false;
    mockScope.cdpOwned = false;
    const { container } = renderView([entry('captured before stop')]);
    expect(container.querySelector('.dt-console-banner')?.textContent).toContain('Debug mode is off');
    // The already-captured entry stays readable rather than vanishing.
    expect(container.querySelectorAll('.dt-console-row')).toHaveLength(1);
  });
});
