/**
 * Capture partition readers — surfaces that read one lifecycle partition
 * through `useCapturePartition`, served by `CapturePartitionHosts`.
 * Asserts:
 *   - a partition's lifeline opens in the render pass its first reader
 *     mounts in — nothing is loaded or awaited between the two
 *   - two readers of one partition open ONE lifeline and see the same rows
 *   - a reader that joins an open partition has its rows on first render,
 *     and nothing new is opened or asked of the engine
 *   - the partition stays open while a reader remains and closes with the
 *     last one
 *   - a clear from one reader empties every reader and reaches the engine
 *     once
 *   - readers of different partitions hold different lifelines
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { CapturePartitionHosts } from '@openheaders/ui/panel/components/CapturePartitionHosts';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { useCapturePartition } from '@openheaders/ui/panel/data/use-capture-partition';
import { act, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

interface FakePort extends LifelinePort {
  readonly name: string;
  readonly posted: unknown[];
  disconnected: boolean;
  emit(msg: unknown): void;
}

const qualified = (tabId: number): string => `oh-lifecycle:${tabId}@ext-john-doe`;

let ports: FakePort[] = [];

function installTransport(): void {
  ports = [];
  const transport: LifelineTransport = {
    connect(name) {
      let onMessage: ((msg: unknown) => void) | null = null;
      const port: FakePort = {
        name,
        posted: [],
        disconnected: false,
        postMessage(msg) {
          port.posted.push(msg);
        },
        onMessage(handler) {
          onMessage = handler as (msg: unknown) => void;
        },
        onDisconnect() {},
        disconnect() {
          port.disconnected = true;
        },
        emit(msg) {
          onMessage?.(msg);
        },
      };
      ports.push(port);
      return port;
    },
  };
  setLifelineTransport(transport);
}

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 7,
    requestId: 'r1',
    url: 'https://openheaders.io/a',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1,
    hopStartedAtMs: 1,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function started(port: FakePort, overrides: Partial<RequestLifecycle> = {}): void {
  port.emit({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle: makeLifecycle(overrides) } });
}

function Reader({ id, tabId }: { id: string; tabId: number }): React.ReactElement {
  const view = useCapturePartition({ tabId, portName: qualified });
  return (
    <section data-testid={id} data-open={view !== null}>
      <button type="button" onClick={() => view?.clearSession()}>
        clear
      </button>
      {view?.data.rows.map((row) => (
        <span key={row.lifecycle.requestId}>{row.lifecycle.requestId}</span>
      ))}
    </section>
  );
}

function Surfaces({ readers }: { readers: ReadonlyArray<{ id: string; tabId: number }> }): React.ReactElement {
  return (
    <>
      <CapturePartitionHosts />
      {readers.map((reader) => (
        <Reader key={reader.id} id={reader.id} tabId={reader.tabId} />
      ))}
    </>
  );
}

function rowsOf(container: HTMLElement, id: string): string[] {
  return [...container.querySelectorAll(`[data-testid="${id}"] span`)].map((el) => el.textContent ?? '');
}

describe('capture partition readers', () => {
  beforeEach(() => {
    setNotifyScheduler(createSyncNotifyScheduler());
    installTransport();
  });

  afterEach(() => {
    setNotifyScheduler(null);
  });

  it('opens one lifeline for two readers of a partition and shows both the same rows', () => {
    const { container, unmount } = render(
      <Surfaces
        readers={[
          { id: 'grid', tabId: 7 },
          { id: 'inspect', tabId: 7 },
        ]}
      />,
    );

    expect(ports.map((port) => port.name)).toEqual(['oh-lifecycle:7@ext-john-doe']);
    expect(ports[0].posted).toEqual([{ kind: 'subscribe' }]);

    act(() => {
      ports[0].emit({ kind: 'ready', tabId: 7, watermarkMs: -1 });
      started(ports[0]);
    });
    expect(rowsOf(container, 'grid')).toEqual(['r1']);
    expect(rowsOf(container, 'inspect')).toEqual(['r1']);
    unmount();
  });

  it('gives a reader that joins an open partition its rows at once, with nothing new opened or asked', () => {
    const { container, rerender, unmount } = render(<Surfaces readers={[{ id: 'grid', tabId: 7 }]} />);
    act(() => {
      ports[0].emit({ kind: 'ready', tabId: 7, watermarkMs: -1 });
      started(ports[0]);
    });

    rerender(
      <Surfaces
        readers={[
          { id: 'grid', tabId: 7 },
          { id: 'inspect', tabId: 7 },
        ]}
      />,
    );
    expect(rowsOf(container, 'inspect')).toEqual(['r1']);
    expect(ports).toHaveLength(1);
    expect(ports[0].posted).toEqual([{ kind: 'subscribe' }]);
    unmount();
  });

  it('keeps the partition open while a reader remains and closes it with the last', () => {
    const { container, rerender, unmount } = render(
      <Surfaces
        readers={[
          { id: 'grid', tabId: 7 },
          { id: 'inspect', tabId: 7 },
        ]}
      />,
    );
    act(() => {
      ports[0].emit({ kind: 'ready', tabId: 7, watermarkMs: -1 });
      started(ports[0]);
    });

    rerender(<Surfaces readers={[{ id: 'inspect', tabId: 7 }]} />);
    expect(ports[0].disconnected).toBe(false);
    act(() => {
      started(ports[0], { requestId: 'r2', startedAtMs: 2, hopStartedAtMs: 2 });
    });
    expect(rowsOf(container, 'inspect')).toEqual(['r1', 'r2']);

    rerender(<Surfaces readers={[]} />);
    expect(ports[0].disconnected).toBe(true);
    expect(ports).toHaveLength(1);
    unmount();
  });

  it('clears every reader from one reader’s clear and tells the engine once', () => {
    const { container, unmount } = render(
      <Surfaces
        readers={[
          { id: 'grid', tabId: 7 },
          { id: 'inspect', tabId: 7 },
        ]}
      />,
    );
    act(() => {
      ports[0].emit({ kind: 'ready', tabId: 7, watermarkMs: -1 });
      started(ports[0]);
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="grid"] button')?.click();
    });
    expect(rowsOf(container, 'grid')).toEqual([]);
    expect(rowsOf(container, 'inspect')).toEqual([]);
    expect(ports[0].posted).toEqual([{ kind: 'subscribe' }, { kind: 'clear-session' }]);
    unmount();
  });

  it('holds a lifeline per partition', () => {
    const { container, unmount } = render(
      <Surfaces
        readers={[
          { id: 'seven', tabId: 7 },
          { id: 'eight', tabId: 8 },
        ]}
      />,
    );
    expect(ports.map((port) => port.name)).toEqual(['oh-lifecycle:7@ext-john-doe', 'oh-lifecycle:8@ext-john-doe']);

    act(() => {
      ports[1].emit({ kind: 'ready', tabId: 8, watermarkMs: -1 });
      started(ports[1], { tabId: 8, requestId: 'r8' });
    });
    expect(rowsOf(container, 'seven')).toEqual([]);
    expect(rowsOf(container, 'eight')).toEqual(['r8']);
    unmount();
  });
});
