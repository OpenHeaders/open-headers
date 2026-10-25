// @vitest-environment jsdom
/**
 * The URL bar's `:name` token opens the path-parameter session on the
 * shared popover host — the row's value and the bar's writer ride the
 * open — while a `{{ref}}` keeps opening the reference session, and a
 * field without the Path Parameters opt-in opens nothing on a colon.
 */

import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const open = vi.fn();

vi.mock('@openheaders/ui/workbench/components/template-input/VariablePopoverHost', () => ({
  useVariablePopover: () => ({
    open,
    scheduleClose: vi.fn(),
    cancelClose: vi.fn(),
    closeNow: vi.fn(),
  }),
  VariablePopoverProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

beforeEach(() => open.mockClear());
afterEach(cleanup);

describe('TemplateInput — hovering a :name token', () => {
  it('opens the path-parameter session with the row value and the writer', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <TemplateInput
        value="https://api.openheaders.io/users/:id"
        onChange={vi.fn()}
        pathParams={{ rows: [{ key: 'id', value: '42' }], onValueChange }}
      />,
    );
    const token = container.querySelector<HTMLElement>('[data-path-param="id"]')!;
    expect(token.getAttribute('data-ref')).toBeNull();
    fireEvent.mouseOver(token);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toMatchObject({ kind: 'path-param', name: 'id', value: '42', anchorEl: token });
    expect(open.mock.calls[0][0].onSave).toBe(onValueChange);
  });

  it('a name without a row opens with an empty value; a {{ref}} still opens the reference session', () => {
    const { container } = render(
      <TemplateInput value="{{base}}/users/:id" onChange={vi.fn()} pathParams={{ rows: [], onValueChange: vi.fn() }} />,
    );
    fireEvent.mouseOver(container.querySelector('[data-path-param="id"]')!);
    expect(open.mock.calls[0][0]).toMatchObject({ kind: 'path-param', name: 'id', value: '' });
    fireEvent.mouseOver(container.querySelector('[data-ref="base"]')!);
    expect(open.mock.calls[1][0]).toMatchObject({ reference: 'base' });
    expect(open.mock.calls[1][0].kind).toBeUndefined();
  });

  it('a field without the opt-in leaves a colon as plain text', () => {
    const { container } = render(<TemplateInput value="/users/:id" onChange={vi.fn()} />);
    expect(container.querySelector('[data-path-param]')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });
});
