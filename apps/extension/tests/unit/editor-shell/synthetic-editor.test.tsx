/**
 * Synthetic-editor harness for the editor-shell Phase A spike.
 *
 * Each test targets one row of the bug-class predictions table in
 * the editor-shell spike notes. Tests intentionally reach for the
 * shape of the bug and assert the hook prevents it (compile-time error
 * captured via @ts-expect-error, render-time invariant, or branded-type
 * rejection).
 */

import { act, renderHook } from '@testing-library/react';
import { type ReactNode, useEffect, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveEditorDirtyProvider, useActiveEditorDirty } from '@openheaders/ui/shared/awareness/ActiveEditorDirty';
import { ActiveFieldFocusProvider } from '@openheaders/ui/shared/awareness/ActiveFieldFocus';
import { ActiveTabEntityProvider, useSetActiveTabEntity } from '@openheaders/ui/shared/awareness/ActiveTabEntity';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import type { EditorShellHeaderWiring, EditorShellScopeWiring } from '@openheaders/ui/shared/editor-shell';

interface Env {
  uid: string;
  variables: { uid: string; name: string; value: string }[];
}

const baseEnv: Env = {
  uid: 'env-1',
  variables: [{ uid: 'v1', name: 'API_BASE', value: 'https://api.openheaders.io' }],
};

function envSig(e: Env): string {
  return JSON.stringify(e);
}

function ActiveTabSeeder({ value }: { value: { entityType: string; entityId: string } | null }): null {
  const set = useSetActiveTabEntity();
  useEffect(() => {
    set(value);
  }, [value, set]);
  return null;
}

function Wrapper({
  children,
  activeTab,
}: {
  children: ReactNode;
  activeTab?: { entityType: string; entityId: string };
}): ReactNode {
  return (
    <ActiveFieldFocusProvider>
      <ActiveTabEntityProvider>
        <ActiveTabSeeder value={activeTab ?? null} />
        <ActiveEditorDirtyProvider>{children}</ActiveEditorDirtyProvider>
      </ActiveTabEntityProvider>
    </ActiveFieldFocusProvider>
  );
}

// ── T1 — BC1: comparison shape eliminated by construction ───────────

describe('editor-shell — BC1 (comparison shape)', () => {
  it('derives isDirty from form-vs-primed inside the hook; editor never reads both fingerprints', () => {
    const populate = vi.fn();
    const { result, rerender } = renderHook(
      ({ formFp }: { formFp: string }) =>
        useReprime<Env>({
          liveEntity: baseEnv,
          scope: { entityType: 'environment', entityId: baseEnv.uid },
          enabled: true,
          formFingerprint: formFp,
          signature: envSig,
          populate,
        }),
      {
        wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
        initialProps: { formFp: envSig(baseEnv) },
      },
    );

    // After mount, populate fires + primed advances to liveSig.
    expect(populate).toHaveBeenCalledTimes(1);
    expect(result.current.primedFingerprint).toBe(envSig(baseEnv));
    expect(result.current.isDirty).toBe(false);

    // User typing — formFp diverges from primedFp.
    act(() => {
      rerender({ formFp: 'user-typed-something-different' });
    });
    expect(result.current.isDirty).toBe(true);

    // The hook output exposes `isDirty` + `primedFingerprint` only —
    // there is no `liveFingerprint` field on the return shape, so the
    // editor literally cannot write `liveFp !== formFp` via the hook
    // surface. Verified at the type level below via @ts-expect-error.
    // @ts-expect-error — `liveFingerprint` is intentionally not on the output
    void result.current.liveFingerprint;
  });
});

// ── Open/reprime transient: no spurious dirty flash ─────────────────

