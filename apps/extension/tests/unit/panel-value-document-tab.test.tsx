// @vitest-environment jsdom
/**
 * ValueDocumentTab — one rule field's detected value opened as a full
 * editor-tab document (the compact editor's escalation). The canonical
 * is the LIVE rule through the sync mirror: a pristine document adopts
 * remote edits, a dirty one keeps its draft and surfaces drift; the
 * field vanishing under a draft keeps the text for copy-out with Save
 * blocked. Save re-encodes through the compact codec (JWT payload-only,
 * prefix carried) and rides a value-only uid-keyed rule update that
 * keeps a published rule published in the same batch.
 */

import type { HeaderRule, Rule } from '@openheaders/core/types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Live-rule store standing in for the workspace sync mirror — tests
// push canonical movement through it and the mocked useLiveRule
// re-renders subscribers, exactly like a broadcast landing.
let liveRule: Rule | null = null;
const listeners = new Set<() => void>();
function setLiveRule(rule: Rule | null): void {
  liveRule = rule;
  for (const l of listeners) l();
}

vi.mock('@openheaders/ui/context', async (importActual) => ({
  ...(await importActual<typeof import('@openheaders/ui/context')>()),
  useLiveRule: () =>
    useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      () => liveRule,
    ),
}));

const mockUpdateRule = vi.fn();
vi.mock('@openheaders/ui/shared/hooks/mutators/useRuleMutator', () => ({
  useRuleMutator: () => ({ updateRule: mockUpdateRule }),
}));

vi.mock('@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => 'ws-1',
}));

const mockOpenWorkspace = vi.fn();
vi.mock('@openheaders/ui/shared/workspace-intent', () => ({
  openWorkspace: (...args: unknown[]) => {
    mockOpenWorkspace(...args);
    return Promise.resolve({ ok: true, tabId: 1, path: '/' });
  },
}));

