/**
 * First-run product-telemetry disclosure as a Notifications-panel card
 * (`TELEMETRY_PLAN.md` §2/§8 — redesigned vehicle after the blocking
 * modal was rejected).
 *
 * Pins the disclosure contracts:
 *   - the card pushes sticky + dedupe-keyed on the counting hosts only
 *     (extension and desktop, never a daemon-served web workbench), and
 *     pushing alone never sets the disclosure flag;
 *   - the card being seen (panel closed while it was up) sets
 *     `oh.productTelemetry.disclosed` — disclosure means the copy was
 *     on screen;
 *   - the action click sets the flag, opens the setting, dismisses the
 *     card, and retires it for good (no re-push on remount);
 *   - already-disclosed sessions still get the card as a pointer until
 *     the action is followed.
 */

import { type HostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import {
  __resetNotificationsForTests,
  markAllNotificationsSeen,
  useNotifications,
} from '@openheaders/ui/shared/notifications';
import {
  PRODUCT_TELEMETRY_DISCLOSURE_KEY,
  useProductTelemetryDisclosureNotification,
} from '@openheaders/ui/shared/product-telemetry';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, unknown> = {};

beforeEach(() => {
  store = {};
  __resetNotificationsForTests();
  window.localStorage.clear();
  setCurrentHost('extension');
  const fake: Partial<HostStorage> = {
    get: vi.fn(async (spec: { key: string }) => store[spec.key]) as HostStorage['get'],
    set: vi.fn(async (spec: { key: string }, value: unknown) => {
      store[spec.key] = value;
    }) as HostStorage['set'],
  };
  setHostStorage(fake as HostStorage);
});

afterEach(() => {
  setCurrentHost('extension');
});

function useHarness(open: () => void) {
  useProductTelemetryDisclosureNotification(open);
  return useNotifications();
}

async function renderDisclosure(open: () => void = () => {}) {
  const rendered = renderHook(() => useHarness(open));
  await waitFor(() => {
    expect(rendered.result.current.some((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY)).toBe(true);
  });
  return rendered;
}

describe('useProductTelemetryDisclosureNotification', () => {
  it('pushes one sticky card with the review action; pushing alone never discloses', async () => {
    const { result } = await renderDisclosure();
    const cards = result.current.filter((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY);
    expect(cards).toHaveLength(1);
    expect(cards[0].sticky).toBe(true);
    expect(cards[0].title).toBe('Anonymous usage counting');
    expect(cards[0].actions?.map((a) => a.label)).toEqual(['Review setting']);
    expect(store[OH.productTelemetryDisclosed.key]).toBeUndefined();
  });

  it('pushes nothing on a daemon-served web workbench', async () => {
    setCurrentHost('web');
    const { result } = renderHook(() => useHarness(() => {}));
    await act(async () => {});
    expect(result.current).toHaveLength(0);
    expect(store[OH.productTelemetryDisclosed.key]).toBeUndefined();
  });

  it('pushes the card on the desktop workbench too', async () => {
    setCurrentHost('desktop');
    const { result } = await renderDisclosure();
    expect(result.current.some((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY)).toBe(true);
  });

  it('sets the disclosure flag once the card is seen, keeping the card up', async () => {
    const { result } = await renderDisclosure();
    act(() => markAllNotificationsSeen());
    await waitFor(() => {
      expect(store[OH.productTelemetryDisclosed.key]).toBe(true);
    });
    expect(result.current.some((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY)).toBe(true);
  });

  it('action click discloses, opens the setting, dismisses, and retires for good', async () => {
    const open = vi.fn();
    const { result } = await renderDisclosure(open);
    const card = result.current.find((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY);
    act(() => card?.actions?.[0].run());

    expect(store[OH.productTelemetryDisclosed.key]).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(result.current.some((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY)).toBe(false);

    __resetNotificationsForTests();
    const remounted = renderHook(() => useHarness(open));
    await act(async () => {});
    expect(remounted.result.current).toHaveLength(0);
  });

  it('still pushes the pointer card when disclosure already happened elsewhere', async () => {
    store[OH.productTelemetryDisclosed.key] = true;
    const { result } = await renderDisclosure();
    expect(result.current.some((e) => e.dedupeKey === PRODUCT_TELEMETRY_DISCLOSURE_KEY)).toBe(true);
  });
});
