// @vitest-environment jsdom
/**
 * `FileTreeView` on the shared selection model: rows select across
 * dirs and files, the caret alone toggles a dir, the keys walk and
 * fold the tree, and the pane hears the one file its verbs act on.
 */

import FileTreeView from '@openheaders/ui/workbench/components/panels/git/FileTreeView';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const FILES = [
  { path: 'docs/guides/auth.md', status: 'M' },
  { path: 'docs/guides/tokens.md', status: 'A' },
  { path: 'README.md', status: 'M' },
];

// jsdom lacks the CSS.escape the tree's keyboard scroll uses, and scrollIntoView.
beforeAll(() => {
  const scope = globalThis as unknown as { CSS?: { escape(v: string): string } };
  if (typeof scope.CSS === 'undefined' || typeof scope.CSS.escape !== 'function') {
    scope.CSS = { ...scope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

afterEach(() => {
  cleanup();
});

const byKey = (key: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-row-key="${key}"]`);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};
const selectedKeys = (): string[] =>
  [...document.querySelectorAll('[data-row-key][data-selected="true"]')].map(
    (el) => el.getAttribute('data-row-key') ?? '',
  );

function renderTree() {
  const onSelectFile = vi.fn<(path: string | null) => void>();
  const onOpenFile = vi.fn<(path: string) => void>();
  render(
    <FileTreeView
      files={FILES}
      loadingPath={null}
      onOpenFile={onOpenFile}
      selectedPath={null}
      onSelectFile={onSelectFile}
    />,
  );
  return { onSelectFile, onOpenFile };
}

describe('FileTreeView — selection', () => {
  it('a click selects a file and reports it; Shift+click ranges across the dir and its files', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey('docs/guides/auth.md'));
    expect(selectedKeys()).toEqual(['docs/guides/auth.md']);
    expect(onSelectFile).toHaveBeenLastCalledWith('docs/guides/auth.md');
    fireEvent.click(byKey('README.md'), { shiftKey: true });
    expect(selectedKeys()).toEqual(['docs/guides/auth.md', 'docs/guides/tokens.md', 'README.md']);
    expect(onSelectFile).toHaveBeenLastCalledWith('README.md');
  });

  it('a dir row selects (no fold) and reports no file; its caret folds it', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey('docs/guides'));
    expect(selectedKeys()).toEqual(['docs/guides']);
    expect(onSelectFile).toHaveBeenLastCalledWith(null);
    expect(screen.getAllByTestId('git-tool-file')).toHaveLength(3);
    const caret = byKey('docs/guides').querySelector('span');
    if (!caret) throw new Error('no caret');
    fireEvent.click(caret);
    expect(screen.getAllByTestId('git-tool-file')).toHaveLength(1);
  });

  it('toggling the reported file out hands the verbs the first selected file', () => {
    const { onSelectFile } = renderTree();
    fireEvent.click(byKey('docs/guides/auth.md'));
    fireEvent.click(byKey('README.md'), { metaKey: true });
    expect(onSelectFile).toHaveBeenLastCalledWith('README.md');
    fireEvent.click(byKey('README.md'), { metaKey: true });
    expect(selectedKeys()).toEqual(['docs/guides/auth.md']);
    expect(onSelectFile).toHaveBeenLastCalledWith('docs/guides/auth.md');
  });

  it('the keys walk the rows, Left folds a dir and Right opens it, Enter opens the cursor’s file', () => {
    const { onSelectFile, onOpenFile } = renderTree();
    const tree = screen.getByTestId('git-tool-file-tree');
    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(selectedKeys()).toEqual(['docs/guides']);
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(screen.getAllByTestId('git-tool-file')).toHaveLength(1);
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(screen.getAllByTestId('git-tool-file')).toHaveLength(3);
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(selectedKeys()).toEqual(['docs/guides/auth.md']);
    fireEvent.keyDown(tree, { key: 'ArrowDown', shiftKey: true });
    expect(selectedKeys()).toEqual(['docs/guides/auth.md', 'docs/guides/tokens.md']);
    expect(onSelectFile).toHaveBeenLastCalledWith('docs/guides/tokens.md');
    fireEvent.keyDown(tree, { key: 'Enter' });
    expect(onOpenFile).toHaveBeenCalledWith('docs/guides/tokens.md');
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(selectedKeys()).toEqual(['docs/guides']);
  });

  it('without a selection handler a click opens the file and a dir click folds it', () => {
    const onOpenFile = vi.fn<(path: string) => void>();
    render(<FileTreeView files={FILES} loadingPath={null} onOpenFile={onOpenFile} />);
    fireEvent.click(byKey('README.md'));
    expect(onOpenFile).toHaveBeenCalledWith('README.md');
    fireEvent.click(byKey('docs/guides'));
    expect(screen.getAllByTestId('git-tool-file')).toHaveLength(1);
    expect(selectedKeys()).toEqual([]);
  });
});
