/**
 * Phase C M2b — `ModeSwitchDialog` smoke test. Pins:
 *
 *   - opens / closes via the `open` prop
 *   - both per-host columns render their summary line
 *   - Coexist / Import / Discard buttons dispatch the typed choice
 *   - Cancel routes through `onCancel`
 *   - Coexist is flagged as the recommended option
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DataPresenceSummary, WorkspaceContentSnapshot } from '@openheaders/core/sync';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ModeSwitchDialog, {
  type ModeSwitchChoice,
} from '@openheaders/ui/workbench/components/dialogs/ModeSwitchDialog';

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
  // warnings. Route the pseudo overload through the element-only path
  // — declarations are empty either way under jsdom, so consumers get
  // the same `CSSStyleDeclaration` either way.
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((
    el: Element,
    _pseudo?: string | null,
  ): CSSStyleDeclaration => originalGetComputedStyle(el)) as typeof window.getComputedStyle;
});

afterEach(() => cleanup());

/**
 * Find the dialog's Apply button. The Modal renders both Cancel and OK
 * (renamed to "Apply" / "Apply (with backup)" depending on whether
 * Discard is selected). Anchor to the "Apply" prefix so the Cancel
 * button is never matched by accident.
 */
function clickApply(): void {
  const buttons = screen.getAllByRole('button');
  const apply = buttons.find((b) => /^Apply\b/.test(b.textContent?.trim() ?? ''));
  if (!apply) throw new Error('Apply button not found');
  apply.click();
}

/**
 * Select an action card by its title. The card root is the button with
 * `role="radio"` — clicking its text descendant works through bubbling
 * in JSDOM but the button is the canonical click target for React event
 * delegation, so we walk up to it.
 */
function selectAction(title: string): void {
  const textEl = screen.getByText(title);
  const button = textEl.closest('button');
  if (!button) throw new Error(`No button ancestor for action "${title}"`);
  // `fireEvent.click` dispatches React's synthetic event directly; the
  // native `Element.click()` doesn't always propagate through React's
  // delegated handlers in JSDOM when the click target is a nested
  // span — switching to fireEvent keeps the assertion deterministic.
  fireEvent.click(button);
}

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';

function workspace(entityCounts: Record<string, number> = {}): WorkspaceContentSnapshot {
  return { workspaceId: WS_A, workspaceName: 'Workspace', entityCounts };
}

function presence(workspaces: WorkspaceContentSnapshot[]): DataPresenceSummary {
  const total = workspaces.reduce(
    (a, w) => a + Object.values(w.entityCounts).reduce((s, n) => s + n, 0),
    0,
  );
  return {
    workspaceCount: workspaces.length,
    hasUserContent: total > 0,
    totalEntityCount: total,
    workspaces,
  };
}

import type { NameCollision } from '@openheaders/core/sync';

