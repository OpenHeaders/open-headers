/**
 * Phase U5.5 — `ModeSwitchDialog` posture-aware redesign. Pins:
 *
 *   - opens / closes via the `open` prop
 *   - both per-host columns render their summary line
 *   - trust-by-process posture shows Combine + Use-Target
 *   - authenticated posture shows Keep-my-data-here + Use-Target
 *   - selecting a card then Apply dispatches the typed choice
 *   - clicking a card alone does NOT commit
 *   - Cancel routes through `onCancel`
 *   - an unknown target `Org` disables the Org-dependent cards and
 *     offers Keep-my-data-here as the fallback
 */

import type { DataPresenceSummary, WorkspaceContentSnapshot } from '@openheaders/core/sync';
import ModeSwitchDialog, {
  type ConnectionPosture,
  type ModeSwitchChoice,
} from '@openheaders/ui/workbench/components/dialogs/ModeSwitchDialog';
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
    posture?: ConnectionPosture;
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
      posture={overrides.posture ?? 'trust-by-process'}
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

  it('shows Combine + Use-Target on a trust-by-process target', () => {
    renderDialog({ posture: 'trust-by-process' });
    expect(screen.getByText(/Combine into one workspace set/)).toBeTruthy();
    expect(screen.getByText(/Use the target backend/)).toBeTruthy();
    expect(screen.queryByText(/Keep my data on this device/)).toBeNull();
  });

  it('shows Keep-my-data-here + Use-Target on an authenticated target', () => {
    renderDialog({ posture: 'authenticated' });
    expect(screen.getByText(/Keep my data on this device/)).toBeTruthy();
    expect(screen.getByText(/Use the target backend/)).toBeTruthy();
    expect(screen.queryByText(/Combine into one workspace set/)).toBeNull();
  });

  it('dispatches the Combine choice on Apply (trust-by-process default)', () => {
    const onChoose = vi.fn();
    renderDialog({ posture: 'trust-by-process', onChoose });
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('combine');
  });

  it('dispatches the Keep-local choice on Apply (authenticated default)', () => {
    const onChoose = vi.fn();
    renderDialog({ posture: 'authenticated', onChoose });
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('keep-local');
  });

  it('dispatches Use-Target when the user selects it then Applies', () => {
    const onChoose = vi.fn();
    renderDialog({ posture: 'trust-by-process', onChoose });
    selectAction(/Use the target backend/);
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('use-target');
  });

  it('clicking a card does NOT commit — Apply is the explicit gesture', () => {
    const onChoose = vi.fn();
    renderDialog({ posture: 'trust-by-process', onChoose });
    selectAction(/Use the target backend/);
    selectAction(/Combine into one workspace set/);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('routes the Cancel button through onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    screen.getByText('Cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('marks Use-Target as a destructive action', () => {
    renderDialog({ posture: 'trust-by-process' });
    expect(screen.getByText('Destructive')).toBeTruthy();
  });

  it('warns and offers Keep-local as the fallback when the target Org is unknown', () => {
    const onChoose = vi.fn();
    renderDialog({ posture: 'trust-by-process', targetOrgKnown: false, onChoose });
    // The org-dependent outcomes can't run — Keep-my-data-here is added.
    expect(screen.getByText(/didn't report a workspace identity/)).toBeTruthy();
    expect(screen.getByText(/Keep my data on this device/)).toBeTruthy();
    // Apply commits the fallback, not the disabled Combine.
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('keep-local');
  });
});
