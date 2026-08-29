// @vitest-environment jsdom
/**
 * The sidebar SPECS header's `+` menu: every format row leads with the
 * badge of the request kind the format feeds (HTTP / gRPC / WS+MQTT),
 * the same code badge the New Request menu teaches — the menu reads as
 * a mapping, not a glossary of spec formats.
 */

import SpecsSection from '@openheaders/ui/workbench/components/sidebar/SpecsSection';
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
});

afterEach(() => {
  cleanup();
});

describe('specs section create menu', () => {
  it('leads each format with the request-kind badge it feeds', async () => {
    render(
      <SpecsSection
        sectionsExpanded={{ specs: true }}
        toggleSection={() => undefined}
        createNewSpec={vi.fn(async () => undefined)}
        specNodes={[]}
        renderNodes={() => null}
      />,
    );
    fireEvent.click(screen.getByTestId('sidebar-create-spec'));
    const rows = (await screen.findAllByRole('menuitem')).map((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(rows).toEqual(['HTTPOpenAPI 3.1', 'gRPCProtobuf 3', 'WS/MQTTAsyncAPI 3.0']);
  });
});