function renderDialog(overrides: {
  open?: boolean;
  onChoose?: (c: ModeSwitchChoice, options?: { workspaceIdRemap?: Readonly<Record<string, string>> }) => void;
  onCancel?: () => void;
  nameCollisions?: readonly NameCollision[];
} = {}) {
  return render(
    <ModeSwitchDialog
      open={overrides.open ?? true}
      fromLabel="In-Browser"
      toLabel="Desktop App"
      source={presence([workspace({ rule: 12, environment: 3 })])}
      target={presence([workspace({ rule: 8 })])}
      nameCollisions={overrides.nameCollisions}
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
    // CSS uppercases the visual rendering; the underlying text node still
    // carries the original case.
    expect(screen.getAllByText('In-Browser').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Desktop App').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 workspace · 12 rules · 3 environments/)).toBeTruthy();
    expect(screen.getByText(/1 workspace · 8 rules/)).toBeTruthy();
  });

  it('marks Coexist as the recommended action', () => {
    renderDialog();
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('dispatches the Coexist choice on Apply (default selection)', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    // Cards are now SELECTABLE — Coexist is selected by default
    // (recommended). Apply is the explicit commit gesture.
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('coexist');
  });

  it('dispatches the Import choice when the user selects Import then Applies', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    selectAction('Import source data into the target workspace');
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('import');
  });

  it('dispatches the Discard choice when the user selects Discard then Applies', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    selectAction('Discard source data, use the target');
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('discard');
  });

  it('clicking a card does NOT commit — Apply is the explicit gesture', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    selectAction('Import source data into the target workspace');
    selectAction('Discard source data, use the target');
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('routes the Cancel button through onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    screen.getByText('Cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('omits the name-collision banner when no collisions are provided', () => {
    renderDialog();
    expect(screen.queryByText(/look like the same one/)).toBeNull();
    expect(screen.queryByText(/look like the same ones/)).toBeNull();
  });

  it('renders the name-collision banner with each colliding workspace pair', () => {
    renderDialog({
      nameCollisions: [
        {
          sourceWorkspaceId: '0193a8ff-c000-7000-8000-00000000000a',
          sourceWorkspaceName: 'PRODUCTION',
          targetWorkspaceId: '0193a8ff-c000-7000-8000-00000000000b',
          targetWorkspaceName: 'production',
          normalizedName: 'production',
        },
        {
          sourceWorkspaceId: '0193a8ff-c000-7000-8000-00000000000c',
          sourceWorkspaceName: 'Staging',
          targetWorkspaceId: '0193a8ff-c000-7000-8000-00000000000d',
          targetWorkspaceName: 'staging',
          normalizedName: 'staging',
        },
      ],
    });
    expect(screen.getByText(/2 workspaces look like the same ones/)).toBeTruthy();
    expect(screen.getByText('PRODUCTION')).toBeTruthy();
    expect(screen.getAllByText('production').length).toBeGreaterThan(0);
    expect(screen.getByText('Staging')).toBeTruthy();
    expect(screen.getAllByText('staging').length).toBeGreaterThan(0);
    // The merge-by-id checkbox is rendered, labeled, and checked by default.
    expect(screen.getByText(/Treat them as the same workspace/)).toBeTruthy();
  });

  it('forwards the workspaceIdRemap on Import when collisions exist and the merge checkbox is checked (default)', () => {
    const onChoose = vi.fn();
    renderDialog({
      onChoose,
      nameCollisions: [
        {
          sourceWorkspaceId: 'src-a',
          sourceWorkspaceName: 'Production',
          targetWorkspaceId: 'tgt-a',
          targetWorkspaceName: 'Production',
          normalizedName: 'production',
        },
        {
          sourceWorkspaceId: 'src-b',
          sourceWorkspaceName: 'Staging',
          targetWorkspaceId: 'tgt-b',
          targetWorkspaceName: 'Staging',
          normalizedName: 'staging',
        },
      ],
    });
    selectAction('Import source data into the target workspace');
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('import', {
      workspaceIdRemap: { 'src-a': 'tgt-a', 'src-b': 'tgt-b' },
    });
  });

  it('omits the workspaceIdRemap when the user clears the merge checkbox before applying Import', () => {
    const onChoose = vi.fn();
    renderDialog({
      onChoose,
      nameCollisions: [
        {
          sourceWorkspaceId: 'src-a',
          sourceWorkspaceName: 'Production',
          targetWorkspaceId: 'tgt-a',
          targetWorkspaceName: 'Production',
          normalizedName: 'production',
        },
      ],
    });
    // Toggle the checkbox off.
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    checkbox.click();
    expect(checkbox.checked).toBe(false);
    selectAction('Import source data into the target workspace');
    clickApply();
    expect(onChoose).toHaveBeenCalledWith('import');
  });

  it('does not pass workspaceIdRemap on Coexist or Discard even when collisions exist', () => {
    const onChoose = vi.fn();
    renderDialog({
      onChoose,
      nameCollisions: [
        {
          sourceWorkspaceId: 'src-a',
          sourceWorkspaceName: 'Production',
          targetWorkspaceId: 'tgt-a',
          targetWorkspaceName: 'Production',
          normalizedName: 'production',
        },
      ],
    });
    selectAction('Keep both as separate workspaces');
    clickApply();
    expect(onChoose).toHaveBeenLastCalledWith('coexist');
    selectAction('Discard source data, use the target');
    clickApply();
    expect(onChoose).toHaveBeenLastCalledWith('discard');
  });

  it('uses the singular "1 workspace looks like" phrasing for a single collision', () => {
    renderDialog({
      nameCollisions: [
        {
          sourceWorkspaceId: '0193a8ff-c000-7000-8000-00000000000a',
          sourceWorkspaceName: 'Production',
          targetWorkspaceId: '0193a8ff-c000-7000-8000-00000000000b',
          targetWorkspaceName: 'Production',
          normalizedName: 'production',
        },
      ],
    });
    expect(screen.getByText(/1 workspace looks like the same one/)).toBeTruthy();
  });
});
