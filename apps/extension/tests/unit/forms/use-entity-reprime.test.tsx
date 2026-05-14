import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActiveFieldFocusProvider, useSetActiveFieldFocus } from '@openheaders/ui/shared/awareness/ActiveFieldFocus';
import { useEntityReprime } from '@openheaders/ui/shared/forms/use-entity-reprime';

interface RuleLike {
  uid: string;
  name: string;
  payload: number;
}

const baseRule: RuleLike = { uid: 'r1', name: 'a', payload: 0 };

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveFieldFocusProvider>{children}</ActiveFieldFocusProvider>;
}

function jsonSignature(r: RuleLike): string {
  return JSON.stringify(r);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEntityReprime', () => {
  it('runs populate on first arrival when enabled and no gates trip', () => {
    const populate = vi.fn();
    renderHook(
      () =>
        useEntityReprime<RuleLike>({
          liveEntity: baseRule,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      { wrapper },
    );
    expect(populate).toHaveBeenCalledTimes(1);
    expect(populate).toHaveBeenCalledWith(baseRule);
  });

  it('does not populate when disabled', () => {
    const populate = vi.fn();
    renderHook(
      () =>
        useEntityReprime<RuleLike>({
          liveEntity: baseRule,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: false,
          signature: jsonSignature,
          populate,
        }),
      { wrapper },
    );
    expect(populate).not.toHaveBeenCalled();
  });

  it('does not populate while isDirty', () => {
    const populate = vi.fn();
    renderHook(
      () =>
        useEntityReprime<RuleLike>({
          liveEntity: baseRule,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: true,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      { wrapper },
    );
    expect(populate).not.toHaveBeenCalled();
  });

  it('skips re-prime when signature is unchanged across renders (mirror rebroadcasts identical content)', () => {
    const populate = vi.fn();
    const { rerender } = renderHook(
      ({ entity }: { entity: RuleLike }) =>
        useEntityReprime<RuleLike>({
          liveEntity: entity,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      { wrapper, initialProps: { entity: baseRule } },
    );
    expect(populate).toHaveBeenCalledTimes(1);
    // New object, identical content — signature unchanged.
    rerender({ entity: { ...baseRule } });
    expect(populate).toHaveBeenCalledTimes(1);
  });

  it('re-primes when signature changes (real external mutation)', () => {
    const populate = vi.fn();
    const { rerender } = renderHook(
      ({ entity }: { entity: RuleLike }) =>
        useEntityReprime<RuleLike>({
          liveEntity: entity,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      { wrapper, initialProps: { entity: baseRule } },
    );
    expect(populate).toHaveBeenCalledTimes(1);
    rerender({ entity: { ...baseRule, payload: 99 } });
    expect(populate).toHaveBeenCalledTimes(2);
  });

  it('skips re-prime while local has a field of THIS entity focused', () => {
    const populate = vi.fn();
    const focusRef: { setFocus: ReturnType<typeof useSetActiveFieldFocus> | null } = { setFocus: null };
    function Capture() {
      focusRef.setFocus = useSetActiveFieldFocus();
      return null;
    }
    const { rerender } = renderHook(
      ({ entity }: { entity: RuleLike }) =>
        useEntityReprime<RuleLike>({
          liveEntity: entity,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      {
        wrapper: ({ children }) => (
          <ActiveFieldFocusProvider>
            <Capture />
            {children}
          </ActiveFieldFocusProvider>
        ),
        initialProps: { entity: baseRule },
      },
    );
    // Initial populate happened with no focus.
    expect(populate).toHaveBeenCalledTimes(1);
    // User focuses a field of THIS rule.
    act(() => {
      focusRef.setFocus?.({ entityType: 'rule', entityId: 'r1', path: 'name' });
    });
    // External mutation arrives.
    rerender({ entity: { ...baseRule, payload: 1 } });
    // Still gated — local is focused on this entity.
    expect(populate).toHaveBeenCalledTimes(1);
    // User blurs.
    act(() => {
      focusRef.setFocus?.(null);
    });
    // Now the gate releases — re-prime catches up.
    expect(populate).toHaveBeenCalledTimes(2);
  });

  it('does NOT skip when local is focused on a DIFFERENT entity', () => {
    const populate = vi.fn();
    const focusRef: { setFocus: ReturnType<typeof useSetActiveFieldFocus> | null } = { setFocus: null };
    function Capture() {
      focusRef.setFocus = useSetActiveFieldFocus();
      return null;
    }
    const { rerender } = renderHook(
      ({ entity }: { entity: RuleLike }) =>
        useEntityReprime<RuleLike>({
          liveEntity: entity,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      {
        wrapper: ({ children }) => (
          <ActiveFieldFocusProvider>
            <Capture />
            {children}
          </ActiveFieldFocusProvider>
        ),
        initialProps: { entity: baseRule },
      },
    );
    expect(populate).toHaveBeenCalledTimes(1);
    act(() => {
      focusRef.setFocus?.({ entityType: 'request', entityId: 'q1', path: 'url' });
    });
    rerender({ entity: { ...baseRule, payload: 2 } });
    expect(populate).toHaveBeenCalledTimes(2);
  });

  it('markPopulated seeds the signature so a subsequent identical broadcast is a no-op', () => {
    const populate = vi.fn();
    let handle: ReturnType<typeof useEntityReprime<RuleLike>> | null = null;
    const { rerender } = renderHook(
      ({ entity, enabled }: { entity: RuleLike | null; enabled: boolean }) => {
        handle = useEntityReprime<RuleLike>({
          liveEntity: entity,
          scope: { entityType: 'rule', entityId: 'r1' },
          isDirty: false,
          enabled,
          signature: jsonSignature,
          populate,
        });
        return handle;
      },
      { wrapper, initialProps: { entity: null as RuleLike | null, enabled: false } },
    );
    // Caller's own init pass populates manually + seeds the signature.
    act(() => {
      handle?.markPopulated(baseRule);
    });
    // Now becomes enabled with the same content the caller already populated.
    rerender({ entity: baseRule, enabled: true });
    // Hook recognizes the signature and skips re-prime.
    expect(populate).not.toHaveBeenCalled();
    // A real change still re-primes.
    rerender({ entity: { ...baseRule, payload: 7 }, enabled: true });
    expect(populate).toHaveBeenCalledTimes(1);
  });

  it('treats null/undefined entityId as "skip" (drafts before first save)', () => {
    const populate = vi.fn();
    renderHook(
      () =>
        useEntityReprime<RuleLike>({
          liveEntity: null,
          scope: { entityType: 'rule', entityId: null },
          isDirty: false,
          enabled: true,
          signature: jsonSignature,
          populate,
        }),
      { wrapper },
    );
    expect(populate).not.toHaveBeenCalled();
  });
});
