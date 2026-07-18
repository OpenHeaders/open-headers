// @vitest-environment jsdom
/**
 * useValueViewAction — the read-only escalation ladder on the panel's
 * row surfaces (headers/cookies/payload view icon). Pins:
 *   - no detected value ⇒ no view props, no glance, no modal;
 *   - the eye opens the GLANCE popover first (compact decoded preview,
 *     per-type kicker), never a modal directly;
 *   - "Open as modal" escalates to the shared EncodedValueModal
 *     readOnly (decoded pane locked, Close-only footer, no Save);
 *   - "Open in new tab" appears only when a tab opener is provided,
 *     and hands it the detected hit + source label;
 *   - a JWT glance renders the claims-style compact list with the
 *     signature elided; its modal CTA opens the JWT viewer (no Save,
 *     no re-sign);
 *   - per-type tooltip text is the aria/selector contract.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * contract under test is the ladder wiring, not Monaco.
 */

import { detectValueType } from '@openheaders/ui/shared/value-detection';
import {
  useValueViewAction,
  type ValueViewTabTarget,
} from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({
    value,
    onChange,
    readOnly,
  }: {
    value?: string;
    onChange?: (next: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(cleanup);

const Harness: React.FC<{
  value: string;
  openAsTab?: (target: ValueViewTabTarget) => void;
  sourceLabel?: string;
}> = ({ value, openAsTab, sourceLabel }) => {
  const { viewProps, glance, viewerModal } = useValueViewAction(detectValueType(value), {
    openAsTab: openAsTab ?? null,
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
  });
  return (
    <App>
      {'viewTooltip' in viewProps &&
        glance(
          <button type="button" aria-label={viewProps.viewTooltip}>
            view
          </button>,
        )}
      {viewerModal}
    </App>
  );
};

function buildJWT(header: object, payload: object): string {
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode(header)}.${encode(payload)}.origsig`;
}

describe('useValueViewAction', () => {
  it('offers nothing for an undetected value', () => {
    render(<Harness value="just plain text" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('the eye opens the glance popover first — preview + per-type kicker, no modal', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Base64 value' }));

    expect(await screen.findByText('user@openheaders.io:hunter2!!')).not.toBeNull();
    expect(screen.getByText('Base64 value')).not.toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Open as modal" escalates to the encoded-value modal read-only', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Base64 value' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open as modal' }));

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('offers no document CTA without a registered opener', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Base64 value' }));

    await screen.findByRole('button', { name: 'Open as modal' });
    expect(screen.queryByRole('button', { name: 'Open in new tab' })).toBeNull();
  });

  it('"Open in new tab" hands the opener the detected hit and source label', async () => {
    const openAsTab = vi.fn();
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} openAsTab={openAsTab} sourceLabel="x-oh-token" />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Base64 value' }));

    // The source's own name titles the glance.
    expect(await screen.findByText('x-oh-token')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open in new tab' }));
    expect(openAsTab).toHaveBeenCalledTimes(1);
    const target = openAsTab.mock.calls[0][0] as ValueViewTabTarget;
    expect(target.detected?.type).toBe('base64');
    expect(target.sourceLabel).toBe('x-oh-token');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a JWT glance renders the claims list with the signature elided; its modal CTA opens the viewer', async () => {
    render(<Harness value={buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'View JWT' }));

    expect(await screen.findByText('sub')).not.toBeNull();
    expect(screen.getByText('user@openheaders.io')).not.toBeNull();
    expect(screen.getByText(/Signature not shown/)).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open as modal' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.queryByText('Re-sign with secret')).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('opens the read-only pair grid for a cookie-list hit via the modal CTA', async () => {
    render(<Harness value="session=abc123; theme=dark; Secure" />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Cookie value' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open as modal' }));

    const nameCell = (await screen.findByLabelText('Row 1 name')) as HTMLInputElement;
    expect(nameCell.readOnly).toBe(true);
    expect(nameCell.value).toBe('session');
    expect(screen.queryByText('Add row')).toBeNull();
  });

  it('generic decoded kinds seed the compact codec text in glance and modal', async () => {
    render(<Harness value="1720000000" />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Unix timestamp' }));
    expect(await screen.findByText('2024-07-03T09:46:40Z')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open as modal' }));
    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.value).toBe('2024-07-03T09:46:40Z');
    expect(editor.readOnly).toBe(true);
  });
});
