/**
 * Phase U5 — `ModeSwitchDialog` consume-only redesign. Pins:
 *
 *   - opens / closes via the `open` prop
 *   - both per-host columns render their summary line
 *   - the same two cards show regardless of backend: Keep my workspaces
 *     + Discard my workspaces
 *   - selecting a card then Apply dispatches the typed choice
 *   - clicking a card alone does NOT commit
 *   - Cancel routes through `onCancel`
 *   - an unknown target `Org` disables Discard; Keep stays available
 */

import type { DataPresenceSummary, WorkspaceContentSnapshot } from '@openheaders/core/sync';
import ModeSwitchDialog, { type ModeSwitchChoice } from '@openheaders/ui/workbench/components/dialogs/ModeSwitchDialog';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  // jsdom doesn't implement `getComputedStyle(el, pseudo)`; antd's Modal
  // triggers it during render and floods the console with notImplemented
  // warnings. Route the pseudo overload through the element-only path.
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((el: Element, _pseudo?: string | null): CSSStyleDeclaration =>
    originalGetComputedStyle(el)) as typeof window.getComputedStyle;
});

afterEach(() => cleanup());

/** Click the dialog's Apply button (the OK button, prefixed "Apply"). */
function clickApply(): void {
  const buttons = screen.getAllByRole('button');
  const apply = buttons.find((b) => /^Apply\b/.test(b.textContent?.trim() ?? ''));
  if (!apply) throw new Error('Apply button not found');
  apply.click();
}

/** Select an action card by a substring of its title. */
function selectAction(titleMatch: RegExp): void {
  const textEl = screen.getByText(titleMatch);
  const button = textEl.closest('button');
  if (!button) throw new Error(`No button ancestor for action ${titleMatch}`);
  fireEvent.click(button);
}

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';

function workspace(entityCounts: Record<string, number> = {}): WorkspaceContentSnapshot {
  return { workspaceId: WS_A, workspaceName: 'Workspace', entityCounts };
}

function presence(workspaces: WorkspaceContentSnapshot[]): DataPresenceSummary {
  const total = workspaces.reduce((a, w) => a + Object.values(w.entityCounts).reduce((s, n) => s + n, 0), 0);
  return {
    workspaceCount: workspaces.length,
    hasUserContent: total > 0,
    totalEntityCount: total,
    workspaces,
  };
}

function renderDialog(
  overrides: {
    open?: boolean;
    targetOrgKnown?: boolean;
    onChoose?: (c: ModeSwitchChoice) => void;
    onCancel?: () => void;
  } = {},
) {
  return render(
    <ModeSwitchDialog
      open={overrides.open ?? true}
      fromLabel="In-Browser"
      toLabel="Desktop App"
      targetOrgKnown={overrides.targetOrgKnown ?? true}
      source={presence([workspace({ rule: 12, environment: 3 })])}
      target={presence([workspace({ rule: 8 })])}
      onChoose={overrides.onChoose ?? (() => {})}
      onCancel={overrides.onCancel ?? (() => {})}
    />,
  );
}

describe('ModeSwitchDialog', () => {
  it('renders nothing visible when closed', () => {
    renderDialog({ open: false });
    expect(screen.queryByText(/Switching from/)).toBeNull();
  });

  it('renders both per-host columns with their summary line', () => {
    renderDialog();
    expect(screen.getByText(/Switching from In-Browser to Desktop App/)).toBeTruthy();
    expect(screen.getAllByText('In-Browser').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Desktop App').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 workspace · 12 rules · 3 environments/)).toBeTruthy();
    expect(screen.getByText(/1 workspace · 8 rules/)).toBeTruthy();
  });

  it('shows Keep + Discard — the same two consume-only cards for any backend', () => {
    renderDialog();
    expect(screen.getByText(/Keep my workspaces/)).toBeTruthy();
    expect(screen.getByText(/Discard my workspaces/)).toBeTruthy();
  });

  it('dispatches the Keep choice on Apply (the default)', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('keep-local');
  });

  it('dispatches the Discard choice when the user selects it then Applies', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    selectAction(/Discard my workspaces/);
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('use-target');
  });

  it('clicking a card does NOT commit — Apply is the explicit gesture', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    selectAction(/Discard my workspaces/);
    selectAction(/Keep my workspaces/);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('routes the Cancel button through onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    screen.getByText('Cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks Discard as a destructive action', () => {
    renderDialog();
    expect(screen.getByText('Destructive')).toBeTruthy();
  });

  it('warns and disables Discard when the target Org is unknown, leaving Keep', () => {
    const onChoose = vi.fn();
    renderDialog({ targetOrgKnown: false, onChoose });
    expect(screen.getByText(/didn't report a workspace identity/)).toBeTruthy();
    expect(screen.getByText(/Keep my workspaces/)).toBeTruthy();
    // Apply commits Keep, not the disabled Discard.
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('keep-local');
  });
});
