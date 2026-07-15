/**
 * Product-telemetry contracts of the curl import flow (the template the
 * other import modals follow):
 *   - a hub hand-off that fails to parse beacons `import-parse-failed`
 *     once per open — live typing never fires;
 *   - a completed import records `import_run ok:true` with the detected
 *     kind (`url` survives the curl-modal hand-off);
 *   - a failed import attempt records `import_run ok:false`.
 */

import '@openheaders/ui/workbench/settings/schema/keyboard';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import ImportCurlModal from '@openheaders/ui/workbench/components/import/ImportCurlModal';
import type { DictStorage, SettingScope } from '@openheaders/ui/workbench/settings/storage/adapter';
import {
  __resetStoreForTests,
  configureSettingsStorage,
  initSettingsStore,
} from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Ant's inputs measure via rc-resize-observer; jsdom has no ResizeObserver.
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

class NoopDictStorage implements DictStorage {
  async load(_scope: SettingScope): Promise<Record<string, unknown>> {
    return {};
  }
  async save(): Promise<void> {}
  subscribe(): () => void {
    return () => {};
  }
}

let trackCalls: Array<{ type: string; payload: unknown }>;

beforeEach(async () => {
  __resetStoreForTests();
  configureSettingsStorage(new NoopDictStorage());
  await initSettingsStore();
  setCurrentHost('extension');
  trackCalls = [];
  setHostBridge({
    call: vi.fn(async (type: string, payload: unknown) => {
      trackCalls.push({ type, payload });
      return { success: true };
    }),
  } as unknown as HostBridge);
});

afterEach(() => {
  cleanup();
  __resetStoreForTests();
});

function telemetryEvents(): unknown[] {
  return trackCalls.filter((c) => c.type === 'productTelemetryTrack').map((c) => (c.payload as { event: unknown }).event);
}

function renderModal(props: Partial<React.ComponentProps<typeof ImportCurlModal>> = {}) {
  const createRequest = vi.fn(async () => ({ uid: 'req-1' }));
  const createCollection = vi.fn(async () => ({ uid: 'coll-1' }));
  const utils = render(
    <AntApp>
      <ImportCurlModal
        open
        collections={[]}
        onCancel={() => undefined}
        onImported={() => undefined}
        createRequest={createRequest}
        createCollection={createCollection}
        {...props}
      />
    </AntApp>,
  );
  return { ...utils, createRequest, createCollection };
}

describe('ImportCurlModal — product telemetry', () => {
  it('beacons import-parse-failed once for an unparseable hub hand-off', async () => {
    renderModal({ initialSource: "curl --bogus-flag-that-never-parses '" });
    await waitFor(() => {
      expect(telemetryEvents()).toContainEqual({ name: 'error_beacon', code: 'import-parse-failed' });
    });
    expect(telemetryEvents().filter((e) => (e as { name: string }).name === 'error_beacon')).toHaveLength(1);
  });

  it('records import_run ok:true with the url kind on a completed hand-off import', async () => {
    const { getByRole } = renderModal({
      initialSource: "curl 'https://api.openheaders.io/v1/things'",
      sourceKind: 'url',
    });
    await waitFor(() => {
      expect((getByRole('button', { name: /import/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByRole('button', { name: /import/i }));
    await waitFor(() => {
      expect(telemetryEvents()).toContainEqual({ name: 'import_run', source: 'url', ok: true });
    });
  });

  it('records import_run ok:false when the request create fails', async () => {
    const { getByRole } = renderModal({
      initialSource: "curl 'https://api.openheaders.io/v1/things'",
      createRequest: vi.fn(async () => null),
    });
    await waitFor(() => {
      expect((getByRole('button', { name: /import/i }) as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(getByRole('button', { name: /import/i }));
    await waitFor(() => {
      expect(telemetryEvents()).toContainEqual({ name: 'import_run', source: 'curl', ok: false });
    });
  });
});
