// @vitest-environment jsdom
/**
 * HeadersTab surfaces the auth-derived `Authorization` header as a
 * locked, ALWAYS-VISIBLE row — the user sees it the moment they pick an
 * auth type, without expanding the "N hidden" auto-generated section.
 * Browser-managed auto-headers (User-Agent, Accept, …) stay hidden until
 * that toggle is clicked. Regression guard for "I set Basic Auth and no
 * header appeared."
 */

import type { AuthConfig, RequestBody } from '@openheaders/core/types';
import HeadersTab from '@openheaders/ui/workbench/components/request-editor/HeadersTab';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
// Side-effect import — the user rows render TemplateInput, which reads
// workbench settings via useSyncExternalStore.
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

const NO_BODY: RequestBody = { type: 'none' };
const BASIC: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
const NO_AUTH: AuthConfig = { type: 'none' };

describe('HeadersTab — auth-derived Authorization row', () => {
  it('shows the Authorization row without expanding the hidden section', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={BASIC} onAuthChange={vi.fn()} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Authorization');
    expect(text).toContain('Basic');
    // Browser-managed auto-headers stay hidden until the toggle is clicked.
    expect(text).not.toContain('User-Agent');
  });

  it('renders no Authorization row when there is no auth', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} onAuthChange={vi.fn()} />,
    );
    expect(container.textContent ?? '').not.toContain('Authorization');
  });

  it('keeps the hidden-count label to the browser auto-headers only (auth row is visible, not hidden)', () => {
    const { container } = render(
      <HeadersTab rows={[] as KeyValueRow[]} onChange={vi.fn()} body={NO_BODY} auth={BASIC} onAuthChange={vi.fn()} />,
    );
    // Body is `none` → 6 browser auto-headers; the auth row is NOT among
    // them, so the toggle still reads "6 hidden".
    expect(container.textContent ?? '').toContain('6 hidden');
  });
});
