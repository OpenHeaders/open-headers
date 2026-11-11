// @vitest-environment jsdom
/**
 * The merge editor's file rail: it renders whatever it is handed — one
 * file included, under its group — marks the open file, and hands a
 * click on any row back as that file's id. Collapsed, it is a strip of
 * one chip per file in the same order, wearing the caller's icon where
 * one is given and the kind glyph where none is.
 */

import {
  type MergeFile,
  MergeFileList,
  MergeFileStrip,
  type MergeRailVocabulary,
} from '@openheaders/ui/shared/merge-editor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const scrolledIntoView = vi.hoisted(() => {
  // The editor's barrel loads the code editor, which probes this jsdom-missing API at import.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = () => false;
  }
  // jsdom has no layout: the rail's "keep the open row in view" is recorded instead.
  const scrolled: string[] = [];
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this.textContent ?? '');
  };
  return scrolled;
});

const file = (id: string, group: string): MergeFile => ({
  id,
  label: id.slice(id.lastIndexOf('/') + 1),
  group,
  kind: 'modify',
  theirs: 'name: theirs\n',
  mine: 'name: mine\n',
  initialResult: 'name: mine\n',
});

const PROBE = file('requests/probe/request.yaml', 'requests/probe');
const ORDERS = file('notes/orders.md', 'notes');

const SECTIONED_PROBE: MergeFile = { ...PROBE, group: 'probe', section: 'api-requests' };
const SECTIONED_BODY: MergeFile = {
  ...PROBE,
  id: 'requests/probe/body.json',
  label: 'body.json',
  group: 'probe',
  section: 'api-requests',
};
const SECTIONED_ORDERS: MergeFile = { ...ORDERS, section: 'files' };
const RAIL: MergeRailVocabulary = {
  sections: [
    { id: 'api-requests', label: 'API Requests', icon: <i data-testid="section-api-requests" /> },
    { id: 'files', label: 'Files', icon: <i data-testid="section-files" /> },
  ],
  group: (_section, group) => ({ label: `dir:${group}`, icon: <i data-testid={`group-${group}`} /> }),
};

afterEach(cleanup);

describe('MergeFileList', () => {
  it('lists a single file under its group, as the open one', () => {
    render(
      <MergeFileList
        files={[PROBE]}
        activeFileId={PROBE.id}
        hunkCounts={new Map([[PROBE.id, 2]])}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('requests/probe')).toBeTruthy();
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe('·request.yaml2unresolved');
    expect(rows[0].getAttribute('aria-current')).toBe('true');
  });

  it('marks only the open file, and a click on another hands its id back', () => {
    const onSelect = vi.fn();
    render(<MergeFileList files={[PROBE, ORDERS]} activeFileId={PROBE.id} onSelect={onSelect} />);
    const [orders, probe] = screen.getAllByRole('button');
    expect(orders.textContent).toContain('orders.md');
    expect(orders.getAttribute('aria-current')).toBe('false');
    expect(probe.getAttribute('aria-current')).toBe('true');
    fireEvent.click(orders);
    expect(onSelect).toHaveBeenCalledWith(ORDERS.id);
  });

  it('keeps the open file’s row in view, and follows when another file opens', () => {
    scrolledIntoView.length = 0;
    const { rerender } = render(<MergeFileList files={[PROBE, ORDERS]} activeFileId={PROBE.id} onSelect={vi.fn()} />);
    expect(scrolledIntoView).toEqual(['·request.yamlunresolved']);
    rerender(<MergeFileList files={[PROBE, ORDERS]} activeFileId={ORDERS.id} onSelect={vi.fn()} />);
    expect(scrolledIntoView).toEqual(['·request.yamlunresolved', '·orders.mdunresolved']);
  });

  it('wears the caller’s icon before the name, and the kind glyph where the caller gives none', () => {
    const rail: MergeRailVocabulary = {
      sections: [],
      fileIcon: (shown) => (shown.id === PROBE.id ? <i data-testid="own-icon" /> : null),
    };
    render(<MergeFileList files={[PROBE, ORDERS]} activeFileId={PROBE.id} rail={rail} onSelect={vi.fn()} />);
    const [orders, probe] = screen.getAllByRole('button');
    expect(probe.querySelector('[data-testid="own-icon"]')).not.toBeNull();
    expect(probe.textContent).toBe('request.yamlunresolved');
    expect(orders.textContent).toBe('·orders.mdunresolved');
  });

  it('lists a named section under its glyph and label, its groups under theirs, the files under their group', () => {
    const { container } = render(
      <MergeFileList
        files={[SECTIONED_ORDERS, SECTIONED_PROBE]}
        activeFileId={SECTIONED_PROBE.id}
        rail={RAIL}
        onSelect={vi.fn()}
      />,
    );
    const sections = [...container.querySelectorAll('[data-section]')];
    expect(sections.map((section) => section.getAttribute('data-section'))).toEqual(['api-requests', 'files']);
    expect(sections[0].textContent).toBe('API Requestsdir:probe·request.yamlunresolved');
    expect(sections[0].querySelector('[data-testid="section-api-requests"]')).not.toBeNull();
    expect(sections[0].querySelector('[data-testid="group-probe"]')).not.toBeNull();
    expect(sections[1].textContent).toBe('Filesdir:notes·orders.mdunresolved');
  });
});

