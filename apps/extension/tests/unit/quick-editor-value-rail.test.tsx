// @vitest-environment jsdom
/**
 * Quick-editor value fields carry the edit rail in its COMPACT variant:
 * the icon opens the inline `CompactValueEditor` below the field (no
 * portal modal — popover-safe), Save re-encodes through the same
 * `encodeCurrent` spine the modals use, and dirtiness derives from
 * text-vs-decoded equality. JWTs edit payload-only here — header and
 * signature carry over verbatim. Param/header NAME fields stay bare,
 * same contract the workbench pins in rule-fields-value-rail.
 */

import { QueryParamQuickRows } from '@openheaders/ui/panel/components/rule-quick-editor/QueryParamQuickRows';
import type { QueryParamQuickRow } from '@openheaders/ui/panel/data/rule-create/payload-rule-create';
import { AwarenessIdentityProvider } from '@openheaders/ui/shared/awareness';
import { DocsNavProvider } from '@openheaders/ui/shared/docs/use-docs-nav';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

const testIdentity = resolveWorkbenchIdentity();

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

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const JWT = `${b64url(JWT_HEADER)}.${b64url({ sub: 'user@openheaders.io' })}.fakesig`;
const BASIC = `Basic ${btoa('dev-user:s3cret-pw')}`;

function CompactHost({
  initial,
  onCommit,
  onOpenDocument,
}: {
  initial: string;
  onCommit: (next: string) => void;
  onOpenDocument?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DetectedValueInput
      editorVariant="compact"
      onOpenDocument={onOpenDocument}
      value={value}
      onChange={(v) => {
        setValue(v);
        onCommit(v);
      }}
    />
  );
}

function renderCompact(initial: string, onOpenDocument?: () => void) {
  const onCommit = vi.fn();
  const utils = render(
    <AwarenessIdentityProvider value={testIdentity}>
      <DocsNavProvider>
        <CompactHost initial={initial} onCommit={onCommit} onOpenDocument={onOpenDocument} />
      </DocsNavProvider>
    </AwarenessIdentityProvider>,
  );
  return { ...utils, onCommit };
}