describe('editor-shell — settling transient (no dirty flash)', () => {
  it('stays clean while the form fingerprint lags a freshly-primed baseline, then opens dirty on a real edit', () => {
    const populate = vi.fn();
    const { result, rerender } = renderHook(
      ({ formFp }: { formFp: string }) =>
        useReprime<Env>({
          liveEntity: baseEnv,
          scope: { entityType: 'environment', entityId: baseEnv.uid },
          enabled: true,
          formFingerprint: formFp,
          signature: envSig,
          populate,
        }),
      {
        wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
        // Form fingerprint starts empty — `Form.useWatch` hasn't
        // reflected the populate's `setFieldsValue` yet. This is the
        // real open-tab transient that used to flash a dirty dot.
        initialProps: { formFp: '' },
      },
    );

    // populate fired and primed advanced to the entity signature, but
    // the form fingerprint still lags. Dirty MUST stay false — the
    // mismatch is the settling transient, not a user edit.
    expect(populate).toHaveBeenCalledTimes(1);
    expect(result.current.primedFingerprint).toBe(envSig(baseEnv));
    expect(result.current.isDirty).toBe(false);

    // Form catches up to the primed baseline — still clean.
    act(() => {
      rerender({ formFp: envSig(baseEnv) });
    });
    expect(result.current.isDirty).toBe(false);

    // A real edit now diverges from the settled baseline — dirty opens.
    act(() => {
      rerender({ formFp: 'user-edited' });
    });
    expect(result.current.isDirty).toBe(true);
  });
});

// ── T2 — BC2 (partial): reprime gating across dirty cycle ───────────

describe('editor-shell — BC2 (reprime timing, narrowed)', () => {
  it('reprime fires only when clean; does not fire while user is dirty even if live changes', () => {
    const populate = vi.fn();
    let liveEntity: Env = baseEnv;
    const { result, rerender } = renderHook(
      ({ formFp }: { formFp: string }) =>
        useReprime<Env>({
          liveEntity,
          scope: { entityType: 'environment', entityId: baseEnv.uid },
          enabled: true,
          formFingerprint: formFp,
          signature: envSig,
          populate,
        }),
      {
        wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
        initialProps: { formFp: envSig(baseEnv) },
      },
    );
    expect(populate).toHaveBeenCalledTimes(1);

    // User edits — go dirty.
    act(() => {
      rerender({ formFp: 'user-typed' });
    });
    expect(result.current.isDirty).toBe(true);

    // Peer commits new live entity — reprime MUST NOT fire (dirty gate).
    liveEntity = { ...baseEnv, variables: [{ uid: 'v1', name: 'API_BASE', value: 'https://changed' }] };
    act(() => {
      rerender({ formFp: 'user-typed' });
    });
    expect(populate).toHaveBeenCalledTimes(1); // still just the initial mount

    // User reverts to a value matching live — auto-rebase fires + primed catches up.
    act(() => {
      rerender({ formFp: envSig(liveEntity) });
    });
    expect(result.current.isDirty).toBe(false);
    expect(result.current.primedFingerprint).toBe(envSig(liveEntity));
  });

  it('NARROWED gap: populate is editor-supplied; stale-closure populate still possible (documented)', () => {
    // The hook narrows BC2 (gating + clean-check + dispatch sequence
    // are owned) but cannot eliminate populate-internal stale-closure
    // bugs, since the editor still supplies the populate body. This
    // assertion exists to make the gap explicit in the test record:
    // any future migration that observes a populate stale-closure bug
    // is a Phase B observation, not a spike failure.
    expect(true).toBe(true);
  });
});

// ── T3 — BC6: branded header wiring eliminates manual construction ─

describe('editor-shell — BC6 (header wiring brand)', () => {
  it('EditorShellHeaderWiring cannot be constructed by the editor', () => {
    // @ts-expect-error — editor cannot fabricate a branded wiring
    const fake: EditorShellHeaderWiring = { isDirty: true, onSave: () => undefined };
    void fake;
  });

  it('hook output supplies the branded wiring', () => {
    const { result } = renderHook(
      () =>
        useEditorShell({
          entityType: 'environment',
          entityId: baseEnv.uid,
          isDirty: false,
          onSave: () => undefined,
        }),
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );
    // Brand is a type-only marker, so we can only assert structurally
    // that the wiring carries the expected runtime shape.
    const wiring = result.current.headerProps as unknown as { isDirty: boolean; onSave: () => void };
    expect(typeof wiring.onSave).toBe('function');
    expect(wiring.isDirty).toBe(false);
  });
});

