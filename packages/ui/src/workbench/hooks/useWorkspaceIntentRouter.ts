/**
 * useWorkspaceIntentRouter — the renderer-side sink for every
 * `WorkspaceIntent` addressed to this workspace tab.
 *
 * Replaces the legacy one-shot `useInitialHashRoute`. Two ingress
 * points, one reducer:
 *
 *   1. **Cold** — on mount, decode `window.location.hash` into an
 *      intent (`hashToIntent`). Fresh workspace tabs opened from a
 *      popup/sidepanel navigator dispatch land here. Preserves the
 *      existing URL formats so bookmarks like `workbench.html#/docs/
 *      doc-system-status` still work byte-identically.
 *   2. **Warm** — subscribe to `workspace-intent` broadcasts delivered
 *      via `chrome.tabs.sendMessage` by the SW navigator when this
 *      tab is reused (focus-or-create). The tab's layout is already
 *      settled so dispatches feel instant.
 *
 * Both paths run through the SAME `dispatch` reducer, which uses an
 * exhaustive `switch` with `assertNever` so adding a new intent kind
 * in `@openheaders/core/workspace-intent` without handling it here
 * becomes a TypeScript error.
 *
 * Two-stage gating (preserved from the legacy router): data-free
 * intents (`open-docs`, `open-settings`, `open-workspace-manager`,
 * `open-workspace-vars`, `open-vault`) dispatch immediately. Data-
 * dependent intents (`edit-rule`, `create-rule`, `edit-environment`,
 * …) queue on `pendingIntentRef` when `isStatusLoaded` is false and
 * flush when it flips true — covers cold workspace boots where the
 * hash-route fires before the SW's data RPCs have responded.
 */

import type { RuleDraft } from '@openheaders/core/types';
import { decodeWorkspaceExportDeepLink } from '@openheaders/core/workspace-export';
import { hashToBoundIntent, type WorkspaceIntent } from '@openheaders/core/workspace-intent';
import { hostBridge } from '@openheaders/core/bridge';
import { useEffect, useRef } from 'react';
import type { RuleFlowScope } from '../types';

/** Provenance attached to the import preview when an intent opens it. */
export type ImportIntentSource = 'link' | 'playground' | 'context-menu';

interface UseWorkspaceIntentRouterOptions {
  isStatusLoaded: boolean;
  openCreateTab: (
    type: string,
    context?: { collectionId: string; folderPath?: string },
    templateKey?: string,
    initialDraft?: RuleDraft,
  ) => void;
  openEditTab: (uid: string) => void;
  openDocs: (sectionId: string) => void;
  openRuleFlow: (scope: RuleFlowScope, entityId?: string, label?: string, tabUrl?: string) => void;
  openRunReport: (
    runId: string,
    owner?: { type: 'rule' | 'folder' | 'collection' | 'workspace'; id: string },
    ownerName?: string,
  ) => void;
  openSettings: (target?: { settingKey?: string; categoryId?: string }) => void;
  openWorkspaceManager: () => void;
  openEnvironmentEdit: (uid: string, name: string, autoRename?: boolean) => void;
  /** `create-environment` — mint a new env via the env API and open
   *  its editor tab. Caller resolves a unique "New Environment (N)"
   *  name on its own; routing surfaces don't carry payload. */
  openCreateEnvironment: () => void;
  openWorkspaceVariables: () => void;
  openVault: () => void;
  openCollectionVariables: (uid: string, name: string) => void;
  openRequestCollectionVariables: (uid: string, name: string) => void;
  openTemplateCollectionVariables: (uid: string, name: string) => void;
  openRequestEditTab: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  openLiveVariableEdit: (uid: string, name: string) => void;
  openLiveWorkflowEdit: (uid: string, name: string) => void;
  openCreateLiveVariable: () => void;
  /**
   * Open the workspace-export import preview modal. The router resolves
   * inline / handoff payload forms into raw YAML before invoking; URL
   * fetch is currently surfaced as an error (lands in PR 4 with the
   * allowlisted SW fetch path). The `error` arm lets the modal render
   * a hard error banner ("the link expired", "couldn't decode payload")
   * without bouncing through a toast.
   */
  openImportPreview: (
    args: { rawText: string; source: ImportIntentSource } | { error: string; source: ImportIntentSource },
  ) => void;
  /** `open-export-modal` — show the export modal scoped to the active
   *  workspace. Dispatched from popup / sidepanel surfaces. */
  openExportModal: () => void;
  /** `open-import-modal` — show the file-pick / drop-zone modal that
   *  precedes the import-preview. Dispatched from popup / sidepanel. */
  openImportModal: () => void;
}

