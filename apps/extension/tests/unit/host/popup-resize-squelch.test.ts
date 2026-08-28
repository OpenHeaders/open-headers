import { afterEach, describe, expect, it, vi } from 'vitest';
import { installPopupResizeSquelch } from '@/host/popup-resize-squelch';

function setInnerSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('installPopupResizeSquelch', () => {
  let dispose: (() => void) | null = null;

  afterEach(() => {
    dispose?.();
    dispose = null;
  });

  it('stops a resize whose viewport did not change before later listeners see it', () => {
    setInnerSize(800, 600);
    dispose = installPopupResizeSquelch(window);
    const listener = vi.fn();
    window.addEventListener('resize', listener);

    window.dispatchEvent(new Event('resize'));

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('resize', listener);
  });

  it('lets a real size change through and remembers the new size', () => {
    setInnerSize(800, 600);
    dispose = installPopupResizeSquelch(window);
    const listener = vi.fn();
    window.addEventListener('resize', listener);

    setInnerSize(320, 600);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('resize', listener);
  });

  it('stops squelching once disposed', () => {
    setInnerSize(800, 600);
    const off = installPopupResizeSquelch(window);
    const listener = vi.fn();
    window.addEventListener('resize', listener);

    off();
    window.dispatchEvent(new Event('resize'));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('resize', listener);
  });
});
