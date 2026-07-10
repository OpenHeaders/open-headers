// @vitest-environment jsdom
/**
 * CollectionPickerPanel contract — the app-standard collection picker
 * the import modals embed: rows select (not drill), the pinned
 * "New collection" row is always reachable (search never filters it
 * out, empty workspaces preselect it upstream), and the search input
 * hosts ↑↓/Enter keyboard selection.
 */

import type { Collection } from '@openheaders/core/types';
import CollectionPickerPanel, {
  NEW_COLLECTION_VALUE,
} from '@openheaders/ui/workbench/components/collection-picker/CollectionPickerPanel';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

function makeCollection(uid: string, name: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${uid}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

const collections = [makeCollection('col00001', 'api.openheaders.io'), makeCollection('col00002', 'Auth flows')];

describe('CollectionPickerPanel', () => {
  it('selects a collection row on click', () => {
    const onChange = vi.fn();
    render(
      <CollectionPickerPanel
        collections={collections}
        value={null}
        onChange={onChange}
        newCollectionName="imported.openheaders.io"
      />,
    );
    fireEvent.click(screen.getByText('Auth flows'));
    expect(onChange).toHaveBeenCalledWith('col00002');
  });

  it('selects the sentinel via the pinned New collection row', () => {
    const onChange = vi.fn();
    render(
      <CollectionPickerPanel
        collections={collections}
        value={null}
        onChange={onChange}
        newCollectionName="imported.openheaders.io"
      />,
    );
    expect(screen.getByText('“imported.openheaders.io”')).toBeTruthy();
    fireEvent.click(screen.getByText('New collection'));
    expect(onChange).toHaveBeenCalledWith(NEW_COLLECTION_VALUE);
  });

  it('search filters collections but keeps the pinned row', () => {
    render(
      <CollectionPickerPanel
        collections={collections}
        value={null}
        onChange={() => {}}
        newCollectionName="imported.openheaders.io"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('Search for collection'), { target: { value: 'auth' } });
    expect(screen.queryByText('api.openheaders.io')).toBeNull();
    expect(screen.getByText('Auth flows')).toBeTruthy();
    expect(screen.getByText('New collection')).toBeTruthy();
  });

  it('marks the selected row and empty workspaces explain the auto-create', () => {
    const { container } = render(
      <CollectionPickerPanel
        collections={[]}
        value={NEW_COLLECTION_VALUE}
        onChange={() => {}}
        newCollectionName="imported.openheaders.io"
      />,
    );
    expect(screen.getByText('No collections yet — one is created for you on import.')).toBeTruthy();
    const selected = container.querySelector('[aria-selected="true"]');
    expect(selected?.textContent).toContain('New collection');
  });

  it('ArrowDown + Enter in the search input selects the focused row', () => {
    const onChange = vi.fn();
    render(
      <CollectionPickerPanel
        collections={collections}
        value="col00001"
        onChange={onChange}
        newCollectionName="imported.openheaders.io"
      />,
    );
    const search = screen.getByPlaceholderText('Search for collection');
    // Focus starts at the selected row (col00001) → ArrowDown lands on col00002.
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('col00002');
  });

  it('Enter on the already-selected row fires onConfirm (Enter-Enter imports)', () => {
    const onChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <CollectionPickerPanel
        collections={collections}
        value="col00001"
        onChange={onChange}
        onConfirm={onConfirm}
        newCollectionName="imported.openheaders.io"
      />,
    );
    const search = screen.getByPlaceholderText('Search for collection');
    // Focus starts at the selected row — first Enter re-selects AND confirms.
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('col00001');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // A row that is NOT selected only selects; no confirm.
    onConfirm.mockClear();
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('col00002');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
