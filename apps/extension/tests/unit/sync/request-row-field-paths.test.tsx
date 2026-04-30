// @vitest-environment jsdom
/**
 * Per-row `data-field-path` propagation through the RequestEditor's
 * Headers / Params tables.
 *
 * The shared `EditableGridTable` shell wraps every Key / Value /
 * Description cell with a layout-neutral `data-field-path` span when
 * the caller passes a `rowPath` callback. ParamsTab + HeadersTab pass
 * `requestRowPath('headers' | 'params', index, leaf)` so awareness
 * surfaces collide on the canonical schema-aligned path string
 * (`headers.0.value`, `params.2.key`) — the same path a future
 * cross-surface request inspector publishes.
 */

import { readFieldPath } from '@/shared/awareness/field-path';
import HeadersTab from '@/workbench/components/request-editor/HeadersTab';
import type { KeyValueRow } from '@/workbench/components/request-editor/KeyValueTable';
import ParamsTab from '@/workbench/components/request-editor/ParamsTab';
// Side-effect import — TemplateInput (rendered inside the value cell)
// reads workbench settings via `useSyncExternalStore`; the schema
// barrel registers default values so tests don't crash on first read.
import '@/workbench/settings/schema';
import type { V5 } from '@openheaders/core/types';
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

function row(uid: string, key: string, value: string): KeyValueRow {
  return { uid, key, value, description: '', enabled: true };
}

const NO_BODY: V5.RequestBody = { type: 'none' };

describe('ParamsTab — per-row data-field-path', () => {
  it('wraps each cell with params.{index}.{leaf}', () => {
    const rows: KeyValueRow[] = [row('p-0', 'q', '1'), row('p-1', 'r', '2')];
    const { container } = render(<ParamsTab rows={rows} onChange={vi.fn()} />);
    // Probe the value cells — they're the dominant collision target
    // (template variables flow through them) so verifying both rows
    // covers the index-shape claim.
    const valueWrappers = container.querySelectorAll<HTMLElement>('[data-field-path^="params."]');
    const paths = Array.from(valueWrappers).map((el) => el.dataset.fieldPath ?? '');
    expect(paths).toContain('params.0.key');
    expect(paths).toContain('params.0.value');
    expect(paths).toContain('params.0.description');
    expect(paths).toContain('params.1.key');
    expect(paths).toContain('params.1.value');
  });

  it('focus-capture target inside a value cell resolves to params.{index}.value', () => {
    const rows: KeyValueRow[] = [row('p-0', 'q', '1')];
    const { container } = render(<ParamsTab rows={rows} onChange={vi.fn()} />);
    const wrapper = container.querySelector<HTMLElement>('[data-field-path="params.0.value"]');
    expect(wrapper).not.toBeNull();
    // Value cells render a TemplateInput (contentEditable div), not a
    // plain input — query for any focusable descendant.
    const innerFocusable = wrapper?.querySelector<HTMLElement>('[contenteditable],input,textarea');
    expect(innerFocusable).not.toBeNull();
    expect(readFieldPath(innerFocusable ?? null)).toBe('params.0.value');
  });
});

describe('HeadersTab — per-row data-field-path', () => {
  it('wraps each cell with headers.{index}.{leaf}', () => {
    const rows: KeyValueRow[] = [row('h-0', 'X-Token', 'abc'), row('h-1', 'X-Trace', 'xyz')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} />);
    const wrappers = container.querySelectorAll<HTMLElement>('[data-field-path^="headers."]');
    const paths = Array.from(wrappers).map((el) => el.dataset.fieldPath ?? '');
    expect(paths).toContain('headers.0.key');
    expect(paths).toContain('headers.0.value');
    expect(paths).toContain('headers.1.key');
    expect(paths).toContain('headers.1.value');
  });

  it('focus on the key cell resolves to headers.{index}.key', () => {
    const rows: KeyValueRow[] = [row('h-0', 'X-Token', 'abc')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} />);
    const wrapper = container.querySelector<HTMLElement>('[data-field-path="headers.0.key"]');
    expect(wrapper).not.toBeNull();
    const innerInput = wrapper?.querySelector<HTMLInputElement>('input');
    expect(readFieldPath(innerInput ?? null)).toBe('headers.0.key');
  });

  it('placeholder ghost row gets the next index path', () => {
    // ParamsTab / HeadersTab append a placeholder ghost as the
    // (rows.length)-th row. Its cells share the same scheme — once
    // the user types into them the row materializes at the same index.
    const rows: KeyValueRow[] = [row('h-0', 'X-Token', 'abc')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} />);
    const ghostKeyWrapper = container.querySelector<HTMLElement>('[data-field-path="headers.1.key"]');
    expect(ghostKeyWrapper).not.toBeNull();
  });
});