// Monaco is out of scope in jsdom — the mock exposes the same
// value/language/onChange seam as a plain textarea.
vi.mock('@openheaders/ui/panel/components/detail/CodeViewer', () => ({
  default: ({ value, language, onChange }: { value: string; language: string; onChange?: (value: string) => void }) => (
    <textarea
      data-testid="code-viewer"
      data-language={language}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

import { ValueDocumentTab } from '@openheaders/ui/panel/components/value-document/ValueDocumentTab';
import { buildRuleValueTab } from '@openheaders/ui/panel/data/inspector-tab';

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const JWT = `${b64url(JWT_HEADER)}.${b64url({ sub: 'user@openheaders.io' })}.fakesig`;

function makeHeaderRule(value: string, over: Partial<HeaderRule> = {}): HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'rule-1',
    path: 'rules/Auth/Token',
    name: 'Auth token',
    enabled: true,
    published: true,
    type: 'header',
    conditions: [],
    action: {
      requestHeaders: [{ uid: 'mod-1', operation: 'override', headerName: 'Authorization', value }],
      responseHeaders: [],
    },
    ...over,
  };
}

const TAB = buildRuleValueTab({
  ruleUid: 'rule-1',
  direction: 'request',
  modUid: 'mod-1',
  headerName: 'Authorization',
  timestamp: 1,
});

function renderTab(props: Partial<Parameters<typeof ValueDocumentTab>[0]> = {}) {
  return render(<ValueDocumentTab tab={TAB} {...props} />);
}

const editor = () => screen.getByTestId('code-viewer') as HTMLTextAreaElement;
const saveButton = () => screen.getByRole('button', { name: /Save/ }) as HTMLButtonElement;

beforeEach(() => {
  liveRule = null;
  mockUpdateRule.mockReset();
  mockOpenWorkspace.mockReset();
});

afterEach(cleanup);

describe('document body — decoded canonical', () => {
  it('seeds the editor with the decoded JWT payload as JSON, crumb carries rule + header + type', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('"sub": "user@openheaders.io"'));
    expect(editor().value).not.toContain('alg');
    expect(editor().dataset.language).toBe('json');
    expect(screen.getByTitle('Auth token › Authorization')).toBeTruthy();
    expect(screen.getByText(/JWT payload/)).toBeTruthy();
  });

  it('adopts a live canonical change while pristine', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    const nextJwt = `${b64url(JWT_HEADER)}.${b64url({ sub: 'admin@openheaders.io' })}.fakesig`;
    setLiveRule(makeHeaderRule(`Bearer ${nextJwt}`));
    await waitFor(() => expect(editor().value).toContain('admin@openheaders.io'));
  });

  it('shows the honest empty state when the modification is gone', () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`, { action: { requestHeaders: [], responseHeaders: [] } }));
    renderTab();
    expect(screen.getByText('Value no longer in the rule')).toBeTruthy();
  });
});

describe('edit → preview → save', () => {
  it('derives dirty, previews the re-encoded value, and saves through the mutator with published carried', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    mockUpdateRule.mockResolvedValue({ ok: true, rule: makeHeaderRule(`Bearer ${JWT}`) });
    const onDirtyChange = vi.fn();
    renderTab({ onDirtyChange });
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(editor(), { target: { value: '{"sub":"admin@openheaders.io"}' } });
    const expected = `Bearer ${b64url(JWT_HEADER)}.${b64url({ sub: 'admin@openheaders.io' })}.fakesig`;
    expect(screen.getByLabelText('Encoded preview').textContent).toContain(expected);
    expect(saveButton().disabled).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(saveButton());
    await waitFor(() => expect(mockUpdateRule).toHaveBeenCalledTimes(1));
    const [uid, updates] = mockUpdateRule.mock.calls[0] as [string, Partial<HeaderRule>];
    expect(uid).toBe('rule-1');
    expect(updates.published).toBe(true);
    expect(updates.action?.requestHeaders[0]).toEqual({
      uid: 'mod-1',
      operation: 'override',
      headerName: 'Authorization',
      value: expected,
    });
    // Reads clean immediately — before the mirror broadcast lands.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it('blocks Save and flags the preview when the edit cannot encode', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    fireEvent.change(editor(), { target: { value: '"not-an-object"' } });
    expect(screen.getByText('Cannot encode — the edited value is not valid for this type')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(mockUpdateRule).not.toHaveBeenCalled();
  });

  it('surfaces a not-found save failure without clearing the draft', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    mockUpdateRule.mockResolvedValue({ ok: false, reason: 'not-found' });
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    fireEvent.change(editor(), { target: { value: '{"sub":"admin@openheaders.io"}' } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Rule not found'));
    expect(editor().value).toBe('{"sub":"admin@openheaders.io"}');
  });
});

describe('canonical movement under a draft', () => {
  it('keeps the draft and surfaces drift; Discard re-seeds to the live value', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    fireEvent.change(editor(), { target: { value: '{"sub":"mine@openheaders.io"}' } });

    const nextJwt = `${b64url(JWT_HEADER)}.${b64url({ sub: 'theirs@openheaders.io' })}.fakesig`;
    setLiveRule(makeHeaderRule(`Bearer ${nextJwt}`));
    await waitFor(() => expect(screen.getByText(/value changed in the rule while you were editing/)).toBeTruthy());
    expect(editor().value).toBe('{"sub":"mine@openheaders.io"}');

    fireEvent.click(screen.getByRole('button', { name: 'Discard my edits' }));
    await waitFor(() => expect(editor().value).toContain('theirs@openheaders.io'));
  });

  it('keeps a dirty draft for copy-out with Save blocked when the field vanishes', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    fireEvent.change(editor(), { target: { value: '{"sub":"mine@openheaders.io"}' } });

    setLiveRule(null);
    await waitFor(() => expect(screen.getByText(/gone — your unsaved edits are kept/)).toBeTruthy());
    expect(editor().value).toBe('{"sub":"mine@openheaders.io"}');
    expect(saveButton().disabled).toBe(true);
  });
});

describe('toolbar', () => {
  it('routes "Open rule in workspace" through the edit-rule intent', async () => {
    setLiveRule(makeHeaderRule(`Bearer ${JWT}`));
    renderTab();
    await waitFor(() => expect(editor().value).toContain('user@openheaders.io'));
    fireEvent.click(screen.getByRole('button', { name: /Open rule in workspace/ }));
    expect(mockOpenWorkspace).toHaveBeenCalledWith({ kind: 'edit-rule', uid: 'rule-1' }, 'devpanel');
  });
});
