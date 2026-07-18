// @vitest-environment jsdom
/**
 * EncodedValueModal read-only mode + useWholeBufferDecode — the
 * whole-buffer decode plane. Pins:
 *   - the modal's readOnly variant: decoded pane read-only, Close-only
 *     footer, no Save — text and pair-grid bodies both;
 *   - the hook claims a buffer that IS one detected encoded value and
 *     stays quiet on plain text, JWTs (the underline plane owns them),
 *     and JSON (the viewer already renders it);
 *   - the read-only leg opens a viewer modal with no write-back;
 *   - the editable leg re-encodes the edited decoded text through the
 *     compact codec and hands the encoded buffer to `onApply`.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * contract under test is decoded-text in/out, not Monaco.
 */

import EncodedValueModal from '@openheaders/ui/workbench/components/value-editors/EncodedValueModal';
import { useWholeBufferDecode } from '@openheaders/ui/workbench/components/value-editors/useWholeBufferDecode';
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

const renderModal = (props: React.ComponentProps<typeof EncodedValueModal>) =>
  render(
    <App>
      <EncodedValueModal {...props} />
    </App>,
  );

describe('EncodedValueModal — read-only viewer', () => {
  it('shows the decoded text read-only with a Close-only footer and no Save', () => {
    renderModal({
      open: true,
      title: 'Base64 value',
      decoded: 'user@openheaders.io:hunter2!!',
      encode: (text) => btoa(text),
      onCancel: vi.fn(),
      readOnly: true,
    });
    const editor = screen.getByTestId('code-editor') as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('renders the pair grid read-only: cells locked, no row actions, no Add row', () => {
    renderModal({
      open: true,
      title: 'Cookie value',
      decoded: 'session=abc123\ntheme=dark\nSecure',
      encode: (text) => text.split('\n').join('; '),
      onCancel: vi.fn(),
      gridType: 'cookie',
      readOnly: true,
    });
    const nameCell = screen.getByLabelText('Row 1 name') as HTMLInputElement;
    expect(nameCell.readOnly).toBe(true);
    expect(nameCell.value).toBe('session');
    expect((screen.getByLabelText('Row 2 value') as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByLabelText('Delete row 1')).toBeNull();
    expect(screen.queryByLabelText('Move row 1 up')).toBeNull();
    expect(screen.queryByText('Add row')).toBeNull();
  });

  it('closes through the footer Close button', () => {
    const onCancel = vi.fn();
    renderModal({
      open: true,
      title: 'Base64 value',
      decoded: 'user@openheaders.io',
      encode: (text) => btoa(text),
      onCancel,
      readOnly: true,
    });
    fireEvent.click(screen.getByText('Close').closest('button') as HTMLButtonElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// --------------------------------------------------------------------
// useWholeBufferDecode — detection gate + viewer/editor split
// --------------------------------------------------------------------

const Harness: React.FC<{
  value: string;
  readOnly?: boolean;
  onApply?: (encoded: string) => void;
  allowJwt?: boolean;
}> = ({ value, readOnly, onApply, allowJwt }) => {
  const { decodeChip, decodeModal } = useWholeBufferDecode({ value, readOnly, onApply, allowJwt });
  return (
    <App>
      {decodeChip}
      {decodeModal}
    </App>
  );
};

function buildJWT(header: object, payload: object): string {
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode(header)}.${encode(payload)}.origsig`;
}

describe('useWholeBufferDecode — detection gate', () => {
  it('offers no chip on plain text', () => {
    render(<Harness value="just a plain readable body" readOnly />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });

  it('offers no chip on a whole-buffer JWT — the underline plane owns it', () => {
    render(<Harness value={buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' })} readOnly />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });

  it('offers no chip on a JSON buffer — the viewer already renders it', () => {
    render(<Harness value='{"userId":123,"role":"admin"}' readOnly />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });

  it('offers the chip on a whole-buffer base64 value, titled by type', () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} readOnly />);
    const chip = screen.getByRole('button', { name: 'Decode' });
    expect(chip.getAttribute('title')).toContain('Base64 value');
  });

  it('stays quiet when disabled', () => {
    const Disabled: React.FC = () => {
      const { decodeChip } = useWholeBufferDecode({ value: btoa('user@openheaders.io:hunter2!!'), enabled: false });
      return <>{decodeChip}</>;
    };
    render(<Disabled />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });
});

describe('useWholeBufferDecode — allowJwt (<pre> hosts)', () => {
  const token = buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' });

  it('lets a whole-buffer JWT through the chip on a read-only buffer, titled View JWT', async () => {
    render(<Harness value={token} readOnly allowJwt />);
    const chip = screen.getByRole('button', { name: 'Decode' });
    expect(chip.getAttribute('title')).toBe('View JWT');
    fireEvent.click(chip);

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
    expect(screen.queryByText('Re-sign with secret')).toBeNull();
    expect(screen.getByText('Close').closest('button')).not.toBeNull();
  });

  it('never lets jwt claim an editable buffer — allowJwt is viewer-only', () => {
    render(<Harness value={token} allowJwt onApply={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });

  it('keeps the json exclusion even with allowJwt', () => {
    render(<Harness value='{"userId":123,"role":"admin"}' readOnly allowJwt />);
    expect(screen.queryByRole('button', { name: 'Decode' })).toBeNull();
  });
});

describe('useWholeBufferDecode — viewer/editor split', () => {
  it('opens a read-only viewer modal on a read-only buffer', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} readOnly />);
    fireEvent.click(screen.getByRole('button', { name: 'Decode' }));

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });

  it('opens a viewer even on an editable buffer when no write-back is wired', async () => {
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decode' }));
    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(true);
  });

  it('re-encodes the edited decoded text and applies the whole buffer', async () => {
    const onApply = vi.fn();
    render(<Harness value={btoa('user@openheaders.io:hunter2!!')} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decode' }));

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.readOnly).toBe(false);
    fireEvent.change(editor, { target: { value: 'user@openheaders.io:rotated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onApply).toHaveBeenCalledWith(btoa('user@openheaders.io:rotated'));
  });

  it('keeps Save disabled while the edited text cannot encode', async () => {
    const onApply = vi.fn();
    render(<Harness value="1720000000" onApply={onApply} />);
    const chip = screen.getByRole('button', { name: 'Decode' });
    expect(chip.getAttribute('title')).toContain('Unix timestamp');
    fireEvent.click(chip);

    const editor = (await screen.findByTestId('code-editor')) as HTMLTextAreaElement;
    expect(editor.value).toBe('2024-07-03T09:46:40Z');
    const save = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    fireEvent.change(editor, { target: { value: 'not a date' } });
    expect(save.disabled).toBe(true);

    fireEvent.change(editor, { target: { value: '2026-07-10T00:00:00Z' } });
    fireEvent.click(save);
    expect(onApply).toHaveBeenCalledWith(String(Date.parse('2026-07-10T00:00:00Z') / 1000));
  });

  it('renders the pair grid for a whole-buffer query string and re-joins on save', async () => {
    const onApply = vi.fn();
    render(<Harness value="user=user%40openheaders.io&theme=dark&plan=team" onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decode' }));

    const themeValue = (await screen.findByLabelText('Row 2 value')) as HTMLInputElement;
    expect(themeValue.value).toBe('dark');
    fireEvent.change(themeValue, { target: { value: 'light' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onApply).toHaveBeenCalledWith('user=user%40openheaders.io&theme=light&plan=team');
  });
});
