// @vitest-environment jsdom
/**
 * useValueViewAction — the read-only sibling of the rail's edit hook,
 * consumed by the panel's row surfaces (headers/cookies view icon).
 * Pins:
 *   - no detected value ⇒ no view props, no modal;
 *   - a non-JWT hit opens the shared EncodedValueModal readOnly
 *     (decoded pane locked, Close-only footer, no Save);
 *   - pair-shaped kinds get the read-only pair grid;
 *   - a JWT hit opens the JWT viewer (no Save, no re-sign);
 *   - per-type tooltip text is the aria/selector contract.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * contract under test is the readOnly wiring, not Monaco.
 */

import { useValueViewAction } from '@openheaders/ui/workbench/components/value-editors/useValueViewAction';
import { detectValueType } from '@openheaders/ui/shared/value-detection';
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

const Harness: React.FC<{ value: string }> = ({ value }) => {
  const { viewProps, viewerModal } = useValueViewAction(detectValueType(value));
  return (
    <App>
      {'onValueView' in viewProps && (
        <button type="button" aria-label={viewProps.viewTooltip} onClick={viewProps.onValueView}>
          view
        </button>
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

  it('opens the encoded-value modal read-only for a base64 hit', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} />);
    const icon = screen.getByRole('button', { name: 'View decoded — Base64 value' });
    fireEvent.click(icon);

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('opens the read-only pair grid for a cookie-list hit', async () => {
    render(<Harness value="session=abc123; theme=dark; Secure" />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Cookie value' }));

    const nameCell = (await screen.findByLabelText('Row 1 name')) as HTMLInputElement;
    expect(nameCell.readOnly).toBe(true);
    expect(nameCell.value).toBe('session');
    expect(screen.queryByText('Add row')).toBeNull();
  });

  it('opens the JWT viewer for a token hit — no Save, no re-sign', async () => {
    render(<Harness value={buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'View JWT' }));

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.queryByText('Re-sign with secret')).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('generic decoded kinds seed the compact codec text', async () => {
    render(<Harness value="1720000000" />);
    fireEvent.click(screen.getByRole('button', { name: 'View decoded — Unix timestamp' }));
    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.value).toBe('2024-07-03T09:46:40Z');
    expect(editor.readOnly).toBe(true);
  });
});
