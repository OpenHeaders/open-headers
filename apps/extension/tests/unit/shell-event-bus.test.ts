import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShellEventBus } from '@/rules/events/shell-event-bus';

describe('shell-event-bus', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('fans out capture-phase clicks to every subscriber', () => {
    const { bus, attach } = createShellEventBus();
    const detach = attach(root);

    const a = vi.fn();
    const b = vi.fn();
    bus.onClickCapture(a);
    bus.onClickCapture(b);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    detach();
  });

  it('stops delivering events after unsubscribe', () => {
    const { bus, attach } = createShellEventBus();
    const detach = attach(root);

    const fn = vi.fn();
    const unsub = bus.onClickCapture(fn);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);

    unsub();
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);

    detach();
  });

  it('detach removes every listener from the root and window', () => {
    const { bus, attach } = createShellEventBus();
    const detach = attach(root);

    const click = vi.fn();
    const focusIn = vi.fn();
    const focusOut = vi.fn();
    const keyDown = vi.fn();
    bus.onClickCapture(click);
    bus.onFocusIn(focusIn);
    bus.onFocusOut(focusOut);
    bus.onKeyDown(keyDown);

    detach();

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    root.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    root.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(click).not.toHaveBeenCalled();
    expect(focusIn).not.toHaveBeenCalled();
    expect(focusOut).not.toHaveBeenCalled();
    expect(keyDown).not.toHaveBeenCalled();
  });

  it('routes keydown through the window listener', () => {
    const { bus, attach } = createShellEventBus();
    const detach = attach(root);

    const fn = vi.fn();
    bus.onKeyDown(fn);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(fn).toHaveBeenCalledTimes(1);

    detach();
  });

  it('attach(null) is a no-op', () => {
    const { bus, attach } = createShellEventBus();
    const fn = vi.fn();
    bus.onClickCapture(fn);
    const detach = attach(null);

    root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(fn).not.toHaveBeenCalled();

    detach();
  });

  it('click-capture sees the event before child bubble handlers', () => {
    const { bus, attach } = createShellEventBus();
    const detach = attach(root);

    const order: string[] = [];
    bus.onClickCapture(() => order.push('bus-capture'));

    const child = document.createElement('button');
    root.appendChild(child);
    child.addEventListener('click', () => order.push('child-bubble'));

    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(order).toEqual(['bus-capture', 'child-bubble']);
    detach();
  });
});
