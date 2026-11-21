// @vitest-environment jsdom
/**
 * Settings › search results pane — what one keystroke is allowed to
 * cost: a query matching most of the registry mounts one batch of rows,
 * not the registry; and a row whose editor is still loading holds back
 * only itself, never the list it sits in. And what a result shows for
 * WHY it is there: hits painted in its label and breadcrumb, a line of
 * its description for a match the label doesn't carry — none of it on
 * a row outside a results list.
 */

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema';
import SearchResultsPane from '@openheaders/ui/workbench/settings/components/SearchResultsPane';
import SettingRow from '@openheaders/ui/workbench/settings/fields/SettingRow';
import { registerCategory, registerSetting, requireDef } from '@openheaders/ui/workbench/settings/registry';
import { searchSettings } from '@openheaders/ui/workbench/settings/search';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import type { SettingDef } from '@openheaders/ui/workbench/settings/types';
import { act, cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { lazy, useRef } from 'react';
import * as v from 'valibot';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The row resolver reaches every field kind; the code field's editor is
// Monaco, which probes the clipboard at module load — not this pin's subject.
vi.mock('@openheaders/ui/workbench/settings/fields/CodeField', () => ({ default: () => null }));

declare module '@openheaders/ui/workbench/settings/types' {
  interface SettingsMap {
    'paneTest.plain': boolean;
    'paneTest.lazy': boolean;
  }
}

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

/** An observer that never reports — the pane stays on its first batch. */
class SilentIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const LazyEditorBody: React.FC<{ def: SettingDef }> = ({ def }) => <div data-testid="lazy-editor">{def.key}</div>;

let deliverLazyEditor: () => void = () => {};
const LazyEditor = lazy(
  () =>
    new Promise<{ default: React.FC<{ def: SettingDef }> }>((resolve) => {
      deliverLazyEditor = () => resolve({ default: LazyEditorBody });
    }),
);

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);

  registerCategory({ id: 'paneTest', label: 'Pane Test', icon: null, order: 99_000 });
  registerSetting({
    key: 'paneTest.plain',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'Plain Wombat',
    description: 'A row with a built-in field, kept for the quokka pin.',
    category: 'paneTest',
    scope: 'user',
  });
  registerSetting({
    key: 'paneTest.lazy',
    type: 'boolean',
    default: false,
    schema: v.boolean(),
    label: 'Lazy Row',
    description: 'A row whose editor is code-split.',
    category: 'paneTest',
    scope: 'user',
    customEditor: LazyEditor,
  });
});

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
});

const Harness: React.FC<{ query: string }> = ({ query }) => {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={scrollRootRef}>
      <SearchResultsPane
        results={searchSettings(query)}
        query={query}
        onJumpToCategory={() => {}}
        scrollRootRef={scrollRootRef}
      />
    </div>
  );
};

const mountedRows = (): number => document.querySelectorAll('[data-setting-key]').length;

const plainRow = (): Element => {
  const row = document.querySelector('[data-setting-key="paneTest.plain"]');
  if (row === null) throw new Error('the plain row is not mounted');
  return row;
};

const painted = (root: ParentNode): string[] =>
  Array.from(root.querySelectorAll('mark.settings-search-match'), (mark) => mark.textContent ?? '');

const snippets = (): Element[] => Array.from(document.querySelectorAll('.settings-search-snippet'));

describe('the search results pane', () => {
  it('mounts one batch of rows for a query that matches most of the registry', () => {
    vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver);
    const matches = searchSettings('e').length;
    expect(matches).toBeGreaterThan(100);

    render(<Harness query="e" />);

    // The count the user reads is the whole match set; the rows under
    // it are the first batch (a row hidden by its `when` mounts nothing).
    expect(screen.getByText(new RegExp(`^${matches} `))).toBeTruthy();
    expect(mountedRows()).toBeGreaterThan(0);
    expect(mountedRows()).toBeLessThanOrEqual(40);
  });

  it('shows the rest of the list while one row’s code-split editor is still loading', async () => {
    vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver);
    expect(requireDef('paneTest.lazy').customEditor).toBe(LazyEditor);

    render(<Harness query="paneTest" />);

    expect(document.querySelector('[data-setting-key="paneTest.plain"]')).not.toBeNull();
    expect(screen.queryByTestId('lazy-editor')).toBeNull();

    await act(async () => {
      deliverLazyEditor();
    });

    expect(screen.getByTestId('lazy-editor').textContent).toBe('paneTest.lazy');
  });

  it('paints a label hit where it stands and adds no line when the label explains the match', () => {
    vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver);

    render(<Harness query="wom pl" />);

    expect(painted(plainRow())).toEqual(['Pl', 'Wom']);
    expect(plainRow().textContent).toContain('Plain Wombat');
    expect(snippets()).toEqual([]);
  });

  it('explains a description-only match with one line of the description under the row', () => {
    vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver);

    render(<Harness query="quokka" />);

    expect(painted(plainRow())).toEqual([]);
    const [snippet] = snippets();
    expect(snippets()).toHaveLength(1);
    expect(plainRow().nextElementSibling).toBe(snippet);
    // The hit sits past the lead, so the line opens near it.
    expect(snippet.textContent).toBe('…a built-in field, kept for the quokka pin.');
    expect(painted(snippet)).toEqual(['quokka']);
  });

  it('paints a category hit in the group’s breadcrumb', () => {
    vi.stubGlobal('IntersectionObserver', SilentIntersectionObserver);

    render(<Harness query="pane wombat" />);

    const breadcrumb = plainRow().closest('section')?.querySelector('button[title="Jump to category"]');
    expect(breadcrumb?.textContent).toBe('Pane Test');
    expect(painted(breadcrumb ?? document)).toEqual(['Pane']);
  });

  it('renders a row outside a results list plain — no paint, no line', () => {
    render(<SettingRow def={requireDef('paneTest.plain')} />);

    expect(plainRow().textContent).toContain('Plain Wombat');
    expect(painted(document)).toEqual([]);
    expect(snippets()).toEqual([]);
  });
});
