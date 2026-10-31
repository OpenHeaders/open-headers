/**
 * workspace-prefs-store — the Git tool window's per-workspace
 * preference posture, once: a module store keyed by workspace id with
 * subscribers (the dock unmounts inactive tool windows, so React state
 * would not survive) plus localStorage persistence under
 * `<prefix>:<workspaceId>`. Each store supplies its own `parse`, which
 * turns whatever was persisted into a full, valid value — a schema
 * drift or a hand-edited slot degrades to the defaults field by field,
 * never to a crash. Storage failures (private windows, test DOMs)
 * degrade to session-only silently.
 */

export interface WorkspacePrefsStoreOptions<T extends object> {
  /** localStorage key prefix; the workspace id is appended after a colon. */
  readonly storagePrefix: string;
  readonly defaults: T;
  /** Normalize a persisted partial into a full value (clamps, enum checks). */
  readonly parse: (raw: Partial<T>) => T;
}

export interface WorkspacePrefsStore<T extends object> {
  get(workspaceId: string): T;
  subscribe(workspaceId: string, listener: () => void): () => void;
  patch(workspaceId: string, patch: Partial<T>): void;
}

interface Entry<T> {
  prefs: T;
  listeners: Set<() => void>;
}

export function createWorkspacePrefsStore<T extends object>(
  options: WorkspacePrefsStoreOptions<T>,
): WorkspacePrefsStore<T> {
  const entries = new Map<string, Entry<T>>();
  const storageKey = (workspaceId: string): string => `${options.storagePrefix}:${workspaceId}`;

  const readPersisted = (workspaceId: string): T => {
    try {
      const raw = localStorage.getItem(storageKey(workspaceId));
      if (raw === null) return options.defaults;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return options.defaults;
      return options.parse(parsed as Partial<T>);
    } catch {
      return options.defaults;
    }
  };

  const entryFor = (workspaceId: string): Entry<T> => {
    let entry = entries.get(workspaceId);
    if (entry === undefined) {
      entry = { prefs: readPersisted(workspaceId), listeners: new Set() };
      entries.set(workspaceId, entry);
    }
    return entry;
  };

  return {
    get: (workspaceId) => entryFor(workspaceId).prefs,
    subscribe: (workspaceId, listener) => {
      const entry = entryFor(workspaceId);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
    patch: (workspaceId, patch) => {
      const entry = entryFor(workspaceId);
      entry.prefs = { ...entry.prefs, ...patch };
      try {
        localStorage.setItem(storageKey(workspaceId), JSON.stringify(entry.prefs));
      } catch {
        // Session-only fallback — the in-memory prefs still apply.
      }
      for (const listener of entry.listeners) listener();
    },
  };
}
