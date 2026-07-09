/**
 * DOM storage write notifier — the panel-side instant feed the document
 * editors ride for writes this panel makes. Notes carry no data;
 * consumers refetch through the read seam.
 */

import {
  notifyDomStorageWrite,
  subscribeDomStorageWrites,
} from '@openheaders/ui/panel/data/storage/dom-storage-write-notifier';
import { describe, expect, it, vi } from 'vitest';

describe('dom-storage-write-notifier', () => {
  it('notifies every subscriber and stops after unsubscribe', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeDomStorageWrites(a);
    const offB = subscribeDomStorageWrites(b);

    notifyDomStorageWrite();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    offA();
    notifyDomStorageWrite();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
    offB();
  });

  it('a crashing listener does not stop the others', () => {
    const crash = vi.fn(() => {
      throw new Error('listener crash');
    });
    const after = vi.fn();
    const offCrash = subscribeDomStorageWrites(crash);
    const offAfter = subscribeDomStorageWrites(after);

    expect(() => notifyDomStorageWrite()).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    offCrash();
    offAfter();
  });
});
