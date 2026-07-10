// @vitest-environment jsdom
/**
 * User-row Value cells in the editable grids carry the in-field action
 * rail (clear ✕ always, JWT edit icon on detection) via the shared
 * GridValueField — parity with the auth suggestion row. Key and
 * Description cells stay rail-free, and user rows never show the
 * secret eye (no secret concept on plain rows).
 */

import KeyValueTable, { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
});

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user@openheaders.io' })}.fakesig`;

describe('user-row value cell — action rail', () => {
  it('shows the JWT edit icon on a user row holding a token (bare and Bearer-prefixed)', () => {
    const rows = [
      makeKvRow({ key: 'X-Token', value: JWT }),
      makeKvRow({ key: 'Authorization', value: `Bearer ${JWT}` }),
    ];
    const { getAllByLabelText } = render(<KeyValueTable rows={rows} onChange={vi.fn()} />);
    expect(getAllByLabelText('Edit as JWT')).toHaveLength(2);
  });

  it('shows the clear ✕ on any non-empty user-row value, but no edit icon on a plain value', () => {
    const rows = [makeKvRow({ key: 'Accept', value: 'application/json' })];
    const { getAllByLabelText, queryByLabelText } = render(<KeyValueTable rows={rows} onChange={vi.fn()} />);
    expect(getAllByLabelText('Clear value').length).toBeGreaterThanOrEqual(1);
    expect(queryByLabelText('Edit as JWT')).toBeNull();
  });

  it('never shows the secret eye on user rows, and suppresses the ✕ beside the edit icon', () => {
    const rows = [makeKvRow({ key: 'X-Token', value: JWT })];
    const { queryByLabelText } = render(<KeyValueTable rows={rows} onChange={vi.fn()} />);
    expect(queryByLabelText('Show value')).toBeNull();
    expect(queryByLabelText('Hide value')).toBeNull();
    // The JWT row's rail holds the edit icon — the destructive ✕
    // stands down so a mis-click can't wipe the token.
    expect(queryByLabelText('Clear value')).toBeNull();
  });

  it('clearing via the ✕ commits an empty value for that row', () => {
    const onChange = vi.fn();
    const rows = [makeKvRow({ key: 'Accept', value: 'application/json' })];
    const { getAllByLabelText } = render(<KeyValueTable rows={rows} onChange={onChange} />);
    // Value cell's ✕ — key/description cells have no rail, so the only
    // clear affordances belong to value cells; the first is our row's.
    getAllByLabelText('Clear value')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls[0][0];
    expect(next[0]).toMatchObject({ key: 'Accept', value: '' });
  });
});
