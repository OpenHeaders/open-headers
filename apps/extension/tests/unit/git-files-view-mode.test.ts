// @vitest-environment jsdom
/**
 * The View Mode of the changed-files trees — one choice per workspace
 * (`files-view-mode`) — and the rows every View Options eye opens with
 * (`files-view-menu`). Pins: Workspace until the person picks
 * Files, the pick kept per workspace and read back from storage, a slot
 * that holds neither mode read as the default; the menu marks ONE mode,
 * a pick of a mode sets it (the marked one included — it never
 * unsets), Group Files by Directory flips on its own, and a key that is
 * another row's is left to its owner.
 */

import { CheckOutlined } from '@ant-design/icons';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  DEFAULT_FILES_VIEW_MODE,
  getFilesViewMode,
  setFilesViewMode,
} from '@openheaders/ui/workbench/components/panels/git/files-view-mode';
import {
  type FilesView,
  filesViewMenuItems,
  pickFilesViewMenu,
} from '@openheaders/ui/workbench/components/panels/git/toolbar/files-view-menu';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const t: Translate = (key: string) => key;

function viewOf(overrides: Partial<FilesView> = {}): FilesView {
  return {
    mode: 'items',
    onModeChange: vi.fn(),
    groupByDirectory: false,
    onGroupByDirectoryChange: vi.fn(),
    ...overrides,
  };
}

/** The menu's rows that take a pick, by key, with whether each is marked. */
function marked(view: FilesView): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const walk = (items: ReturnType<typeof filesViewMenuItems>): void => {
    for (const item of items) {
      if (item === null) continue;
      if ('children' in item && item.children !== undefined) walk(item.children);
      else if ('icon' in item && typeof item.key === 'string') {
        out[item.key] = isValidElement(item.icon) && item.icon.type === CheckOutlined;
      }
    }
  };
  walk(filesViewMenuItems(t, view));
  return out;
}

describe('files view mode', () => {
  it('is Workspace until Files is picked, per workspace', () => {
    expect(DEFAULT_FILES_VIEW_MODE).toBe('items');
    expect(getFilesViewMode('ws-a')).toBe('items');
    setFilesViewMode('ws-a', 'files');
    expect(getFilesViewMode('ws-a')).toBe('files');
    expect(getFilesViewMode('ws-b')).toBe('items');
    expect(JSON.parse(localStorage.getItem('oh:gitFilesView:ws-a') ?? '{}')).toEqual({ mode: 'files' });
  });

  it('reads a kept pick back, and a slot that holds neither mode as the default', () => {
    localStorage.setItem('oh:gitFilesView:ws-kept', JSON.stringify({ mode: 'files' }));
    localStorage.setItem('oh:gitFilesView:ws-odd', JSON.stringify({ mode: 'tree' }));
    expect(getFilesViewMode('ws-kept')).toBe('files');
    expect(getFilesViewMode('ws-odd')).toBe('items');
  });
});

describe('files view menu', () => {
  it('marks one mode, and Group Files by Directory on its own', () => {
    expect(marked(viewOf())).toEqual({
      'view-mode-items': true,
      'view-mode-files': false,
      'group-files-by-directory': false,
    });
    expect(marked(viewOf({ mode: 'files', groupByDirectory: true }))).toEqual({
      'view-mode-items': false,
      'view-mode-files': true,
      'group-files-by-directory': true,
    });
  });

  it('a pick of a mode sets it — the marked one too, it never unsets', () => {
    const view = viewOf();
    expect(pickFilesViewMenu('view-mode-files', view)).toBe(true);
    expect(view.onModeChange).toHaveBeenLastCalledWith('files');
    expect(pickFilesViewMenu('view-mode-items', view)).toBe(true);
    expect(view.onModeChange).toHaveBeenLastCalledWith('items');
    expect(view.onGroupByDirectoryChange).not.toHaveBeenCalled();
  });

  it('Group Files by Directory flips, and another row’s key is left to its owner', () => {
    const view = viewOf({ groupByDirectory: true });
    expect(pickFilesViewMenu('group-files-by-directory', view)).toBe(true);
    expect(view.onGroupByDirectoryChange).toHaveBeenCalledWith(false);
    expect(pickFilesViewMenu('ignored', view)).toBe(false);
    expect(view.onModeChange).not.toHaveBeenCalled();
  });
});
