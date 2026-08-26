// @vitest-environment jsdom
/**
 * ShellLayout — the CSS-track shell. One grid hosts every region; a
 * closed region is display-toggled (never unmounted), an alignment
 * change only swaps the grid's areas (the editor keeps its DOM node),
 * and a sash drag writes the pane's size var and reports the live
 * widths to the host exactly once, on release.
 */

import {
  type BottomPanelAlignment,
  createFocusStore,
  type DockLayoutApi,
  SHELL_TRACK_VARS,
  ShellLayout,
  type ToolWindowDef,
  useDockLayout,
} from '@openheaders/ui/shared/dock-layout';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type Id = 'tree' | 'docs' | 'term';

const DEFS: readonly ToolWindowDef<Id>[] = [
  { id: 'tree', icon: 'T', core: true, defaultSlot: 'left-top', label: 'Tree' },
  { id: 'docs', icon: 'D', core: true, defaultSlot: 'right-top', label: 'Docs' },
  { id: 'term', icon: '>', core: true, defaultSlot: 'bottom-left', label: 'Terminal' },
];
const MAP = Object.fromEntries(DEFS.map((d) => [d.id, d])) as Record<Id, ToolWindowDef<Id>>;
const SIZES = {
  sidebar: { preferred: 300, min: 200, max: 600 },
  inspector: { preferred: 320, min: 200, max: 600 },
  bottom: { preferred: 240, min: 100, max: 500 },
  editorMin: 400,
};

beforeAll(() => {
  // jsdom ships neither PointerEvent nor pointer capture; the sash uses both.
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  Object.defineProperty(window, 'PointerEvent', { value: PointerEventPolyfill, configurable: true });
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
});

afterEach(cleanup);

interface HarnessProps {
  alignment: BottomPanelAlignment;
  onHorizontalResize: (sizes: number[]) => void;
  expose: (tl: DockLayoutApi<Id>) => void;
}

const focusStore = createFocusStore();

const Harness: React.FC<HarnessProps> = ({ alignment, onHorizontalResize, expose }) => {
  const tl = useDockLayout<Id>({ windowDefs: DEFS, windowMap: MAP, focusStore });
  expose(tl);
  return (
    <ShellLayout<Id>
      tl={tl}
      windowMap={MAP}
      renderToolWindow={(id) => <div data-body={id} />}
      renderEditor={() => <div data-editor="" />}
      onHorizontalResize={onHorizontalResize}
      onVerticalResize={() => {}}
      bottomPanelAlignment={alignment}
      showToolWindowLabels
      sidebarLayout="proportional"
      onToggleLabels={() => {}}
      activityBarWidths={{ left: 78, right: 78 }}
      onActivityBarResize={() => {}}
      sizes={SIZES}
      focusStore={focusStore}
    />
  );
};

function mount(alignment: BottomPanelAlignment = 'center') {
  const onHorizontalResize = vi.fn();
  let tl: DockLayoutApi<Id> | null = null;
  const api = render(
    <Harness
      alignment={alignment}
      onHorizontalResize={onHorizontalResize}
      expose={(next) => {
        tl = next;
      }}
    />,
  );
  const grid = api.container.querySelector<HTMLElement>('.rules-shell-grid');
  if (!grid) throw new Error('shell grid missing');
  return { ...api, grid, onHorizontalResize, tl: () => tl as DockLayoutApi<Id> };
}

describe('ShellLayout — CSS-track shell', () => {
  it('renders one grid carrying the host sizes as custom properties', () => {
    const { grid } = mount();
    expect(grid.classList.contains('rules-shell-grid--align-center')).toBe(true);
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.barLeft)).toBe('78px');
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.sidebar)).toBe('300px');
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.inspector)).toBe('320px');
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.bottom)).toBe('240px');
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.editorMin)).toBe('400px');
    for (const cell of ['left', 'editor', 'right', 'bottom']) {
      expect(grid.querySelector(`.rules-shell-cell--${cell}`)).toBeTruthy();
    }
  });

  it('a closed region is display-toggled and zeroes its track via a class, never unmounted', () => {
    const { grid, tl, container } = mount();
    act(() => tl().activateWindow('tree'));
    const before = container.querySelector('[data-body="tree"]');
    expect(before).toBeTruthy();
    expect(grid.classList.contains('rules-shell-grid--left-closed')).toBe(false);

    act(() => tl().toggleRegion('left'));
    const leftCell = grid.querySelector<HTMLElement>('.rules-shell-cell--left');
    expect(leftCell?.style.display).toBe('none');
    expect(grid.classList.contains('rules-shell-grid--left-closed')).toBe(true);
    expect(container.querySelector('[data-body="tree"]')).toBe(before);
    // The remembered size survives the close.
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.sidebar)).toBe('300px');

    act(() => tl().toggleRegion('left'));
    expect(leftCell?.style.display).toBe('');
    expect(grid.classList.contains('rules-shell-grid--left-closed')).toBe(false);
  });

  it('an alignment change swaps grid areas without remounting the editor', () => {
    const onHorizontalResize = vi.fn();
    const expose = () => {};
    const api = render(<Harness alignment="center" onHorizontalResize={onHorizontalResize} expose={expose} />);
    const editor = api.container.querySelector('[data-editor]');
    api.rerender(<Harness alignment="justify" onHorizontalResize={onHorizontalResize} expose={expose} />);
    const grid = api.container.querySelector<HTMLElement>('.rules-shell-grid');
    expect(grid?.classList.contains('rules-shell-grid--align-justify')).toBe(true);
    expect(api.container.querySelector('[data-editor]')).toBe(editor);
  });

  it('a sidebar sash drag writes the size var per move and reports widths once on release', () => {
    const { grid, onHorizontalResize } = mount();
    const sash = grid.querySelector<HTMLElement>('.rules-shell-cell--left > .oh-sash');
    if (!sash) throw new Error('sidebar sash missing');

    fireEvent.pointerDown(sash, { button: 0, clientX: 100, pointerId: 1 });
    expect(document.documentElement.classList.contains('oh-sash-dragging-x')).toBe(true);
    fireEvent.pointerMove(sash, { clientX: 160, pointerId: 1 });
    // jsdom has no layout, so every measurement is 0 and the session
    // clamps to the pane minimum — the write path is what's under test.
    expect(grid.style.getPropertyValue(SHELL_TRACK_VARS.sidebar)).toBe(`${SIZES.sidebar.min}px`);
    expect(onHorizontalResize).not.toHaveBeenCalled();

    fireEvent.pointerUp(sash, { pointerId: 1 });
    expect(document.documentElement.classList.contains('oh-sash-dragging-x')).toBe(false);
    expect(onHorizontalResize).toHaveBeenCalledTimes(1);
    expect(onHorizontalResize).toHaveBeenCalledWith([0, 0, 0]);
  });

  it('labeled rails carry a sash on their inner edge', () => {
    const { grid } = mount();
    expect(grid.querySelector('.rules-shell-bar--left > .oh-sash.oh-sash--end')).toBeTruthy();
    expect(grid.querySelector('.rules-shell-bar--right > .oh-sash.oh-sash--start')).toBeTruthy();
  });
});
