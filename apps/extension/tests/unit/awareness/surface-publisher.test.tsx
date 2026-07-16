import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveEditorDirtyProvider,
  useSetActiveEditorDirty,
} from '@openheaders/ui/shared/awareness/ActiveEditorDirty';
import {
  ActiveFieldFocusProvider,
  useSetActiveFieldFocus,
} from '@openheaders/ui/shared/awareness/ActiveFieldFocus';
import { ActiveTabEntityProvider, useSetActiveTabEntity } from '@openheaders/ui/shared/awareness/ActiveTabEntity';
import { useEffect } from 'react';

// Mock useAwareness so we can observe the publisher's composed claim
// without spinning up the coordinator + identity stack.
const useAwarenessMock = vi.fn();
vi.mock('@openheaders/ui/shared/hooks/useAwareness', () => ({
  useAwareness: (opts: unknown) => {
    useAwarenessMock(opts);
  },
}));
// Identity context is consumed by the publisher; provide a stub.
vi.mock('@openheaders/ui/shared/awareness/IdentityContext', () => ({
  useSurfaceIdentity: () => ({
    current: () => ({
      instanceId: 'inst-1',
      surfaceKind: 'workbench' as const,
      appId: 'extension' as const,
      labelContext: 'Test',
    }),
    setContext: () => undefined,
    onContextChange: () => () => undefined,
  }),
}));

// Import AFTER mocks so vi.mock applies.
import { SurfaceAwarenessPublisher } from '@openheaders/ui/shared/awareness/SurfaceAwarenessPublisher';

interface HarnessProps {
  activeTab: { entityType: string; entityId: string } | null;
  children?: ReactNode;
  migratedEntityTypes?: readonly string[];
}

function ActiveTabSeeder({ value }: { value: { entityType: string; entityId: string } | null }): null {
  const set = useSetActiveTabEntity();
  useEffect(() => {
    set(value);
  }, [value, set]);
  return null;
}

function Harness({ activeTab, children, migratedEntityTypes = ['rule'] }: HarnessProps): ReactNode {
  return (
    <ActiveFieldFocusProvider>
      <ActiveEditorDirtyProvider>
        <ActiveTabEntityProvider>
          <ActiveTabSeeder value={activeTab} />
          {children}
          <SurfaceAwarenessPublisher workspaceId="ws-1" migratedEntityTypes={migratedEntityTypes} />
        </ActiveTabEntityProvider>
      </ActiveEditorDirtyProvider>
    </ActiveFieldFocusProvider>
  );
}

function lastClaim(): { entityFocus: unknown; fieldFocus: unknown; dirtyFields: unknown; enabled: unknown } {
  const calls = useAwarenessMock.mock.calls;
  if (calls.length === 0) throw new Error('useAwareness was never called');
  return calls[calls.length - 1][0];
}

describe('SurfaceAwarenessPublisher', () => {
  beforeEach(() => {
    useAwarenessMock.mockClear();
  });

  it('publishes nothing (enabled: false) when the active tab is not a migrated entity', () => {
    render(<Harness activeTab={{ entityType: 'request', entityId: 'q1' }} migratedEntityTypes={['rule']} />);
    const claim = lastClaim();
    expect(claim.enabled).toBe(false);
    expect(claim.entityFocus).toBeNull();
    expect(claim.fieldFocus).toBeNull();
    expect(claim.dirtyFields).toEqual([]);
  });

  it('publishes entityFocus from ActiveTabEntity when the entity is migrated', () => {
    render(<Harness activeTab={{ entityType: 'rule', entityId: 'r1' }} />);
    const claim = lastClaim();
    expect(claim.enabled).toBe(true);
    expect(claim.entityFocus).toEqual({ type: 'rule', id: 'r1' });
    expect(claim.fieldFocus).toBeNull();
  });

  it('publishes fieldFocus when the active field belongs to the active tab entity', () => {
    function Inner() {
      const setFocus = useSetActiveFieldFocus();
      // Set focus on mount.
      if (typeof setFocus === 'function') {
        setFocus({ entityType: 'rule', entityId: 'r1', path: 'headerMods.uid1.value' });
      }
      return null;
    }
    render(
      <Harness activeTab={{ entityType: 'rule', entityId: 'r1' }}>
        <Inner />
      </Harness>,
    );
    const claim = lastClaim();
    expect(claim.fieldFocus).toEqual({ type: 'rule', id: 'r1', path: 'headerMods.uid1.value' });
    expect(claim.entityFocus).toEqual({ type: 'rule', id: 'r1' });
  });

  it('drops fieldFocus when the focus is on a different entity than the active tab', () => {
    // Cross-entity focus: user is on rule R1's tab but focused on a
    // different entity (e.g. sidebar inline-rename of a different rule).
    // The publisher stays silent on cross-entity focus to avoid
    // emitting a mixed (entityFocus=A, fieldFocus=B) row.
    function Inner() {
      const setFocus = useSetActiveFieldFocus();
      if (typeof setFocus === 'function') {
        setFocus({ entityType: 'rule', entityId: 'r2', path: 'name' });
      }
      return null;
    }
    render(
      <Harness activeTab={{ entityType: 'rule', entityId: 'r1' }}>
        <Inner />
      </Harness>,
    );
    const claim = lastClaim();
    expect(claim.fieldFocus).toBeNull();
    expect(claim.entityFocus).toEqual({ type: 'rule', id: 'r1' });
  });

  it('publishes dirtyFields only when ActiveEditorDirty matches the active tab entity', () => {
    function Inner() {
      const setDirty = useSetActiveEditorDirty();
      if (typeof setDirty === 'function') {
        setDirty({ entityType: 'rule', entityId: 'r1', dirtyFields: ['*'] });
      }
      return null;
    }
    render(
      <Harness activeTab={{ entityType: 'rule', entityId: 'r1' }}>
        <Inner />
      </Harness>,
    );
    const claim = lastClaim();
    expect(claim.dirtyFields).toEqual(['*']);
  });

  it('ignores ActiveEditorDirty when it points to a different entity than the active tab', () => {
    function Inner() {
      const setDirty = useSetActiveEditorDirty();
      if (typeof setDirty === 'function') {
        setDirty({ entityType: 'rule', entityId: 'r2', dirtyFields: ['*'] });
      }
      return null;
    }
    render(
      <Harness activeTab={{ entityType: 'rule', entityId: 'r1' }}>
        <Inner />
      </Harness>,
    );
    const claim = lastClaim();
    expect(claim.dirtyFields).toEqual([]);
  });

  it('regression: dirty flip does not erase fieldFocus (one voice, no MRT race)', () => {
    // The bug Session 1 was designed to fix. Both fieldFocus and
    // dirtyFields update through the same `useAwareness` call; whichever
    // order they change in, the other survives because they're composed
    // from independent contexts inside one publisher.
    function Inner() {
      const setFocus = useSetActiveFieldFocus();
      const setDirty = useSetActiveEditorDirty();
      if (typeof setFocus === 'function' && typeof setDirty === 'function') {
        setFocus({ entityType: 'rule', entityId: 'r1', path: 'value' });
        setDirty({ entityType: 'rule', entityId: 'r1', dirtyFields: ['*'] });
      }
      return null;
    }
    useAwarenessMock.mockClear();
    render(
      <Harness activeTab={{ entityType: 'rule', entityId: 'r1' }}>
        <Inner />
      </Harness>,
    );
    const claim = lastClaim();
    expect(claim.fieldFocus).toEqual({ type: 'rule', id: 'r1', path: 'value' });
    expect(claim.dirtyFields).toEqual(['*']);
  });
});
