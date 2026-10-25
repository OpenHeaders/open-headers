// @vitest-environment jsdom
/**
 * Per-row `data-field-path` propagation through the RequestEditor's
 * Headers / Params tables.
 *
 * The shared `EditableGridTable` shell wraps every Key / Value /
 * Description cell with a layout-neutral `data-field-path` span when
 * the caller passes a `rowPath` callback. ParamsTab + HeadersTab pass
 * `REQUEST_PATHS.header(uid, leaf)` / `REQUEST_PATHS.param(uid, leaf)`
 * — set rows are uid-keyed (RequestHeaderSchema + QueryParamSchema
 * persist a stable per-row uid), so paths survive reorder + cross-
 * surface joins. The placeholder ghost reuses the synthesized makeKvRow
 * uid; once the user types it materializes with that same id. The Path
 * Parameters table (locked keys) tags Value / Description only — the
 * key is the URL's, read-only, with no path of its own.
 */

import { readFieldPath } from '@openheaders/ui/shared/awareness/field-path';
import HeadersTab from '@openheaders/ui/workbench/components/request-editor/HeadersTab';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import ParamsTab from '@openheaders/ui/workbench/components/request-editor/ParamsTab';
// Side-effect import — TemplateInput (rendered inside the value cell)
// reads workbench settings via `useSyncExternalStore`; the schema
// barrel registers default values so tests don't crash on first read.
import '@openheaders/ui/workbench/settings/schema';
import type { AuthConfig, RequestBody } from '@openheaders/core/types';
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

// 8-hex-char uids so the regex in request-conflict-adapter accepts them
// and the assertions read like the wire format.
function row(uid: string, key: string, value: string): KeyValueRow {
  return { uid, key, value, description: '', enabled: true };
}

const NO_BODY: RequestBody = { type: 'none' };
const NO_AUTH: AuthConfig = { type: 'none' };

describe('ParamsTab — per-row data-field-path', () => {
  it('wraps each cell with params.<uid>.<leaf>', () => {
    const rows: KeyValueRow[] = [row('aaaaaaaa', 'q', '1'), row('bbbbbbbb', 'r', '2')];
    const { container } = render(
      <ParamsTab rows={rows} onChange={vi.fn()} pathRows={[]} onPathChange={vi.fn()} url="" auth={NO_AUTH} />,
    );
    const wrappers = container.querySelectorAll<HTMLElement>('[data-field-path^="params."]');
    const paths = Array.from(wrappers).map((el) => el.dataset.fieldPath ?? '');
    expect(paths).toContain('params.aaaaaaaa.key');
    expect(paths).toContain('params.aaaaaaaa.value');
    expect(paths).toContain('params.aaaaaaaa.description');
    expect(paths).toContain('params.bbbbbbbb.key');
    expect(paths).toContain('params.bbbbbbbb.value');
  });

  it('focus-capture target inside a value cell resolves to params.<uid>.value', () => {
    const rows: KeyValueRow[] = [row('aaaaaaaa', 'q', '1')];
    const { container } = render(
      <ParamsTab rows={rows} onChange={vi.fn()} pathRows={[]} onPathChange={vi.fn()} url="" auth={NO_AUTH} />,
    );
    const wrapper = container.querySelector<HTMLElement>('[data-field-path="params.aaaaaaaa.value"]');
    expect(wrapper).not.toBeNull();
    const innerFocusable = wrapper?.querySelector<HTMLElement>('[contenteditable],input,textarea');
    expect(innerFocusable).not.toBeNull();
    expect(readFieldPath(innerFocusable ?? null)).toBe('params.aaaaaaaa.value');
  });
});

describe('HeadersTab — per-row data-field-path', () => {
  it('wraps each cell with headers.<uid>.<leaf>', () => {
    const rows: KeyValueRow[] = [row('cccccccc', 'X-Token', 'abc'), row('dddddddd', 'X-Trace', 'xyz')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} />);
    const wrappers = container.querySelectorAll<HTMLElement>('[data-field-path^="headers."]');
    const paths = Array.from(wrappers).map((el) => el.dataset.fieldPath ?? '');
    expect(paths).toContain('headers.cccccccc.key');
    expect(paths).toContain('headers.cccccccc.value');
    expect(paths).toContain('headers.dddddddd.key');
    expect(paths).toContain('headers.dddddddd.value');
  });

  it('focus on the key cell resolves to headers.<uid>.key', () => {
    const rows: KeyValueRow[] = [row('cccccccc', 'X-Token', 'abc')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} />);
    const wrapper = container.querySelector<HTMLElement>('[data-field-path="headers.cccccccc.key"]');
    expect(wrapper).not.toBeNull();
    // Key cell renders a rich `TemplateInput` (contentEditable) for
    // Params/Headers — accept either it or a plain input.
    const innerInput = wrapper?.querySelector<HTMLElement>('[contenteditable],input,textarea');
    expect(readFieldPath(innerInput ?? null)).toBe('headers.cccccccc.key');
  });

  it('placeholder ghost row gets its own uid-keyed path', () => {
    // EditableGridTable appends a placeholder ghost as the
    // (rows.length)-th row using the adapter's `makeEmpty()` — for
    // KeyValueTable that calls `makeKvRow()` which mints a fresh uid.
    // The cell wrappers tag the ghost with paths against that synthetic
    // uid; once the user types the ghost materializes with the same uid.
    const rows: KeyValueRow[] = [row('cccccccc', 'X-Token', 'abc')];
    const { container } = render(<HeadersTab rows={rows} onChange={vi.fn()} body={NO_BODY} auth={NO_AUTH} />);
    const allHeaderPaths = Array.from(container.querySelectorAll<HTMLElement>('[data-field-path^="headers."]')).map(
      (el) => el.dataset.fieldPath ?? '',
    );
    // First-row cells: 3 (key + value + description)
    // Ghost-row cells: 3 (key + value + description) under a fresh uid
    const ghostKeyPaths = allHeaderPaths.filter((p) => p.endsWith('.key') && p !== 'headers.cccccccc.key');
    expect(ghostKeyPaths.length).toBe(1);
    // Ghost uid is 8-char lowercase-alphanumeric per generateUid().
    expect(/^headers\.[a-z0-9]{8}\.key$/.test(ghostKeyPaths[0])).toBe(true);
  });
});

