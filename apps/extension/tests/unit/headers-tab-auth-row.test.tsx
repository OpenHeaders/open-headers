// @vitest-environment jsdom
/**
 * HeadersTab surfaces the auth-derived `Authorization` header as a
 * LOCKED, always-visible row — greyed check, placeholder value, no
 * inline editing (the Authorization tab is the way in) — the user sees
 * it the moment they pick an auth type, without expanding the "N
 * hidden" auto-generated section.
 * Browser-managed auto-headers (User-Agent, Accept, …) stay hidden until
 * that toggle is clicked. Regression guard for "I set Basic Auth and no
 * header appeared." Under Inherit the row describes the resolved
 * ancestor entry, its hint naming the level, so a user's duplicate
 * `Authorization` row is warned the same way.
 */

import type { AuthConfig, RequestBody } from '@openheaders/core/types';
import HeadersTab from '@openheaders/ui/workbench/components/request-editor/HeadersTab';
import type { InheritedAuthAttribution } from '@openheaders/ui/workbench/components/request-editor/inherited-auth';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
// Side-effect import — the user rows render TemplateInput, which reads
// workbench settings via useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, render, screen } from '@testing-library/react';
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

const NO_BODY: RequestBody = { type: 'none' };
const BASIC: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
const NO_AUTH: AuthConfig = { type: 'none' };
const BEARER_EMPTY: AuthConfig = { type: 'bearer', token: '' };
const BEARER: AuthConfig = { type: 'bearer', token: 'abc123' };

describe('HeadersTab — auth-derived Authorization row', () => {
  it('shows the Authorization row without expanding the hidden section', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={BASIC} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Authorization');
    expect(text).toContain('Basic');
    // Browser-managed auto-headers stay hidden until the toggle is clicked.
    expect(text).not.toContain('User-Agent');
  });

  it('renders no Authorization row when there is no auth', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} />,
    );
    expect(container.textContent ?? '').not.toContain('Authorization');
  });

  it('keeps the hidden-count label to the browser auto-headers only (auth row is visible, not hidden)', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={BASIC} />,
    );
    // Body is `none` → 6 browser auto-headers; the auth row is NOT among
    // them, so the toggle still reads "6 hidden".
    expect(container.textContent ?? '').toContain('6 hidden');
  });

  it('renders a bearer row as the scheme placeholder, locked — no editable field, no toggle', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={BEARER} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Bearer <token>');
    expect(text).not.toContain('abc123');
    expect(container.querySelector('[data-placeholder="bearer token"]')).toBeNull();
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.checked).toBe(true);
  });

  it('a saved suspended auth still reads as an unchecked, locked row', () => {
    const { container } = render(
      <HeadersTab
        rows={[] as KeyValueRow[]}
        onChange={vi.fn()}
        body={NO_BODY}
        auth={{ ...BEARER, disabled: true }}
      />,
    );
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.checked).toBe(false);
  });
});

const INHERIT: AuthConfig = { type: 'inherit' };
const BEARER_FROM_COLLECTION: InheritedAuthAttribution = {
  auth: { type: 'bearer', token: 'parent-token' },
  source: { kind: 'collection', uid: 'col00001', name: 'Payments', entryName: 'Admin token' },
};

describe('HeadersTab — the inherited Authorization row', () => {
  it('describes the resolved ancestor entry, locked, hinting the level', () => {
    const { container } = render(
      <HeadersTab
        rows={[] as KeyValueRow[]}
        onChange={vi.fn()}
        body={NO_BODY}
        auth={INHERIT}
        inheritedFrom={BEARER_FROM_COLLECTION}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Authorization');
    expect(text).toContain('Bearer');
    // The parent's credential never renders as an editable field.
    expect(container.querySelector('[data-placeholder="bearer token"]')).toBeNull();
    expect(text).not.toContain('parent-token');
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.checked).toBe(true);
  });

  it('renders no row while Inherit resolves to nothing known', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={INHERIT} />,
    );
    expect(container.textContent ?? '').not.toContain('Authorization');
  });

  it("warns a user's duplicate Authorization row under an inherited auth", () => {
    const rows: KeyValueRow[] = [{ uid: 'row00001', key: 'Authorization', value: 'custom', enabled: true }];
    render(
      <HeadersTab
        rows={rows}
        onChange={vi.fn()}
        body={NO_BODY}
        auth={INHERIT}
        inheritedFrom={BEARER_FROM_COLLECTION}
      />,
    );
    expect(screen.getByTestId('oh-kv-row-warning')).toBeTruthy();
  });
});
