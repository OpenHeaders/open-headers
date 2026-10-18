// @vitest-environment jsdom
/**
 * The compose bars' encoding picker — the body viewers' picker dress
 * on the MQTT encoding (Text / JSON over the divider, Base64 / Hex
 * under it) and the WebSocket format and byte-spelling pickers: the
 * trigger wears the glyph + the label in force + a chevron; the menu
 * lists glyph + label rows with the divider where the host puts it;
 * a pick hands the value back.
 */

import { EncodingSelect } from '@openheaders/ui/workbench/components/mqtt-request-editor/compose-parts';
import {
  BinaryEncodingSelect,
  MessageFormatSelect,
} from '@openheaders/ui/workbench/components/websocket-request-editor/ws-format-parts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/** The rows' labels — the glyph's own letters (the SVG's text, a
 *  prefix) stripped. */
const menuRows = (): string[] =>
  Array.from(document.querySelectorAll('.ant-dropdown-menu-item')).map((el) =>
    (el.textContent ?? '').slice(el.querySelector('svg')?.textContent?.length ?? 0),
  );
const dividers = (): number => document.querySelectorAll('.ant-dropdown-menu-item-divider').length;

async function openMenu(testId: string): Promise<void> {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(document.querySelector('.ant-dropdown-menu')).not.toBeNull());
}

describe('encoding picker — the compose bars', () => {
  it('the MQTT encoding: glyph + label on the trigger, grammars over bytes in the menu, a pick hands the value back', async () => {
    const onChange = vi.fn();
    render(<EncodingSelect value="json" onChange={onChange} testId="mqtt-payload-format" />);
    const trigger = screen.getByTestId('mqtt-payload-format');
    expect(screen.getByTestId('mqtt-payload-format-label').textContent).toBe('JSON');
    expect(trigger.querySelector('svg')).not.toBeNull();
    await openMenu('mqtt-payload-format');
    expect(menuRows()).toEqual(['Text', 'JSON', 'Base64', 'Hexadecimal']);
    expect(dividers()).toBe(1);
    expect(document.querySelectorAll('.ant-dropdown-menu-item svg')).toHaveLength(4);
    // The glyph is aria-hidden, so the row's name is its label alone.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Base64' }));
    expect(onChange).toHaveBeenCalledWith('base64');
  });

  it('the WebSocket format: four grammars over Binary; the byte spelling has no divider', async () => {
    render(<MessageFormatSelect value="text" onChange={() => {}} testId="websocket-message-format" />);
    await openMenu('websocket-message-format');
    expect(menuRows()).toEqual(['Text', 'JSON', 'XML', 'HTML', 'Binary']);
    expect(dividers()).toBe(1);
    cleanup();
    const onChange = vi.fn();
    render(<BinaryEncodingSelect value="hex" onChange={onChange} testId="websocket-binary-encoding" />);
    expect(screen.getByTestId('websocket-binary-encoding-label').textContent).toBe('Hexadecimal');
    await openMenu('websocket-binary-encoding');
    expect(menuRows()).toEqual(['Base64', 'Hexadecimal']);
    expect(dividers()).toBe(0);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Base64' }));
    expect(onChange).toHaveBeenCalledWith('base64');
  });
});