describe('compact variant — inline editor lifecycle', () => {
  it('opens the inline editor on the rail icon, decoded, with no portal dialog', () => {
    const { getByLabelText, queryByRole, getByRole } = renderCompact(BASIC);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    const editor = getByRole('group', { name: 'Base64 value' });
    expect(editor).toBeTruthy();
    expect(queryByRole('dialog')).toBeNull();
    const textarea = getByLabelText('Base64 value decoded text') as HTMLTextAreaElement;
    expect(textarea.value).toBe('dev-user:s3cret-pw');
  });

  it('disables Save while clean, shows the preview only on divergence', () => {
    const { getByLabelText, getByRole, queryByText, getByText } = renderCompact(BASIC);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    const save = getByRole('button', { name: /Save/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(queryByText('Encoded preview')).toBeNull();
    fireEvent.change(getByLabelText('Base64 value decoded text'), { target: { value: 'dev-user:new-pw' } });
    expect(getByText('Encoded preview')).toBeTruthy();
    expect(getByText(`Basic ${btoa('dev-user:new-pw')}`)).toBeTruthy();
    expect((getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('writes the re-encoded value back on Save, prefix carried, and closes', () => {
    const { getByLabelText, getByRole, queryByRole, onCommit } = renderCompact(BASIC);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    fireEvent.change(getByLabelText('Base64 value decoded text'), { target: { value: 'dev-user:new-pw' } });
    fireEvent.click(getByRole('button', { name: /Save/ }));
    expect(onCommit).toHaveBeenCalledWith(`Basic ${btoa('dev-user:new-pw')}`);
    expect(queryByRole('group', { name: 'Base64 value' })).toBeNull();
  });

  it('Cancel closes without writing back', () => {
    const { getByLabelText, getByRole, queryByRole, onCommit } = renderCompact(BASIC);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    fireEvent.change(getByLabelText('Base64 value decoded text'), { target: { value: 'changed' } });
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(queryByRole('group', { name: 'Base64 value' })).toBeNull();
  });

  it('disables Save and flags the preview when the edit cannot encode', () => {
    const { getByLabelText, getByRole, getByText } = renderCompact('1767225600');
    fireEvent.click(getByLabelText('Edit timestamp'));
    fireEvent.change(getByLabelText('Unix timestamp decoded text'), { target: { value: 'not-a-date' } });
    expect(getByText('Cannot encode — the edited value is not valid for this type')).toBeTruthy();
    expect((getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('compact variant — JWT edits payload-only', () => {
  it('seeds the textarea with the formatted payload, not the header', () => {
    const { getByLabelText } = renderCompact(`Bearer ${JWT}`);
    fireEvent.click(getByLabelText('Edit as JWT'));
    const textarea = getByLabelText('JWT payload decoded text') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"sub": "user@openheaders.io"');
    expect(textarea.value).not.toContain('alg');
  });

  it('re-encodes with header, signature, and Bearer prefix carried over', () => {
    const { getByLabelText, getByRole, onCommit } = renderCompact(`Bearer ${JWT}`);
    fireEvent.click(getByLabelText('Edit as JWT'));
    fireEvent.change(getByLabelText('JWT payload decoded text'), {
      target: { value: '{"sub":"admin@openheaders.io"}' },
    });
    fireEvent.click(getByRole('button', { name: /Save/ }));
    expect(onCommit).toHaveBeenCalledWith(
      `Bearer ${b64url(JWT_HEADER)}.${b64url({ sub: 'admin@openheaders.io' })}.fakesig`,
    );
  });

  it('rejects a non-object payload edit (Save disabled)', () => {
    const { getByLabelText, getByRole } = renderCompact(`Bearer ${JWT}`);
    fireEvent.click(getByLabelText('Edit as JWT'));
    fireEvent.change(getByLabelText('JWT payload decoded text'), { target: { value: '"just-a-string"' } });
    expect((getByRole('button', { name: /Save/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('compact variant — "Open as document" escalation', () => {
  it('offers the footer affordance only when the host passes an opener', () => {
    const { getByLabelText, queryByRole } = renderCompact(BASIC);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    expect(queryByRole('button', { name: /Open as document/ })).toBeNull();
  });

  it('fires the opener on click without writing the field back', () => {
    const onOpenDocument = vi.fn();
    const { getByLabelText, getByRole, onCommit } = renderCompact(BASIC, onOpenDocument);
    fireEvent.click(getByLabelText('Edit Base64 value'));
    fireEvent.click(getByRole('button', { name: /Open as document/ }));
    expect(onOpenDocument).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('quick-editor rows — rail placement', () => {
  const renderRows = (rows: QueryParamQuickRow[]) =>
    render(
      <AwarenessIdentityProvider value={testIdentity}>
        <DocsNavProvider>
          <QueryParamQuickRows rows={rows} setRows={vi.fn()} />
        </DocsNavProvider>
      </AwarenessIdentityProvider>,
    );

  it('shows the edit icon on a detectable param VALUE only — names stay bare', () => {
    // A timestamp in the NAME field must not sprout an icon.
    const { getAllByLabelText } = renderRows([
      { uid: 'q1', operation: 'add', param: '1767225600', value: '1767225600' },
    ]);
    expect(getAllByLabelText('Edit timestamp')).toHaveLength(1);
  });

  it('shows no edit icon on plain or {{var}}-bearing values', () => {
    const { container } = renderRows([
      { uid: 'q1', operation: 'add', param: 'tenant', value: 'openheaders' },
      { uid: 'q2', operation: 'add', param: 'token', value: '{{vault.API_TOKEN}}' },
    ]);
    expect(container.querySelectorAll('[aria-label^="Edit"]')).toHaveLength(0);
  });
});
