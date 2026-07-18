// @vitest-environment jsdom
/**
 * ValueViewDocumentTab — the eye glance's tab escalation: a detected
 * value opened as a read-only SNAPSHOT document. Pins:
 *   - the crumb carries the source label + per-type title and the
 *     snapshot note (attribution-historical honesty);
 *   - non-JWT kinds render the decoded text read-only with the encoded
 *     value in the bounded strip;
 *   - JWTs render header + payload panes with the verbatim token in
 *     the strip;
 *   - pair-shaped kinds render the read-only pair grid;
 *   - the tab builder: source label wins, per-type title is the
 *     fallback, and a value-view tab is never dirty.
 *
 * The Monaco CodeViewer is mocked to a textarea — the contract is the
 * snapshot document's wiring, not Monaco.
 */

import { ValueViewDocumentTab } from '@openheaders/ui/panel/components/value-view/ValueViewDocumentTab';
import { buildValueViewTab, tabIsDirty } from '@openheaders/ui/panel/data/inspector-tab';
import { detectValueType } from '@openheaders/ui/shared/value-detection';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/panel/components/detail/CodeViewer', () => ({
  default: ({ value, readOnly, language }: { value?: string; readOnly?: boolean; language?: string }) => (
    <textarea
      data-testid="code-viewer"
      data-language={language}
      value={value}
      readOnly={readOnly}
      onChange={() => {}}
    />
  ),
}));

afterEach(cleanup);

function buildJWT(header: object, payload: object): string {
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${encode(header)}.${encode(payload)}.origsig`;
}

function makeTab(value: string, sourceLabel?: string) {
  const detected = detectValueType(value);
  if (detected === null) throw new Error('test value must detect');
  return buildValueViewTab({
    nonce: 'test-nonce',
    detected,
    typeTitle: 'Type title',
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    timestamp: 1,
  });
}

describe('buildValueViewTab', () => {
  it('labels from the source, falls back to the per-type title, and is never dirty', () => {
    const named = makeTab(btoa('user@openheaders.io:hunter2!!'), 'x-oh-token');
    expect(named.label).toBe('x-oh-token');
    expect(named.id).toBe('valueview:test-nonce');
    expect(tabIsDirty(named)).toBe(false);

    const anonymous = makeTab(btoa('user@openheaders.io:hunter2!!'));
    expect(anonymous.label).toBe('Type title');
  });
});

describe('ValueViewDocumentTab', () => {
  it('renders a base64 snapshot read-only with crumb, snapshot note and encoded strip', async () => {
    const encoded = btoa('user@openheaders.io:hunter2!!');
    render(<ValueViewDocumentTab tab={makeTab(encoded, 'x-oh-token')} />);

    expect(screen.getByText('x-oh-token')).toBeTruthy();
    expect(screen.getByText(/Base64 value/)).toBeTruthy();
    expect(screen.getByText('Snapshot')).toBeTruthy();

    const viewer = (await screen.findByTestId('code-viewer')) as HTMLTextAreaElement;
    expect(viewer.readOnly).toBe(true);
    expect(viewer.value).toBe('user@openheaders.io:hunter2!!');
    expect(screen.getByText(encoded)).toBeTruthy();
  });

  it('renders a JWT snapshot as header + payload panes with the verbatim token in the strip', async () => {
    const token = buildJWT({ alg: 'HS256', typ: 'JWT' }, { sub: 'user@openheaders.io' });
    render(<ValueViewDocumentTab tab={makeTab(token, 'auth')} />);

    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.getByText('Payload')).toBeTruthy();
    const viewers = (await screen.findAllByTestId('code-viewer')) as HTMLTextAreaElement[];
    expect(viewers).toHaveLength(2);
    expect(viewers[0].value).toContain('HS256');
    expect(viewers[1].value).toContain('user@openheaders.io');
    expect(viewers.every((v) => v.readOnly)).toBe(true);
    expect(screen.getByText(token)).toBeTruthy();
  });

  it('renders a pair-shaped kind as the read-only pair grid', () => {
    render(<ValueViewDocumentTab tab={makeTab('session=abc123; theme=dark; Secure', 'cookie')} />);

    const nameCell = screen.getByLabelText('Row 1 name') as HTMLInputElement;
    expect(nameCell.readOnly).toBe(true);
    expect(nameCell.value).toBe('session');
    expect(screen.queryByText('Add row')).toBeNull();
  });
});