// ── T4 — BC7: dirty publishing bundled into the shell ───────────────

describe('editor-shell — BC7 (dirty publishing bundled)', () => {
  it('publishes the dirty marker into ActiveEditorDirty without a separate useEditorDirty call', () => {
    const harness = renderHook(
      ({ dirty }: { dirty: boolean }) => {
        const shell = useEditorShell({
          entityType: 'environment',
          entityId: baseEnv.uid,
          isDirty: dirty,
          onSave: () => undefined,
        });
        const published = useActiveEditorDirty();
        return { shell, published };
      },
      {
        wrapper: ({ children }) => (
          <Wrapper activeTab={{ entityType: 'environment', entityId: baseEnv.uid }}>{children}</Wrapper>
        ),
        initialProps: { dirty: false },
      },
    );

    expect(harness.result.current.shell.isDirty).toBe(false);
    expect(harness.result.current.published).toBeNull();

    act(() => {
      harness.rerender({ dirty: true });
    });

    expect(harness.result.current.shell.isDirty).toBe(true);
    expect(harness.result.current.published).not.toBeNull();
    expect(harness.result.current.published?.entityType).toBe('environment');
    expect(harness.result.current.published?.entityId).toBe(baseEnv.uid);
  });
});

// ── T5 — BC8: scope wiring bound to single entityType input ─────────

describe('editor-shell — BC8 (scope entityType single-source)', () => {
  it('scopeProps re-emit the same entityType the hook was given; editor cannot mismatch', () => {
    const { result } = renderHook(
      () =>
        useEditorShell({
          entityType: 'environment',
          entityId: baseEnv.uid,
          isDirty: false,
          onSave: () => undefined,
        }),
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );

    const wiring = result.current.scopeProps as unknown as { entityType: string; entityId: string | null };
    expect(wiring.entityType).toBe('environment');
    expect(wiring.entityId).toBe(baseEnv.uid);
  });

  it('EditorShellScopeWiring cannot be constructed by the editor', () => {
    // @ts-expect-error — editor cannot fabricate the branded scope
    const fake: EditorShellScopeWiring = { entityType: 'environment', entityId: 'env-1' };
    void fake;
  });
});

// ── T6 — sensitive-entity carve-out ─────────────────────────────────

describe('editor-shell — sensitive-entity carve-out', () => {
  it('disableFieldFocus=true returns field=null', () => {
    const { result } = renderHook(
      () =>
        useEditorShell({
          entityType: 'vault',
          entityId: 'vault-1',
          isDirty: false,
          onSave: () => undefined,
          options: { disableFieldFocus: true },
        }),
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );
    expect(result.current.field).toBeNull();
  });

  it('default (non-sensitive) returns a callable field builder', () => {
    const { result } = renderHook(
      () =>
        useEditorShell({
          entityType: 'environment',
          entityId: baseEnv.uid,
          isDirty: false,
          onSave: () => undefined,
        }),
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );
    expect(typeof result.current.field).toBe('function');
    const props = result.current.field?.('variables.v1.name');
    expect(props).toEqual({
      path: 'variables.v1.name',
      entityType: 'environment',
      entityId: baseEnv.uid,
    });
  });
});

// ── Create-mode + null entityId ─────────────────────────────────────

describe('editor-shell — create mode', () => {
  it('accepts entityId=null (create mode) and reflects editor-supplied isDirty', () => {
    const { result, rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) =>
        useEditorShell({
          entityType: 'environment',
          entityId: null,
          isDirty: dirty,
          onSave: () => undefined,
        }),
      {
        wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
        initialProps: { dirty: false },
      },
    );
    expect(result.current.isDirty).toBe(false);
    act(() => {
      rerender({ dirty: true });
    });
    expect(result.current.isDirty).toBe(true);
  });
});

// Suppress unused-import warning.
void useState;
