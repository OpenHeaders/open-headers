import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ActiveEditorDirtyProvider,
  useActiveEditorDirty,
} from '@openheaders/ui/shared/awareness/ActiveEditorDirty';
import { ActiveTabEntityProvider, useSetActiveTabEntity } from '@openheaders/ui/shared/awareness/ActiveTabEntity';
import { useEditorDirty } from '@openheaders/ui/shared/awareness/use-editor-dirty';
import { useEffect } from 'react';

interface TestEnvProps {
  activeTab: { entityType: string; entityId: string } | null;
  children: ReactNode;
}

function ActiveTabSeeder({ value }: { value: { entityType: string; entityId: string } | null }): null {
  const set = useSetActiveTabEntity();
  useEffect(() => {
    set(value);
  }, [value, set]);
  return null;
}

function Env({ activeTab, children }: TestEnvProps): ReactNode {
  return (
    <ActiveTabEntityProvider>
      <ActiveTabSeeder value={activeTab} />
      <ActiveEditorDirtyProvider>{children}</ActiveEditorDirtyProvider>
    </ActiveTabEntityProvider>
  );
}

function useEditorAndDirtyContext(scope: { entityType: string; entityId: string | null }, isDirty: boolean) {
  useEditorDirty(scope, isDirty);
  return useActiveEditorDirty();
}

describe('useEditorDirty', () => {
  it('writes the dirty marker when this editor is the active tab', () => {
    const { result } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useEditorAndDirtyContext({ entityType: 'rule', entityId: 'r1' }, isDirty),
      {
        wrapper: ({ children }) => (
          <Env activeTab={{ entityType: 'rule', entityId: 'r1' }}>{children}</Env>
        ),
        initialProps: { isDirty: true },
      },
    );
    expect(result.current).toEqual({ entityType: 'rule', entityId: 'r1', dirtyFields: ['*'] });
  });

  it('clears the marker when isDirty flips to false', () => {
    const { result, rerender } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useEditorAndDirtyContext({ entityType: 'rule', entityId: 'r1' }, isDirty),
      {
        wrapper: ({ children }) => (
          <Env activeTab={{ entityType: 'rule', entityId: 'r1' }}>{children}</Env>
        ),
        initialProps: { isDirty: true },
      },
    );
    expect(result.current).not.toBeNull();
    rerender({ isDirty: false });
    expect(result.current).toBeNull();
  });

  it('stays silent when this editor is NOT the active tab (inactive dock-layout tabs)', () => {
    const { result } = renderHook(
      ({ isDirty }: { isDirty: boolean }) =>
        useEditorAndDirtyContext({ entityType: 'rule', entityId: 'r1' }, isDirty),
      {
        wrapper: ({ children }) => (
          // Active tab is a DIFFERENT entity — this editor is in a hidden tab.
          <Env activeTab={{ entityType: 'request', entityId: 'q1' }}>{children}</Env>
        ),
        initialProps: { isDirty: true },
      },
    );
    expect(result.current).toBeNull();
  });

  it('clears the context when the editor unmounts', () => {
    const { result, unmount } = renderHook(
      () => useEditorAndDirtyContext({ entityType: 'rule', entityId: 'r1' }, true),
      {
        wrapper: ({ children }) => (
          <Env activeTab={{ entityType: 'rule', entityId: 'r1' }}>{children}</Env>
        ),
      },
    );
    expect(result.current).not.toBeNull();
    act(() => {
      unmount();
    });
    // After unmount, render a fresh consumer to read the context.
    const { result: reader } = renderHook(() => useActiveEditorDirty(), {
      wrapper: ({ children }) => (
        <Env activeTab={{ entityType: 'rule', entityId: 'r1' }}>{children}</Env>
      ),
    });
    expect(reader.current).toBeNull();
  });

  it('handles null entityId (drafts before first save) by staying silent', () => {
    const { result } = renderHook(
      () => useEditorAndDirtyContext({ entityType: 'rule', entityId: null }, true),
      {
        wrapper: ({ children }) => <Env activeTab={null}>{children}</Env>,
      },
    );
    expect(result.current).toBeNull();
  });
});
