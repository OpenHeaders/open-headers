/**
 * Connection-draft layer — stages edits to the connection-identity
 * settings instead of committing them on blur.
 *
 * A wrong value in `backend.url` or `backend.bindPort` reconfigures the
 * live wire the moment it lands: the client dialer reconnects to the new
 * address, or the desktop daemon tears down and rebinds its WebSocket
 * server (`daemon-bind-supervisor`). Committing those on blur means
 * tabbing out of a half-typed field silently moves the connection. So
 * these two keys are *staged* — the editors write a local draft, and the
 * BackendPane's ApplyBar commits the draft atomically through one
 * explicit "Apply & reconnect" gesture (and can offer Revert afterward).
 *
 * The toggle that shares this concern — `backend.bindAddress` (LAN peers)
 * — is deliberately NOT staged: it already gates intent behind its own
 * opt-in confirmation modal, and a Switch that needs a separate Apply
 * reads as broken. Only the silently-committing typed fields are staged.
 *
 * Editors call {@link useConnectionField}, which transparently falls back
 * to the plain store binding (auto-apply) when no provider is mounted —
 * so the same editors keep working in the settings-search path, where
 * there's no ApplyBar to commit a draft.
 */

import { createContext, useContext, useMemo, useState } from 'react';
import type React from 'react';
import { useSetting, useSettingValue } from '../hooks';
import type { SettingsMap } from '../types';

/** Settings whose edits are staged and applied atomically. */
export const CONNECTION_DRAFT_KEYS = ['backend.url', 'backend.bindPort'] as const;
export type ConnectionDraftKey = (typeof CONNECTION_DRAFT_KEYS)[number];

/** A set of connection-key values — used both for the in-flight draft
 *  and for the pre-commit snapshot the ApplyBar reverts to. */
export type ConnectionDraftSnapshot = Partial<Pick<SettingsMap, ConnectionDraftKey>>;
type DraftValues = ConnectionDraftSnapshot;

export interface ConnectionDraftHandle {
  /** Staged value if edited, else the persisted store value. */
  effective: <K extends ConnectionDraftKey>(key: K) => SettingsMap[K];
  /** Stage an edit. Typing back to the persisted value clears the edit. */
  stage: <K extends ConnectionDraftKey>(key: K, value: SettingsMap[K]) => void;
  /** Discard the staged edit for one key (back to persisted). */
  discard: (key: ConnectionDraftKey) => void;
  isDirty: (key: ConnectionDraftKey) => boolean;
  dirtyKeys: ConnectionDraftKey[];
  /**
   * Commit every staged edit to the store atomically (one debounced
   * flush, since both keys share the `user` scope). Returns the
   * pre-commit values of the keys that changed so the caller can offer
   * Revert.
   */
  commit: () => DraftValues;
}

const ConnectionDraftContext = createContext<ConnectionDraftHandle | null>(null);

export const ConnectionDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const urlPersisted = useSettingValue('backend.url');
  const portPersisted = useSettingValue('backend.bindPort');
  const [, setUrl] = useSetting('backend.url');
  const [, setPort] = useSetting('backend.bindPort');
  const [draft, setDraft] = useState<DraftValues>({});

  const handle = useMemo<ConnectionDraftHandle>(() => {
    const persisted: Pick<SettingsMap, ConnectionDraftKey> = {
      'backend.url': urlPersisted,
      'backend.bindPort': portPersisted,
    };

    function effective<K extends ConnectionDraftKey>(key: K): SettingsMap[K] {
      const staged = draft[key];
      // Indexed access over the key subset can't be proven equal to
      // SettingsMap[K] by the checker (the same limitation store.ts and
      // useUntypedSetting cast around); the registry guarantees the value
      // shape per key.
      return (staged === undefined ? persisted[key] : staged) as SettingsMap[K];
    }

    function isDirty(key: ConnectionDraftKey): boolean {
      const staged = draft[key];
      return staged !== undefined && staged !== persisted[key];
    }

    function stage<K extends ConnectionDraftKey>(key: K, value: SettingsMap[K]): void {
      setDraft((prev) => {
        const next = { ...prev };
        if (value === persisted[key]) delete next[key];
        else next[key] = value;
        return next;
      });
    }

    function discard(key: ConnectionDraftKey): void {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    // Explicit per-key so the snapshot and store writes stay precisely
    // typed (a generic loop over the key union loses the value type).
    function commit(): DraftValues {
      const snapshot: DraftValues = {};
      if (isDirty('backend.url')) {
        snapshot['backend.url'] = persisted['backend.url'];
        setUrl(effective('backend.url'));
      }
      if (isDirty('backend.bindPort')) {
        snapshot['backend.bindPort'] = persisted['backend.bindPort'];
        setPort(effective('backend.bindPort'));
      }
      setDraft({});
      return snapshot;
    }

    return {
      effective,
      stage,
      discard,
      isDirty,
      dirtyKeys: CONNECTION_DRAFT_KEYS.filter(isDirty),
      commit,
    };
  }, [draft, urlPersisted, portPersisted, setUrl, setPort]);

  return <ConnectionDraftContext.Provider value={handle}>{children}</ConnectionDraftContext.Provider>;
};

/** The active draft handle, or null outside a provider. */
export function useConnectionDraft(): ConnectionDraftHandle | null {
  return useContext(ConnectionDraftContext);
}

export interface ConnectionFieldBinding<K extends ConnectionDraftKey> {
  value: SettingsMap[K];
  setValue: (value: SettingsMap[K]) => void;
  /** Edited but not yet applied (staged ≠ persisted). Always false when unstaged. */
  dirty: boolean;
  /** Discard the staged edit. No-op when unstaged. */
  discard: () => void;
}

/**
 * Read/write a connection-identity setting through the draft when a
 * provider is mounted, or straight through the store (auto-apply) when
 * it isn't. Mirrors `useSetting`'s shape with two extra signals the
 * staged editors use to drive the FieldRow dot + discard affordance.
 */
export function useConnectionField<K extends ConnectionDraftKey>(key: K): ConnectionFieldBinding<K> {
  const draft = useConnectionDraft();
  const [stored, setStored] = useSetting(key);
  if (draft) {
    return {
      value: draft.effective(key),
      setValue: (value) => draft.stage(key, value),
      dirty: draft.isDirty(key),
      discard: () => draft.discard(key),
    };
  }
  return { value: stored, setValue: setStored, dirty: false, discard: () => undefined };
}
