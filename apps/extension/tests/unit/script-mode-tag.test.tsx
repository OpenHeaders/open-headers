// @vitest-environment jsdom
/**
 * ScriptModeTag — the request editor tab-bar chip for the script
 * execution mode. Availability keys off the host's capabilities: no
 * `scriptRuntime` and no `remoteScriptRuntime` (the extension's browser
 * runtime) renders nothing; `scriptRuntime` (desktop) renders the
 * interactive chip whose popover cards rewrite the per-workspace
 * host-local `OH.scriptExecutionModes` slot; `remoteScriptRuntime`
 * reported Safe (served web tab) renders the shield with an
 * informational popover and no cards.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { getHostStorage, type HostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import ScriptModeTag from '@openheaders/ui/workbench/components/request-editor/ScriptModeTag';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// In-memory HostStorage — the suite-wide chrome-mock adapter stubs
// `storage.set` to a no-op, so slot round-trips need a real fake (the
// backend-enable-switch precedent).
function createHostStorageFake(): HostStorage {
  const map = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (key: string): void => {
    for (const fn of listeners.get(key) ?? []) fn();
  };
  return {
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
      notify(spec.key);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) {
        map.set(spec.key, value);
        notify(spec.key);
      }
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) {
        map.delete(spec.key);
        notify(spec.key);
      }
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: (spec, handler) => {
      let bucket = listeners.get(spec.key);
      if (!bucket) {
        bucket = new Set();
        listeners.set(spec.key, bucket);
      }
      const fn = (): void => handler(map.get(spec.key) as never);
      bucket.add(fn);
      return () => bucket?.delete(fn);
    },
  };
}

// The antd Popover/Tooltip measure via rc-resize-observer; jsdom ships
// no ResizeObserver.
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

const WS = 'wstest01';

beforeEach(async () => {
  setHostStorage(createHostStorageFake());
  await getHostStorage()?.set(OH.scriptExecutionModes, {});
});

afterEach(() => {
  unregisterCapability('scriptRuntime');
  unregisterCapability('remoteScriptRuntime');
  cleanup();
});

describe('ScriptModeTag availability', () => {
  it('renders nothing without a script runtime on either side', () => {
    render(<ScriptModeTag workspaceId={WS} />);
    expect(screen.queryByTestId('oh-script-mode-tag')).toBeNull();
  });

  it('renders a read-only Safe chip against a remote Safe runtime', async () => {
    registerCapability('remoteScriptRuntime', () => 'safe');
    render(<ScriptModeTag workspaceId={WS} />);
    const chip = await screen.findByTestId('oh-script-mode-tag');
    expect(chip.getAttribute('aria-label')).toBe('Script execution: Safe mode');
    fireEvent.click(chip);
    // Informational popover — the back-end's posture, never a chooser.
    expect(await screen.findByText(/execute on the connected back-end/)).toBeTruthy();
    expect(screen.queryByTestId('oh-script-mode-option-safe')).toBeNull();
    expect(screen.queryByTestId('oh-script-mode-option-developer')).toBeNull();
  });
});

describe('ScriptModeTag with a host script runtime', () => {
  beforeEach(() => {
    registerCapability('scriptRuntime', () => 'safe');
  });

  it('defaults to Safe and opens the chooser with Safe selected', async () => {
    render(<ScriptModeTag workspaceId={WS} />);
    const chip = await screen.findByTestId('oh-script-mode-tag');
    expect(chip.getAttribute('aria-label')).toBe('Script execution: Safe mode');
    fireEvent.click(chip);
    const safeCard = await screen.findByTestId('oh-script-mode-option-safe');
    const developerCard = screen.getByTestId('oh-script-mode-option-developer');
    expect(safeCard.getAttribute('aria-checked')).toBe('true');
    expect(developerCard.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Recommended')).toBeTruthy();
    expect(screen.getByText(/trust everyone who can edit/)).toBeTruthy();
  });

  it('picking Developer writes the workspace slot and flips the chip', async () => {
    render(<ScriptModeTag workspaceId={WS} />);
    fireEvent.click(await screen.findByTestId('oh-script-mode-tag'));
    fireEvent.click(await screen.findByTestId('oh-script-mode-option-developer'));
    await waitFor(async () => {
      expect(await getHostStorage()?.get(OH.scriptExecutionModes)).toEqual({ [WS]: 'developer' });
    });
    expect(screen.getByTestId('oh-script-mode-tag').getAttribute('aria-label')).toBe(
      'Script execution: Developer mode',
    );
    expect(screen.getByTestId('oh-script-mode-option-developer').getAttribute('aria-checked')).toBe('true');
  });

  it('picking Safe again deletes the slot entry (absent reads as the default)', async () => {
    await getHostStorage()?.set(OH.scriptExecutionModes, { [WS]: 'developer' });
    render(<ScriptModeTag workspaceId={WS} />);
    const chip = await screen.findByTestId('oh-script-mode-tag');
    await waitFor(() => {
      expect(chip.getAttribute('aria-label')).toBe('Script execution: Developer mode');
    });
    fireEvent.click(chip);
    fireEvent.click(await screen.findByTestId('oh-script-mode-option-safe'));
    await waitFor(async () => {
      expect(await getHostStorage()?.get(OH.scriptExecutionModes)).toEqual({});
    });
    expect(chip.getAttribute('aria-label')).toBe('Script execution: Safe mode');
  });
});
