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
import { decodeJWT, useJwtEditAction } from '@openheaders/ui/workbench/components/value-editors';
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

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
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

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(pasted);
  });

  it('flags an undecodable pasted value and disables Save', () => {
    renderModal({ open: true, token: buildJWT(HEADER, PAYLOAD), onSave: vi.fn(), onCancel: vi.fn() });

    fireEvent.click(screen.getByText('Encoded'));
    fireEvent.change(screen.getByPlaceholderText('header.payload.signature'), {
      target: { value: 'not-a-token' },
    });
    expect(screen.getByText('Not a decodable JWT')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

// --------------------------------------------------------------------
// useJwtEditAction — rail wiring + Bearer prefix restoration
// --------------------------------------------------------------------

const Harness: React.FC<{ value: string; onChange: (next: string) => void }> = ({ value, onChange }) => {
  const { jwtEditProps, jwtModal } = useJwtEditAction(value, onChange);
  return (
    <App>
      <TemplateInput value={value} onChange={onChange} {...jwtEditProps} />
      {jwtModal}
    </App>
  );
};

describe('useJwtEditAction', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const written = onChange.mock.calls[0][0] as string;
    expect(written.startsWith('Bearer ')).toBe(true);
    const saved = decodeJWT(written.slice('Bearer '.length));
    expect(saved.payload).toEqual({ sub: 'edited@openheaders.io' });
    expect(saved.signature).toBe('origsig');
  });
});
