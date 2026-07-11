// @vitest-environment jsdom
/**
 * JWTEditorModal + useJwtEditAction — the stateful half of the JWT
 * value editor. Pins:
 *   - decoded-mode round trip: edit the payload JSON → Save returns the
 *     re-encoded token with the ORIGINAL signature carried over;
 *   - the "Signature no longer valid" warning appears once modified;
 *   - encoded mode accepts a pasted raw token and rejects garbage;
 *   - expiration status renders from the `exp` claim;
 *   - the hook wires the rail edit icon only for JWT values and
 *     restores a `Bearer ` prefix on save.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * modal's contract is the JSON string in/out, not Monaco itself.
 */

import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { decodeJWT, useValueEditAction } from '@openheaders/ui/workbench/components/value-editors';
import JWTEditorModal from '@openheaders/ui/workbench/components/value-editors/JWTEditorModal';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (next: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
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

function buildJWT(header: object, payload: object, sig = 'origsig'): string {
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode(header)}.${encode(payload)}.${sig}`;
}

const HEADER = { alg: 'HS256', typ: 'JWT' };
const PAYLOAD = { sub: 'user@openheaders.io', scope: 'openid profile' };

const renderModal = (props: React.ComponentProps<typeof JWTEditorModal>) =>
  render(
    <App>
      <JWTEditorModal {...props} />
    </App>,
  );

describe('JWTEditorModal — decoded mode', () => {
  it('shows the decoded header + payload JSON', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });
    const editors = screen.getAllByTestId('code-editor') as HTMLTextAreaElement[];
    expect(editors).toHaveLength(2);
    expect(JSON.parse(editors[0].value)).toEqual(HEADER);
    expect(JSON.parse(editors[1].value)).toEqual(PAYLOAD);
  });

  it('re-encodes an edited payload on Save, carrying the original signature', () => {
    const onSave = vi.fn();
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave, onCancel: vi.fn() });

    const payloadEditor = (screen.getAllByTestId('code-editor') as HTMLTextAreaElement[])[1];
    const nextPayload = { sub: 'user@openheaders.io', scope: 'openid profile email', roles: ['admin'] };
    fireEvent.change(payloadEditor, { target: { value: JSON.stringify(nextPayload) } });

    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = decodeJWT(onSave.mock.calls[0][0]);
    expect(saved.header).toEqual(HEADER);
    expect(saved.payload).toEqual(nextPayload);
    expect(saved.signature).toBe('origsig');
  });

  it('warns that the signature is no longer valid once modified', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });
    expect(screen.queryByText('Signature no longer valid')).toBeNull();

    const payloadEditor = (screen.getAllByTestId('code-editor') as HTMLTextAreaElement[])[1];
    fireEvent.change(payloadEditor, { target: { value: '{"sub":"other@openheaders.io"}' } });
    expect(screen.getByText('Signature no longer valid')).not.toBeNull();
  });

  it('disables Save while the payload JSON is invalid', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });
    const payloadEditor = (screen.getAllByTestId('code-editor') as HTMLTextAreaElement[])[1];
    fireEvent.change(payloadEditor, { target: { value: '{not json}' } });
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Save until something changes, and re-disables on revert to the original', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });
    const save = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const payloadEditor = (screen.getAllByTestId('code-editor') as HTMLTextAreaElement[])[1];
    const original = payloadEditor.value;
    fireEvent.change(payloadEditor, { target: { value: '{"sub":"other@openheaders.io"}' } });
    expect(save.disabled).toBe(false);

    fireEvent.change(payloadEditor, { target: { value: original } });
    expect(save.disabled).toBe(true);
  });

  it('renders the expiration status from the exp claim', () => {
    const expired = { ...PAYLOAD, exp: Math.floor(Date.now() / 1000) - 3600 };
    renderModal({ open: true, token: buildJWT(HEADER, expired), onSave: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByText('Token expired')).not.toBeNull();
  });
});

describe('JWTEditorModal — encoded mode', () => {
  it('accepts a pasted raw token and saves it verbatim', () => {
    const onSave = vi.fn();
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave, onCancel: vi.fn() });

    fireEvent.click(screen.getByText('Encoded'));
    const rawInput = screen.getByPlaceholderText('header.payload.signature');
    const pasted = buildJWT(HEADER, { sub: 'pasted@openheaders.io' }, 'newsig');
    fireEvent.change(rawInput, { target: { value: pasted } });

    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    expect(onSave).toHaveBeenCalledWith(pasted);
  });

  it('flags an undecodable pasted value and disables Save', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.click(screen.getByText('Encoded'));
    fireEvent.change(screen.getByPlaceholderText('header.payload.signature'), {
      target: { value: 'not-a-token' },
    });
    expect(screen.getByText('Not a decodable JWT')).not.toBeNull();
    expect((screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// --------------------------------------------------------------------
// useJwtEditAction — rail wiring + Bearer prefix restoration
// --------------------------------------------------------------------

const Harness: React.FC<{ value: string; onChange: (next: string) => void }> = ({ value, onChange }) => {
  const { editProps, editorModal } = useValueEditAction(value, onChange);
  return (
    <App>
      <TemplateInput value={value} onChange={onChange} {...editProps} />
      {editorModal}
    </App>
  );
};

describe('useValueEditAction', () => {
  it('offers no edit icon for a non-JWT value', () => {
    const { container } = render(<Harness value="ohk_live_4eC39HqLyjWDarjtT1zdp7dc" onChange={vi.fn()} />);
    expect(container.querySelector('.oh-template-input-action[aria-label="Edit as JWT"]')).toBeNull();
  });

  it('opens the editor from the rail icon and restores the Bearer prefix on save', async () => {
    const onChange = vi.fn();
    const token = buildJWT(HEADER, PAYLOAD);
    const { container } = render(<Harness value={`Bearer ${token}`} onChange={onChange} />);

    const editIcon = container.querySelector('.oh-template-input-action[aria-label="Edit as JWT"]');
    expect(editIcon).not.toBeNull();
    fireEvent.click(editIcon as Element);

    // The modal is lazy-loaded on first open — wait for it to mount.
    const payloadEditor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[1];
    fireEvent.change(payloadEditor, { target: { value: '{"sub":"edited@openheaders.io"}' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const written = onChange.mock.calls[0][0] as string;
    expect(written.startsWith('Bearer ')).toBe(true);
    const saved = decodeJWT(written.slice('Bearer '.length));
    expect(saved.payload).toEqual({ sub: 'edited@openheaders.io' });
    expect(saved.signature).toBe('origsig');
  });

  it('opens the encoded-value editor for base64 and writes the re-encoded text back', async () => {
    const onChange = vi.fn();
    const value = btoa('user@openheaders.io:hunter2!!'); // padded standard base64
    const { container } = render(<Harness value={value} onChange={onChange} />);

    const editIcon = container.querySelector('.oh-template-input-action[aria-label="Edit Base64 value"]');
    expect(editIcon).not.toBeNull();
    fireEvent.click(editIcon as Element);

    // Lazy modal — a single plaintext editor holding the decoded text.
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('user@openheaders.io:hunter2!!');
    fireEvent.change(editor, { target: { value: 'user@openheaders.io:rotated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith(btoa('user@openheaders.io:rotated'));
  });

  it('restores a Basic prefix when saving a re-encoded base64 credential', async () => {
    const onChange = vi.fn();
    const value = `Basic ${btoa('user@openheaders.io:hunter2!!')}`;
    const { container } = render(<Harness value={value} onChange={onChange} />);

    fireEvent.click(container.querySelector('.oh-template-input-action[aria-label="Edit Base64 value"]') as Element);
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    fireEvent.change(editor, { target: { value: 'user@openheaders.io:rotated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith(`Basic ${btoa('user@openheaders.io:rotated')}`);
  });

  it('edits a Unix timestamp as an ISO date and re-encodes in the original resolution', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value="1720000000" onChange={onChange} />);

    const editIcon = container.querySelector('.oh-template-input-action[aria-label="Edit timestamp"]');
    expect(editIcon).not.toBeNull();
    fireEvent.click(editIcon as Element);

    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('2024-07-03T09:46:40Z');

    // An unparsable date disables Save…
    const save = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    fireEvent.change(editor, { target: { value: 'not a date' } });
    expect(save.disabled).toBe(true);

    // …a valid one re-encodes to 10-digit seconds.
    fireEvent.change(editor, { target: { value: '2026-07-10T00:00:00Z' } });
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith(String(Date.parse('2026-07-10T00:00:00Z') / 1000));
  });

  it('opens the hex editor and writes the re-encoded text back in the original case', async () => {
    const onChange = vi.fn();
    const toHex = (text: string) => {
      let out = '';
      for (const byte of new TextEncoder().encode(text)) out += byte.toString(16).padStart(2, '0');
      return out.toUpperCase();
    };
    const { container } = render(<Harness value={toHex('trace: openheaders')} onChange={onChange} />);

    fireEvent.click(
      container.querySelector('.oh-template-input-action[aria-label="Edit hex-encoded value"]') as Element,
    );
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('trace: openheaders');
    fireEvent.change(editor, { target: { value: 'trace: rotated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith(toHex('trace: rotated'));
  });

  it('edits compact JSON pretty-printed and writes it back compact', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value='{"userId":123}' onChange={onChange} />);

    fireEvent.click(container.querySelector('.oh-template-input-action[aria-label="Edit as JSON"]') as Element);
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe(JSON.stringify({ userId: 123 }, null, 2));

    // Broken JSON disables Save; a valid edit re-serializes compact.
    const save = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    fireEvent.change(editor, { target: { value: '{broken' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(editor, { target: { value: '{\n  "userId": 456,\n  "role": "admin"\n}' } });
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith('{"userId":456,"role":"admin"}');
  });

  it('unescapes a quoted JSON string for editing and re-quotes on save', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value={JSON.stringify('{"userId":123}')} onChange={onChange} />);

    fireEvent.click(container.querySelector('.oh-template-input-action[aria-label="Edit quoted string"]') as Element);
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('{"userId":123}');
    fireEvent.change(editor, { target: { value: '{"userId":456}' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith(JSON.stringify('{"userId":456}'));
  });

  it('edits an HTTP date as ISO and writes back IMF-fixdate', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value="Wed, 21 Oct 2026 07:28:00 GMT" onChange={onChange} />);

    fireEvent.click(container.querySelector('.oh-template-input-action[aria-label="Edit HTTP date"]') as Element);
    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('2026-10-21T07:28:00Z');
    fireEvent.change(editor, { target: { value: '2026-12-01T00:00:00Z' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith('Tue, 01 Dec 2026 00:00:00 GMT');
  });

  it('edits a cookie string as a name/value grid and re-joins on save', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value="session=abc123; theme=dark; Secure" onChange={onChange} />);

    fireEvent.click(container.querySelector('.oh-template-input-action[aria-label="Edit cookie pairs"]') as Element);
    const sessionValue = (await screen.findByLabelText('Row 1 value')) as HTMLInputElement;
    expect(sessionValue.value).toBe('abc123');
    expect((screen.getByLabelText('Row 3 value') as HTMLInputElement).placeholder).toBe('flag');

    // A cell that breaks the `; ` segment framing disables Save…
    const save = screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    fireEvent.change(sessionValue, { target: { value: 'has;semicolon' } });
    expect(save.disabled).toBe(true);

    // …valid cells re-join with `; `.
    fireEvent.change(sessionValue, { target: { value: 'rotated' } });
    fireEvent.change(screen.getByLabelText('Row 2 value'), { target: { value: 'light' } });
    fireEvent.click(save);
    expect(onChange).toHaveBeenCalledWith('session=rotated; theme=light; Secure');
  });

  it('opens the encoded-value editor for URL-encoded values and re-encodes on save', async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness value="a%20value%20with%20spaces" onChange={onChange} />);

    const editIcon = container.querySelector('.oh-template-input-action[aria-label="Edit URL-encoded value"]');
    expect(editIcon).not.toBeNull();
    fireEvent.click(editIcon as Element);

    const editor = ((await screen.findAllByTestId('code-editor')) as HTMLTextAreaElement[])[0];
    expect(editor.value).toBe('a value with spaces');
    fireEvent.change(editor, { target: { value: 'a different value' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(onChange).toHaveBeenCalledWith(encodeURIComponent('a different value'));
  });
});
