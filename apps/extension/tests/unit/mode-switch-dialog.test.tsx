/**
 * Phase C M2b — `ModeSwitchDialog` smoke test. Pins:
 *
 *   - opens / closes via the `open` prop
 *   - both per-host columns render their summary line
 *   - Coexist / Import / Discard buttons dispatch the typed choice
 *   - Cancel routes through `onCancel`
 *   - Coexist is flagged as the recommended option
 */

import { cleanup, render, screen } from '@testing-library/react';
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
});

afterEach(() => cleanup());

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

function renderDialog(overrides: { open?: boolean; onChoose?: (c: ModeSwitchChoice) => void; onCancel?: () => void } = {}) {
  return render(
    <ModeSwitchDialog
      open={overrides.open ?? true}
      fromLabel="In-Browser"
      toLabel="Desktop App"
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

  it('dispatches the Coexist choice', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    screen.getByText('Keep both as separate workspaces').click();
    expect(onChoose).toHaveBeenCalledWith('coexist');
  });

  it('dispatches the Import choice', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    screen.getByText('Import source data into the target workspace').click();
    expect(onChoose).toHaveBeenCalledWith('import');
  });

  it('dispatches the Discard choice', () => {
    const onChoose = vi.fn();
    renderDialog({ onChoose });
    screen.getByText('Discard source data, use the target').click();
    expect(onChoose).toHaveBeenCalledWith('discard');
  });

  it('routes the Cancel button through onCancel', () => {
    const onCancel = vi.fn();
    renderDialog({ onCancel });
    screen.getByText('Cancel').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
