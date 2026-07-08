/**
 * Connection-draft layer — stages edits to the connection-identity
 * fields instead of committing them on blur.
 *
 * A wrong value in the backend address or `backend.bindPort` reconfigures
 * the live wire the moment it lands: the client dialer reconnects to the
 * new address, or the desktop daemon tears down and rebinds its WebSocket
 * server (`daemon-bind-supervisor`). Committing those on blur means
 * tabbing out of a half-typed field silently moves the connection. So
 * these two fields are *staged* — the editors write a local draft, and the
 * BackendPane's ApplyBar commits the draft atomically through one
 * explicit "Apply & reconnect" gesture (and can offer Revert afterward).
 *
 * Backing stores differ per field since the multi-backend Phase-1
 * retirement: `backend.url` is the primary `OH.backends` record's URL
 * (`updatePrimaryBackend`), while `backend.bindPort` remains a settings
 * key (daemon-side, this process as a server). The draft layer hides
 * that split behind one handle.
 *
 * The toggle that shares this concern — `backend.bindAddress` (LAN peers)
 * — is deliberately NOT staged: it already gates intent behind its own
 * opt-in confirmation modal, and a Switch that needs a separate Apply
 * reads as broken. Only the silently-committing typed fields are staged.
 *
 * Editors call {@link useConnectionField}, which transparently falls back
 * to the direct binding (auto-apply) when no provider is mounted — so the
 * same editors keep working in the settings-search path, where there's no
 * ApplyBar to commit a draft.
 */

import { updatePrimaryBackend } from '@openheaders/core/backends';
import { createContext, useContext, useMemo, useState } from 'react';
import type React from 'react';
import { usePrimaryBackendUrl } from '../../../shared/backend';
import { useSetting } from '../hooks';

/** Fields whose edits are staged and applied atomically. */
export const CONNECTION_DRAFT_KEYS = ['backend.url', 'backend.bindPort'] as const;
export type ConnectionDraftKey = (typeof CONNECTION_DRAFT_KEYS)[number];

/** Value shape per staged field — `backend.url` is registry-backed now,
 *  so the map is local to the draft layer, not `SettingsMap`. */
export interface ConnectionDraftValues {
  'backend.url': string;
  'backend.bindPort': number;
}

/** A set of connection-field values — used both for the in-flight draft
 *  and for the pre-commit snapshot the ApplyBar reverts to. */
export type ConnectionDraftSnapshot = Partial<ConnectionDraftValues>;
type DraftValues = ConnectionDraftSnapshot;

export interface ConnectionDraftHandle {
  /** Staged value if edited, else the persisted value. */
  effective: <K extends ConnectionDraftKey>(key: K) => ConnectionDraftValues[K];
  /** Stage an edit. Typing back to the persisted value clears the edit. */
  stage: <K extends ConnectionDraftKey>(key: K, value: ConnectionDraftValues[K]) => void;
  /** Discard the staged edit for one key (back to persisted). */
  discard: (key: ConnectionDraftKey) => void;
  isDirty: (key: ConnectionDraftKey) => boolean;
  dirtyKeys: ConnectionDraftKey[];
  /**
   * Commit every staged edit to its backing store. Returns the
   * pre-commit values of the keys that changed so the caller can offer
   * Revert.
   */
  commit: () => DraftValues;
}

const ConnectionDraftContext = createContext<ConnectionDraftHandle | null>(null);

export const ConnectionDraftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const urlPersisted = usePrimaryBackendUrl();
  const [portPersisted, setPort] = useSetting('backend.bindPort');
  const [draft, setDraft] = useState<DraftValues>({});

  const handle = useMemo<ConnectionDraftHandle>(() => {
    const persisted: ConnectionDraftValues = {
      'backend.url': urlPersisted,
      'backend.bindPort': portPersisted,
    };

    function effective<K extends ConnectionDraftKey>(key: K): ConnectionDraftValues[K] {
      const staged = draft[key];
      // Indexed access over the key subset can't be proven equal to
      // ConnectionDraftValues[K] by the checker (the same limitation
      // store.ts and useUntypedSetting cast around); each field's editor
      // guarantees the value shape per key.
      return (staged === undefined ? persisted[key] : staged) as ConnectionDraftValues[K];
    }

    function isDirty(key: ConnectionDraftKey): boolean {
      const staged = draft[key];
      return staged !== undefined && staged !== persisted[key];
    }

    function stage<K extends ConnectionDraftKey>(key: K, value: ConnectionDraftValues[K]): void {
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

    // Explicit per-key so the snapshot and backing writes stay precisely
    // typed (a generic loop over the key union loses the value type).
    function commit(): DraftValues {
      const snapshot: DraftValues = {};
      if (isDirty('backend.url')) {
        snapshot['backend.url'] = persisted['backend.url'];
        void updatePrimaryBackend({ url: effective('backend.url') });
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
  }, [draft, urlPersisted, portPersisted, setPort]);

  return <ConnectionDraftContext.Provider value={handle}>{children}</ConnectionDraftContext.Provider>;
};

/** The active draft handle, or null outside a provider. */
export function useConnectionDraft(): ConnectionDraftHandle | null {
  return useContext(ConnectionDraftContext);
}

export interface ConnectionFieldBinding<K extends ConnectionDraftKey> {
  value: ConnectionDraftValues[K];
  setValue: (value: ConnectionDraftValues[K]) => void;
  /** Edited but not yet applied (staged ≠ persisted). Always false when unstaged. */
  dirty: boolean;
  /** Discard the staged edit. No-op when unstaged. */
  discard: () => void;
}

/**
 * Read/write a connection-identity field through the draft when a
 * provider is mounted, or straight through its backing store
 * (auto-apply) when it isn't. Mirrors `useSetting`'s shape with two
 * extra signals the staged editors use to drive the FieldRow dot +
 * discard affordance.
 */
export function useConnectionField<K extends ConnectionDraftKey>(key: K): ConnectionFieldBinding<K> {
  const draft = useConnectionDraft();
  const urlStored = usePrimaryBackendUrl();
  const [portStored, setPortStored] = useSetting('backend.bindPort');
  if (draft) {
    return {
      value: draft.effective(key),
      setValue: (value) => draft.stage(key, value),
      dirty: draft.isDirty(key),
      discard: () => draft.discard(key),
    };
  }
  const direct: { [P in ConnectionDraftKey]: ConnectionFieldBinding<P> } = {
    'backend.url': {
      value: urlStored,
      setValue: (value) => {
        void updatePrimaryBackend({ url: value });
      },
      dirty: false,
      discard: () => undefined,
    },
    'backend.bindPort': {
      value: portStored,
      setValue: setPortStored,
      dirty: false,
      discard: () => undefined,
    },
  };
  return direct[key];
}
