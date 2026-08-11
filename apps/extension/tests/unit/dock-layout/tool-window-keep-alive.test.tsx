// @vitest-environment jsdom
/**
 * DockBodyStack — lazy keep-alive tool-window bodies. A window's body
 * first mounts when it first becomes the dock's active tab and stays
 * mounted (display-toggled) from then on, so panel state survives tab
 * switches and dock close/reopen. Only leaving the dock (hide, drag to
 * another slot) unmounts a body.
 */

import { DockBodyStack } from '@openheaders/ui/shared/dock-layout';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const renderStack = (windows: readonly string[], active: string | null) => (
  <DockBodyStack
    windows={windows}
    active={active}
    slot="bottom-left"
    renderToolWindow={(id) => <div data-body-id={id} />}
  />
);

describe('DockBodyStack — lazy keep-alive tool-window bodies', () => {
  it('mounts only the active body on first render, not every resident window', () => {
    const { container } = render(renderStack(['terminal', 'git', 'traffic-monitor'], 'git'));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(1);
    expect(container.querySelector('[data-body-id="git"]')).toBeTruthy();
  });

  it('an activated body stays mounted after switching away; never-activated stays unmounted', () => {
    const windows = ['terminal', 'git', 'traffic-monitor'];
    const { container, rerender } = render(renderStack(windows, 'git'));

    rerender(renderStack(windows, 'terminal'));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(2);

    rerender(renderStack(windows, 'git'));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(2);
    expect(container.querySelector('[data-body-id="traffic-monitor"]')).toBeNull();
  });

  it('display-toggles: the active wrapper is visible, mounted inactive ones are hidden', () => {
    const windows = ['terminal', 'git'];
    const { container, rerender } = render(renderStack(windows, 'terminal'));
    rerender(renderStack(windows, 'git'));

    const wrappers = [...container.querySelectorAll<HTMLElement>('.rules-dock-keepalive')];
    expect(wrappers).toHaveLength(2);
    expect(wrappers[0].classList.contains('rules-dock-keepalive--hidden')).toBe(true);
    expect(wrappers[1].classList.contains('rules-dock-keepalive--hidden')).toBe(false);
  });

  it('keeps bodies mounted when the dock closes (active null)', () => {
    const windows = ['terminal', 'git'];
    const { container, rerender } = render(renderStack(windows, 'git'));
    rerender(renderStack(windows, null));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(1);
    expect(container.querySelector('[data-body-id="git"]')).toBeTruthy();
  });

  it('unmounts a body when its window leaves the dock', () => {
    const { container, rerender } = render(renderStack(['terminal', 'git'], 'terminal'));
    rerender(renderStack(['terminal', 'git'], 'git'));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(2);

    rerender(renderStack(['git'], 'git'));
    expect(container.querySelectorAll('[data-body-id]')).toHaveLength(1);
    expect(container.querySelector('[data-body-id="terminal"]')).toBeNull();
  });
});