describe('ParamsTab — the Path Parameters table', () => {
  const url = 'https://api.openheaders.io/users/:userId/files/:fileId';

  it('tags Value / Description cells with pathParams.<uid>.<leaf> and gives the read-only key no path', () => {
    const pathRows: KeyValueRow[] = [row('aaaaaaaa', 'userId', '7'), row('bbbbbbbb', 'fileId', '')];
    const { container } = render(
      <ParamsTab rows={[]} onChange={vi.fn()} pathRows={pathRows} onPathChange={vi.fn()} url={url} auth={NO_AUTH} />,
    );
    const paths = Array.from(container.querySelectorAll<HTMLElement>('[data-field-path^="pathParams."]')).map(
      (el) => el.dataset.fieldPath ?? '',
    );
    expect(paths).toContain('pathParams.aaaaaaaa.value');
    expect(paths).toContain('pathParams.aaaaaaaa.description');
    expect(paths).toContain('pathParams.bbbbbbbb.value');
    expect(paths.some((p) => p.endsWith('.key'))).toBe(false);
    // Two rows, two leaves each — no ghost row's paths after them.
    expect(paths).toHaveLength(4);
    const keys = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="oh-grid-locked-key"]')).map(
      (el) => el.textContent,
    );
    expect(keys).toEqual(['userId', 'fileId']);
  });

  it('heads the locked column "Name" while the query table keeps "Key", and each heading carries its (i)', () => {
    const pathRows: KeyValueRow[] = [row('aaaaaaaa', 'userId', '7')];
    const { container } = render(
      <ParamsTab rows={[]} onChange={vi.fn()} pathRows={pathRows} onPathChange={vi.fn()} url={url} auth={NO_AUTH} />,
    );
    const headers = Array.from(container.querySelectorAll<HTMLElement>('[role="columnheader"], th')).map(
      (el) => el.textContent?.trim() ?? '',
    );
    const text = container.textContent ?? '';
    expect(headers.length === 0 ? text.includes('Name') : headers.includes('Name')).toBe(true);
    expect(text).toContain('Key');
    const triggers = Array.from(container.querySelectorAll<HTMLButtonElement>('button.oh-info-trigger')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(triggers).toEqual(['About Query Params', 'About Path Parameters']);
  });

  it('names the parameters without a value under the table, and only those', () => {
    const pathRows: KeyValueRow[] = [row('aaaaaaaa', 'userId', '7'), row('bbbbbbbb', 'fileId', '  ')];
    const { container } = render(
      <ParamsTab rows={[]} onChange={vi.fn()} pathRows={pathRows} onPathChange={vi.fn()} url={url} auth={NO_AUTH} />,
    );
    expect(container.querySelector('[data-testid="oh-path-params-missing"]')?.textContent).toBe(
      'No value for :fileId — sent as written.',
    );
    cleanup();
    const filled = [row('aaaaaaaa', 'userId', '7'), row('bbbbbbbb', 'fileId', '{{env.FILE}}')];
    const { container: clean } = render(
      <ParamsTab rows={[]} onChange={vi.fn()} pathRows={filled} onPathChange={vi.fn()} url={url} auth={NO_AUTH} />,
    );
    expect(clean.querySelector('[data-testid="oh-path-params-missing"]')).toBeNull();
  });

  it('shows the empty-state line when the URL names no parameter', () => {
    const { container } = render(
      <ParamsTab
        rows={[]}
        onChange={vi.fn()}
        pathRows={[]}
        onPathChange={vi.fn()}
        url="https://api.openheaders.io/users"
        auth={NO_AUTH}
      />,
    );
    expect(container.querySelector('[data-testid="oh-path-params-empty"]')?.textContent).toBe(
      'Type :name in the URL to add a path parameter.',
    );
    expect(container.querySelector('[data-testid="oh-grid-locked-key"]')).toBeNull();
  });
});