describe('MergeFileStrip', () => {
  const strip = (panelHidden: boolean, onSelect = vi.fn(), onPanelHidden = vi.fn()) => {
    render(
      <MergeFileStrip
        files={[SECTIONED_ORDERS, SECTIONED_PROBE, SECTIONED_BODY]}
        activeFileId={SECTIONED_ORDERS.id}
        hunkCounts={new Map([[SECTIONED_BODY.id, 2]])}
        rail={RAIL}
        panelHidden={panelHidden}
        onPanelHidden={onPanelHidden}
        onSelect={onSelect}
      />,
    );
    return { onSelect, onPanelHidden, chips: screen.getAllByRole('button') };
  };

  it('is one chip per section in the rail’s order, the open file’s section the active one', () => {
    const { chips } = strip(false);
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual(['API Requests', 'Files']);
    expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual(['false', 'true']);
    expect(chips[0].querySelector('[data-testid="section-api-requests"]')).not.toBeNull();
    expect(chips[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('counts each section’s files left to answer, and says nothing for a section with none', () => {
    strip(false);
    expect(screen.getAllByTestId('merge-file-strip-count').map((count) => count.textContent)).toEqual(['1']);
  });

  it('a click on another section opens its first file left to answer and shows the panel', () => {
    const { chips, onSelect, onPanelHidden } = strip(true);
    fireEvent.click(chips[0]);
    expect(onSelect).toHaveBeenCalledWith(SECTIONED_BODY.id);
    expect(onPanelHidden).toHaveBeenCalledWith(false);
  });

  it('a click on the active section shuts the panel, and brings it back when it is shut', () => {
    const shown = strip(false);
    fireEvent.click(shown.chips[1]);
    expect(shown.onPanelHidden).toHaveBeenCalledWith(true);
    expect(shown.onSelect).not.toHaveBeenCalled();
    cleanup();
    const shut = strip(true);
    fireEvent.click(shut.chips[1]);
    expect(shut.onPanelHidden).toHaveBeenCalledWith(false);
  });

  it('is one chip over all the files of a session that names no sections', () => {
    const onSelect = vi.fn();
    render(
      <MergeFileStrip
        files={[PROBE, ORDERS]}
        activeFileId={PROBE.id}
        panelHidden={false}
        onPanelHidden={vi.fn()}
        onSelect={onSelect}
      />,
    );
    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual(['2 files']);
    expect(chips[0].getAttribute('aria-current')).toBe('true');
  });
});