/** `open-workspace`/`-docs`/`-settings`/`-manager`/`-vars`/`-vault`/`-export-modal`/`-import-picker`/`create-environment` */
function isDataFreeIntent(intent: WorkspaceIntent): boolean {
  switch (intent.kind) {
    case 'open-workspace':
    case 'open-docs':
    case 'open-settings':
    case 'open-workspace-manager':
    case 'open-workspace-vars':
    case 'open-vault':
    case 'open-export-modal':
    case 'open-import-modal':
    case 'create-environment':
      return true;
    default:
      return false;
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled WorkspaceIntent kind: ${JSON.stringify(x)}`);
}

/**
 * Resolve an `open-import` intent to raw YAML by following whichever
 * payload form is set. The intent schema guarantees exactly one of the
 * three is present — the `else` is unreachable in well-typed callers
 * but kept defensive for hand-constructed intents.
 */
async function resolveImportIntent(
  intent: Extract<WorkspaceIntent, { kind: 'open-import' }>,
): Promise<{ rawText: string } | { error: string }> {
  if (intent.payload !== undefined) {
    try {
      const yaml = await decodeWorkspaceExportDeepLink(intent.payload);
      return { rawText: yaml };
    } catch (err) {
      return { error: `Could not decode the inline import link: ${(err as Error).message}` };
    }
  }
  if (intent.handoffId !== undefined) {
    try {
      const { yaml } = await hostBridge.call('consumeImportHandoff', { handoffId: intent.handoffId });
      if (yaml === null) {
        return {
          error:
            'This import link has expired or was already used. Ask the sender to share a fresh link, or import the file directly.',
        };
      }
      return { rawText: yaml };
    } catch (err) {
      return { error: `Could not retrieve the import payload: ${(err as Error).message}` };
    }
  }
  if (intent.fetchUrl !== undefined) {
    try {
      const res = await hostBridge.call('fetchWorkspaceExportYaml', { url: intent.fetchUrl });
      if (res.ok) return { rawText: res.yaml };
      // Map specific reasons to user-facing copy. The reasons are
      // already discrete so the modal can render them verbatim.
      const prefix = (() => {
        switch (res.reason) {
          case 'host-not-allowlisted':
          case 'redirect-host-not-allowlisted':
            return 'Refused — host not on the allowlist.';
          case 'not-https':
            return 'Refused — only https:// imports are allowed.';
          case 'body-too-large':
            return 'Refused — response body exceeds the 1 MB cap.';
          case 'too-many-redirects':
            return 'Refused — too many redirects.';
          case 'invalid-url':
            return 'Could not parse the URL.';
          case 'http-error':
            return 'Server returned an error response.';
          case 'network-error':
            return 'Network error fetching the URL.';
          default:
            return 'Could not fetch the URL.';
        }
      })();
      return { error: `${prefix} ${res.message}` };
    } catch (err) {
      return { error: `Could not fetch import URL: ${(err as Error).message}` };
    }
  }
  return { error: 'Import link is malformed (no payload).' };
}

function dispatchImportIntent(
  intent: Extract<WorkspaceIntent, { kind: 'open-import' }>,
  openImportPreview: UseWorkspaceIntentRouterOptions['openImportPreview'],
): void {
  const via: ImportIntentSource = intent.source?.via ?? 'link';
  void resolveImportIntent(intent).then((result) => {
    if ('error' in result) openImportPreview({ error: result.error, source: via });
    else openImportPreview({ rawText: result.rawText, source: via });
  });
}

export function useWorkspaceIntentRouter(options: UseWorkspaceIntentRouterOptions): void {
  // Hold callbacks behind refs so the reducer identity is stable — the
  // warm-path `chrome.runtime.onMessage` subscription would otherwise
  // rip down + re-attach on every render, and the cold-path mount
  // effect could re-fire its gate after a parent re-render. Refs read
  // `.current` at dispatch time so every fresh callback is visible
  // without invalidating the effect.
  const openersRef = useRef(options);
  openersRef.current = options;

  const isStatusLoadedRef = useRef(options.isStatusLoaded);
  isStatusLoadedRef.current = options.isStatusLoaded;

  // Cold-path gate: parse the hash exactly once on mount.
  const coldProcessedRef = useRef(false);

  // Single-slot queue for data-dependent intents that arrive before
  // `isStatusLoaded` flips true. Last-wins; rapid intents would only
  // ever be "navigate somewhere different" — the final one matters.
  const pendingIntentRef = useRef<WorkspaceIntent | null>(null);

  // ── Dispatcher (the only switch — add new kinds here) ────────────
  useEffect(() => {
    const dispatch = (intent: WorkspaceIntent): void => {
      const o = openersRef.current;
      switch (intent.kind) {
        case 'open-workspace':
          // No-op — the workspace is already open. The intent exists so
          // surfaces have an "open workspace" primitive without needing
          // to know whether a tab exists; the navigator handles the
          // focus-or-create. Renderer has nothing to do.
          return;
        case 'open-docs':
          o.openDocs(intent.section);
          return;
        case 'open-settings': {
          const target = intent.target;
          if (!target) o.openSettings();
          else if ('categoryId' in target) o.openSettings({ categoryId: target.categoryId });
          else o.openSettings({ settingKey: target.settingKey });
          return;
        }
        case 'open-workspace-manager':
          o.openWorkspaceManager();
          return;
        case 'open-workspace-vars':
          o.openWorkspaceVariables();
          return;
        case 'open-vault':
          o.openVault();
          return;
        case 'edit-rule':
          o.openEditTab(intent.uid);
          return;
        case 'create-rule': {
          // Preserve the legacy draft-handoff flow: a `draft-<nonce>`
          // intent was handed from the devpanel via `createRuleDraft`;
          // we retrieve the stashed payload and pre-fill the editor.
          // Absent/expired drafts still open a bare create tab of the
          // requested type — better than a blank screen with no clue.
          if (intent.draftNonce) {
            hostBridge.call('takeRuleDraft', { nonce: intent.draftNonce })
              .then((res) => {
                const draft = (res?.draft ?? null) as RuleDraft | null;
                o.openCreateTab(intent.ruleType, intent.context, undefined, draft ?? undefined);
              })
              .catch(() => o.openCreateTab(intent.ruleType, intent.context));
          } else {
            o.openCreateTab(intent.ruleType, intent.context, intent.templateKey);
          }
          return;
        }
        case 'edit-environment':
          // Label is a placeholder — `useTabSyncEffects` overwrites it
          // once `useEnvironments` resolves the env, so the tab title
          // flips to the real name as soon as the env-store hydrates.
          o.openEnvironmentEdit(intent.uid, 'Environment');
          return;
        case 'create-environment':
          o.openCreateEnvironment();
          return;
        case 'open-collection-vars':
          o.openCollectionVariables(intent.uid, 'Collection');
          return;
        case 'open-request-collection-vars':
          o.openRequestCollectionVariables(intent.uid, 'Collection');
          return;
        case 'open-template-collection-vars':
          o.openTemplateCollectionVariables(intent.uid, 'Collection');
          return;
        case 'open-request-editor':
          // Same placeholder rationale as `edit-environment`; the
          // request-store broadcast corrects the label + method.
          o.openRequestEditTab(intent.uid, 'Request', 'GET');
          return;
        case 'open-rule-flow':
          o.openRuleFlow(intent.scope, intent.entityId, undefined, intent.url);
          return;
        case 'open-run-report':
          // Recover the owner stamp from the persisted run so the bottom
          // panel's contextual Test Runs tab can resolve its bucket.
          hostBridge.call('getTestRun', { runId: intent.runId })
            .then((data) => {
              const run = data?.run ?? null;
              const owner = run ? { type: run.ownerType, id: run.ownerId } : undefined;
              o.openRunReport(intent.runId, owner, run?.ownerNameAtRun);
            })
            .catch(() => o.openRunReport(intent.runId));
          return;
        case 'edit-live-variable':
          // Placeholder label; once the LV store broadcast resolves the
          // actual `name`, `useTabSyncEffects` rewrites the label (same
          // pattern as `edit-environment`).
          o.openLiveVariableEdit(intent.uid, 'Source');
          return;
        case 'edit-live-workflow':
          o.openLiveWorkflowEdit(intent.uid, 'Workflow');
          return;
        case 'create-live-variable':
          // intent.seedRequestUid is reserved in the schema but ignored
          // here — the Create LV form is bind-to-existing only, and the
          // "use this request as a workflow step" flow now lives on the
          // Request editor's "Use response in workflow" dropdown.
          o.openCreateLiveVariable();
          return;
        case 'open-import':
          dispatchImportIntent(intent, o.openImportPreview);
          return;
        case 'open-export-modal':
          o.openExportModal();
          return;
        case 'open-import-modal':
          o.openImportModal();
          return;
        default:
          assertNever(intent);
      }
    };

    const applyIntent = (intent: WorkspaceIntent): void => {
      if (isDataFreeIntent(intent) || isStatusLoadedRef.current) {
        dispatch(intent);
        return;
      }
      // Defer until `isStatusLoaded` flips true. The flush effect
      // below picks it up.
      pendingIntentRef.current = intent;
    };

    // Cold-path parse on mount. Use `hashToBoundIntent` so the optional
    // `/ws/<wsId>/` workspace-binding prefix is stripped before the
    // inner intent is dispatched — the binding itself is consumed by
    // the resolver + mirror, not by the intent router.
    if (!coldProcessedRef.current) {
      coldProcessedRef.current = true;
      const bound = hashToBoundIntent(window.location.hash);
      if (bound) applyIntent(bound.intent);
    }

    // Warm-path subscription for the lifetime of this workspace tab.
    const unsubscribe = hostBridge.subscribe('workspace-intent', (payload) => applyIntent(payload.intent));
    return unsubscribe;

    // Intentionally no deps — the effect sets up once and stays live
    // via refs. Re-subscribing on every render would miss messages
    // arriving during the torn-down window.
  }, []);

  // Flush pending when data arrives — one-shot drain; subsequent intents
  // come in via live applyIntent dispatch above.
  useEffect(() => {
    if (!options.isStatusLoaded) return;
    const pending = pendingIntentRef.current;
    if (!pending) return;
    pendingIntentRef.current = null;
    // Inline dispatch to avoid a stale closure on the outer effect.
    const o = openersRef.current;
    switch (pending.kind) {
      case 'open-workspace':
      case 'open-docs':
      case 'open-settings':
      case 'open-workspace-manager':
      case 'open-workspace-vars':
      case 'open-vault':
        // Data-free intents shouldn't end up in the pending slot, but
        // be defensive: drop silently — the cold path already ran them.
        return;
      case 'edit-rule':
        o.openEditTab(pending.uid);
        return;
      case 'create-rule':
        if (pending.draftNonce) {
          hostBridge.call('takeRuleDraft', { nonce: pending.draftNonce })
            .then((res) => {
              const draft = (res?.draft ?? null) as RuleDraft | null;
              o.openCreateTab(pending.ruleType, pending.context, undefined, draft ?? undefined);
            })
            .catch(() => o.openCreateTab(pending.ruleType, pending.context));
        } else {
          o.openCreateTab(pending.ruleType, pending.context, pending.templateKey);
        }
        return;
      case 'edit-environment':
        o.openEnvironmentEdit(pending.uid, 'Environment');
        return;
      case 'create-environment':
        o.openCreateEnvironment();
        return;
      case 'open-collection-vars':
        o.openCollectionVariables(pending.uid, 'Collection');
        return;
      case 'open-request-collection-vars':
        o.openRequestCollectionVariables(pending.uid, 'Collection');
        return;
      case 'open-template-collection-vars':
        o.openTemplateCollectionVariables(pending.uid, 'Collection');
        return;
      case 'open-request-editor':
        o.openRequestEditTab(pending.uid, 'Request', 'GET');
        return;
      case 'open-rule-flow':
        o.openRuleFlow(pending.scope, pending.entityId, undefined, pending.url);
        return;
      case 'open-run-report':
        hostBridge.call('getTestRun', { runId: pending.runId })
          .then((data) => {
            const run = data?.run ?? null;
            const owner = run ? { type: run.ownerType, id: run.ownerId } : undefined;
            o.openRunReport(pending.runId, owner, run?.ownerNameAtRun);
          })
          .catch(() => o.openRunReport(pending.runId));
        return;
      case 'edit-live-variable':
        o.openLiveVariableEdit(pending.uid, 'Source');
        return;
      case 'edit-live-workflow':
        o.openLiveWorkflowEdit(pending.uid, 'Workflow');
        return;
      case 'create-live-variable':
        o.openCreateLiveVariable();
        return;
      case 'open-import':
        dispatchImportIntent(pending, o.openImportPreview);
        return;
      case 'open-export-modal':
        o.openExportModal();
        return;
      case 'open-import-modal':
        o.openImportModal();
        return;
      default:
        assertNever(pending);
    }
  }, [options.isStatusLoaded]);
}
