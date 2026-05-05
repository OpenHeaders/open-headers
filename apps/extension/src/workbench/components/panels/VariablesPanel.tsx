/**
 * VariablesPanel — right-pane live view of variable scopes (surfaced
 * to users as "Scope").
 *
 * Two modes, gated by the active tab's kind:
 *   - "In Rule" / "In Request" — only variables referenced in the
 *     focused entity, resolved against every scope with the tab's
 *     collection context so the user sees the exact value that will
 *     hit DNR / the executor. The filter button label changes with
 *     the tab kind so it always names what it filters to.
 *   - "All"                    — every scope's variables grouped by
 *     priority. This is the default and the only option on tabs that
 *     don't reference variables (landing, settings, env editor, etc.).
 *
 * When no variable-referencing tab is active, the filter toggle is
 * hidden and the panel renders the "All" view — there's no second
 * option to offer, so we don't pretend there is.
 *
 * Data source: `useEnvironments` for vault / environment / workspace
 * vars, `useRules` for collection variables, `useRequests` for the
 * focused request. Resolution runs in the renderer — the SW already
 * ships a snapshot of every scope via `environmentsChanged`, so a
 * second resolver instance here stays in sync without extra RPCs.
 */

import {
  ExclamationCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useEnvVarVault } from '@hooks/useEnvVarVault';
import { useAllLiveCaches } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRequests } from '@hooks/useRequests';
import { useRules } from '@hooks/useRules';
import { isLiveVariableEffective } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import { VariableResolver } from '@openheaders/core/variables';
import { Empty, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@/shared/dock-layout';
import {
  type CollectionFamilies,
  feedCollectionVariablesToResolver,
  findCollectionByPath,
  findCollectionByUid,
} from '@/shared/variables/collection-scope';
import {
  buildScopeEditorDispatch,
  buildVariableEditorDispatch,
  type DispatchVariable,
} from './scope-editor-dispatch';
import type { TabMode, WorkbenchTab } from '../../types';
import { collectTemplateStrings } from '../../variable-references';
import { SCOPE_COLORS, scopeBadge } from '../shared/scope-colors';
import TotpPreview from '../totp/TotpPreview';

// ── Scope kind (context classification of the focused tab) ─────────

/** What the focused tab references, if anything the Scope panel can filter to. */
type ScopeKind = 'rule' | 'request' | 'template' | 'none';

const RULE_TAB_MODES: ReadonlySet<TabMode> = new Set(['edit']);
const REQUEST_TAB_MODES: ReadonlySet<TabMode> = new Set(['request-edit', 'request-create']);
const TEMPLATE_TAB_MODES: ReadonlySet<TabMode> = new Set(['template-edit']);

function getScopeKind(tab: WorkbenchTab | null): ScopeKind {
  if (!tab) return 'none';
  if (RULE_TAB_MODES.has(tab.mode)) return 'rule';
  if (REQUEST_TAB_MODES.has(tab.mode)) return 'request';
  if (TEMPLATE_TAB_MODES.has(tab.mode)) return 'template';
  return 'none';
}

/** Human-facing label for the "filter to this entity" button. */
function getContextLabel(kind: ScopeKind): string | null {
  if (kind === 'rule') return 'In Rule';
  if (kind === 'request') return 'In Request';
  if (kind === 'template') return 'In Template';
  return null;
}

const { Text } = Typography;

interface VariablesPanelProps {
  onClose: () => void;
  /** Active tab so the panel can compute "in request" variables. */
  activeTab: WorkbenchTab | null;
  /** Per-scope variables-editor openers. When present, each scope's
   *  rows + section title surface a clickable "open editor" affordance
   *  that routes to the right per-family / per-entity editor — the
   *  Inspector ties its READ surface to the WRITE surface. */
  onOpenVault?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenLiveVariables?: () => void;
  /** Open a specific live-variable's edit tab. When wired, an
   *  In-Context row whose value came from a known LV uid routes here
   *  instead of the LV list page — the user lands on the edit tab for
   *  THIS variable. */
  onOpenLiveVariableEdit?: (uid: string, name: string) => void;
  onOpenEnvironmentEdit?: (uid: string, name: string) => void;
  onOpenRuleCollectionVariables?: (uid: string, name: string) => void;
  onOpenRequestCollectionVariables?: (uid: string, name: string) => void;
  onOpenTemplateCollectionVariables?: (uid: string, name: string) => void;
}

// ── Scope config ────────────────────────────────────────────────────

const SCOPE_CONFIG = {
  vault: { label: 'Vault', priority: 'highest', color: SCOPE_COLORS.vault.color },
  environment: { label: 'Environment', priority: 'high', color: SCOPE_COLORS.environment.color },
  collection: { label: 'Collection', priority: 'medium', color: SCOPE_COLORS.collection.color },
  workspace: { label: 'Workspace', priority: 'lowest', color: SCOPE_COLORS.workspace.color },
  live: { label: 'Live', priority: 'resolved', color: SCOPE_COLORS.live.color },
} as const;

type DisplayScope = keyof typeof SCOPE_CONFIG;

interface DisplayVariable {
  name: string;
  value: string;
  scope: DisplayScope;
  isSensitive: boolean;
  resolved: boolean;
  /** Present only on TOTP-kind vault rows — the renderer uses these
   *  to mount a live `TotpPreview` instead of the masked-string cell.
   *  Codes refresh on a 1Hz tick from the seed; never persisted. */
  totp?: {
    seed: string;
    algorithm: V5.TotpAlgorithm;
    digits: number;
    period: number;
  };
  /** Present only on `live` rows — the LV uid the value came from. The
   *  per-row dispatcher uses it to open the LV's edit tab directly
   *  instead of falling back to the LiveVariables list page. */
  liveVariableUid?: string;
}

// `TEMPLATE_RX` + `collectTemplateStrings` live in `../../variable-references`
// so the rule-editor resolution banner can share the same walker.

// ── Panel ──────────────────────────────────────────────────────────

const VariablesPanel: React.FC<VariablesPanelProps> = ({
  onClose,
  activeTab,
  onOpenVault,
  onOpenWorkspaceVariables,
  onOpenLiveVariables,
  onOpenLiveVariableEdit,
  onOpenEnvironmentEdit,
  onOpenRuleCollectionVariables,
  onOpenRequestCollectionVariables,
  onOpenTemplateCollectionVariables,
}) => {
  const { token } = theme.useToken();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  // Initialize mode to match the currently-focused tab: if it
  // references variables (rule / request), start contextual so the
  // first thing the user sees is their rule/request's own variables;
  // otherwise fall back to the broader "All" view. The user can
  // switch to "All" at any time — see the tab-change effect below.
  const [mode, setMode] = useState<'in-context' | 'all'>(() =>
    getScopeKind(activeTab) === 'none' ? 'all' : 'in-context',
  );

  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvVarVault();
  const { rules, templates, localCollections, localCollectionTrees, templateCollections, templateCollectionTrees } =
    useRules();
  const { requests, collections: requestCollections, collectionTrees: requestCollectionTrees } = useRequests();
  const families = useMemo<CollectionFamilies>(
    () => ({ ruleCollections: localCollections, requestCollections, templateCollections }),
    [localCollections, requestCollections, templateCollections],
  );
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const scopeKind = useMemo(() => getScopeKind(activeTab), [activeTab]);
  const contextLabel = getContextLabel(scopeKind);

  // Identify the active rule / request / template / collection for the
  // current tab. Editor tabs (rule / request / template) carry a
  // concrete entity whose templates the panel can walk; the various
  // *-collection-vars + collection-overview + folder-overview surfaces
  // only carry a collection uid so the All view highlights the right
  // collection's vars; other modes contribute neither.
  //
  // The collection lookup walks every family — rule, request, template
  // — so the resolver's collection scope works regardless of which
  // family the focused entity belongs to. Pre-session-49 only walked
  // `localCollections` (rule-collections), which silently returned
  // null for a request's `requests/...` path or a template's
  // `templates/...` path.
  const { activeRule, activeRequest, activeTemplate, activeCollectionId } = useMemo<{
    activeRule: V5.Rule | null;
    activeRequest: V5.Request | null;
    activeTemplate: V5.Template | null;
    activeCollectionId: string | null;
  }>(() => {
    if (!activeTab)
      return { activeRule: null, activeRequest: null, activeTemplate: null, activeCollectionId: null };
    let rule: V5.Rule | null = null;
    let request: V5.Request | null = null;
    let template: V5.Template | null = null;
    if (scopeKind === 'rule' && activeTab.ruleUid) {
      rule = rules.find((r) => r.uid === activeTab.ruleUid) ?? null;
    } else if (scopeKind === 'request' && activeTab.requestUid) {
      request = requests.find((r) => r.uid === activeTab.requestUid) ?? null;
    } else if (scopeKind === 'template' && activeTab.templateUid) {
      template = templates.find((t) => t.uid === activeTab.templateUid) ?? null;
    }

    const entityForCollection: V5.Rule | V5.Request | V5.Template | null = rule ?? request ?? template;
    let collId: string | null = null;
    if (
      (activeTab.mode === 'collection-overview' || activeTab.mode === 'folder-overview') &&
      activeTab.entityId
    ) {
      // Both overview surfaces stash the entity uid in `entityId`. For
      // collection-overview the uid IS a collection uid; for folder-
      // overview it's a folder uid that we resolve through the trees.
      if (activeTab.mode === 'collection-overview') {
        collId = activeTab.entityId;
      } else {
        const folderUid = activeTab.entityId;
        const treeFamilies: ReadonlyArray<readonly V5.CollectionTree[]> = [
          localCollectionTrees,
          requestCollectionTrees,
          templateCollectionTrees,
        ];
        outer: for (const trees of treeFamilies) {
          for (const col of trees) {
            const stack: V5.TreeNode[] = [...col.tree];
            while (stack.length > 0) {
              const node = stack.shift();
              if (!node) break;
              if (node.type === 'folder' && node.uid === folderUid) {
                collId = col.uid;
                break outer;
              }
              if (node.type === 'folder') stack.push(...node.children);
            }
          }
        }
      }
    } else if (
      (activeTab.mode === 'collection-vars' ||
        activeTab.mode === 'request-collection-vars' ||
        activeTab.mode === 'template-collection-vars') &&
      activeTab.collectionUid
    ) {
      collId = activeTab.collectionUid;
    } else if (entityForCollection) {
      collId = findCollectionByPath(entityForCollection.path, families)?.uid ?? null;
    }
    return { activeRule: rule, activeRequest: request, activeTemplate: template, activeCollectionId: collId };
  }, [
    scopeKind,
    activeTab,
    rules,
    requests,
    templates,
    families,
    localCollectionTrees,
    requestCollectionTrees,
    templateCollectionTrees,
  ]);

  // Auto-apply the "natural" mode whenever the focused tab changes:
  // a rule/request tab starts in "In Rule" / "In Request" (because
  // that's what the user is working on and almost always wants to see
  // first); anything else starts in "All". The user's manual toggle
  // choice is per-tab — switching to a different tab resets to the
  // new tab's default. This matches how users read the panel ("what
  // does this tab reference?") while still honoring the toggle.
  const lastTabIdRef = useRef<string | null>(activeTab?.id ?? null);
  useEffect(() => {
    const tabId = activeTab?.id ?? null;
    if (lastTabIdRef.current !== tabId) {
      lastTabIdRef.current = tabId;
      setMode(scopeKind === 'none' ? 'all' : 'in-context');
      return;
    }
    // Same tab id but its scope kind dropped to 'none' (a rare mode
    // transition on the same tab): force 'all' so the panel can't
    // get stuck showing a context view whose toggle is now hidden.
    if (scopeKind === 'none' && mode === 'in-context') setMode('all');
  }, [activeTab, scopeKind, mode]);

  const contextEntity: V5.Rule | V5.Request | V5.Template | null = activeRule ?? activeRequest ?? activeTemplate;
  const contextEntityName = activeRule?.name ?? activeRequest?.name ?? activeTemplate?.name ?? null;

  // LiveRegistry mirrors the SW's `buildLiveRegistry`: enabled LVs
  // only; filter cache rows to the active env; honor manual overrides.
  const liveRegistry = useMemo(() => {
    const nowMs = Date.now();
    const registry = new Map<
      string,
      { value: string; expiresAt: number | null; stale: boolean; workflowUid: string }
    >();
    for (const lv of liveVariables) {
      if (!isLiveVariableEffective(lv)) continue;
      if (lv.manualOverride) {
        const activeOverride = lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs;
        if (activeOverride) {
          registry.set(lv.name, {
            value: lv.manualOverride.value,
            expiresAt: lv.manualOverride.until ?? null,
            stale: false,
            workflowUid: lv.workflowUid,
          });
          continue;
        }
      }
      const runs = liveCaches[lv.workflowUid] ?? [];
      const run =
        runs.find((r) => r.environmentId === activeEnvironmentId) ?? runs.find((r) => r.environmentId === null) ?? null;
      if (!run) continue;
      const value = run.stepCaptures[lv.stepId]?.[lv.captureName];
      if (typeof value !== 'string') continue;
      registry.set(lv.name, {
        value,
        expiresAt: run.expiresAt,
        stale: run.expiresAt !== null && run.expiresAt < nowMs,
        workflowUid: lv.workflowUid,
      });
    }
    return registry;
  }, [liveVariables, liveCaches, activeEnvironmentId]);

  // Build a resolver that mirrors the SW's. Rebuilt every render —
  // cheap (array wiring only) and free of subtle sync bugs.
  const resolver = useMemo(() => {
    const r = new VariableResolver();
    r.setVault(vault);
    r.setEnvironments(environments);
    r.setActiveEnvironmentId(activeEnvironmentId);
    r.setDefaultEnvironmentId(defaultEnvironmentId);
    r.setWorkspaceVariables(workspaceVariables);
    feedCollectionVariablesToResolver(r, families);
    r.setLiveRegistry(liveRegistry);
    return r;
  }, [
    vault,
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    families,
    liveRegistry,
  ]);

  const activeEnvironment = activeEnvironmentId
    ? (environments.find((e) => e.uid === activeEnvironmentId)?.name ?? null)
    : null;
  const defaultEnvironment = defaultEnvironmentId
    ? (environments.find((e) => e.uid === defaultEnvironmentId)?.name ?? null)
    : null;
  const activeCollectionName = activeCollectionId
    ? (findCollectionByUid(activeCollectionId, families)?.name ?? null)
    : null;

  // Inspector → editor dispatchers. Section-level uses scope only;
  // row-level prefers per-entity openers when the row carries a uid
  // (today: live rows). Both delegate to the same null-vs-callback
  // contract so the consumer hides the affordance when null.
  const openScopeEditor = useMemo(
    () =>
      buildScopeEditorDispatch(
        {
          onOpenVault,
          onOpenWorkspaceVariables,
          onOpenLiveVariables,
          onOpenEnvironmentEdit,
          onOpenRuleCollectionVariables,
          onOpenRequestCollectionVariables,
          onOpenTemplateCollectionVariables,
        },
        { activeCollectionId, families, activeEnvironmentId, defaultEnvironmentId, environments },
      ),
    [
      onOpenVault,
      onOpenWorkspaceVariables,
      onOpenLiveVariables,
      onOpenEnvironmentEdit,
      onOpenRuleCollectionVariables,
      onOpenRequestCollectionVariables,
      onOpenTemplateCollectionVariables,
      activeEnvironmentId,
      defaultEnvironmentId,
      environments,
      activeCollectionId,
      families,
    ],
  );
  const openVariableEditor = useMemo(
    () =>
      buildVariableEditorDispatch(
        {
          onOpenVault,
          onOpenWorkspaceVariables,
          onOpenLiveVariables,
          onOpenLiveVariableEdit,
          onOpenEnvironmentEdit,
          onOpenRuleCollectionVariables,
          onOpenRequestCollectionVariables,
          onOpenTemplateCollectionVariables,
        },
        {
          activeCollectionId,
          families,
          activeEnvironmentId,
          defaultEnvironmentId,
          environments,
          liveVariables,
        },
      ),
    [
      onOpenVault,
      onOpenWorkspaceVariables,
      onOpenLiveVariables,
      onOpenLiveVariableEdit,
      onOpenEnvironmentEdit,
      onOpenRuleCollectionVariables,
      onOpenRequestCollectionVariables,
      onOpenTemplateCollectionVariables,
      activeEnvironmentId,
      defaultEnvironmentId,
      environments,
      activeCollectionId,
      families,
      liveVariables,
    ],
  );

  // ── "In Rule" / "In Request" — variables referenced by the focused
  //    entity. Walks every template-containing string, resolves each
  //    through the full resolveTemplate machinery (so namespaces,
  //    default-env fallback, reserved-namespace detection all apply),
  //    then dedupes variables by display name and errors by reference.
  //    The walker is entity-agnostic: rules and requests are both
  //    plain objects whose templated fields `collectTemplateStrings`
  //    can harvest.
  const { inContextVars, inContextErrors } = useMemo<{
    inContextVars: DisplayVariable[];
    inContextErrors: ResolutionError[];
  }>(() => {
    if (!contextEntity) return { inContextVars: [], inContextErrors: [] };
    const templateStrings: string[] = [];
    collectTemplateStrings(contextEntity, templateStrings);

    const ctx = activeCollectionId ? { collectionId: activeCollectionId } : undefined;
    const seenVars = new Map<string, DisplayVariable>();
    const seenErrors = new Map<string, ResolutionError>();

    for (const str of templateStrings) {
      const { variables, errors } = resolver.resolveTemplate(str, ctx);
      for (const v of variables) {
        if (seenVars.has(v.name)) continue;
        if (v.resolved) {
          const scope = (v.scope ?? 'workspace') as DisplayScope;
          seenVars.set(v.name, {
            name: v.name,
            value: v.value ?? '',
            scope,
            isSensitive: v.isSensitive ?? false,
            resolved: true,
            ...(scope === 'live'
              ? { liveVariableUid: liveVariables.find((lv) => lv.name === v.name)?.uid }
              : {}),
          });
        } else {
          seenVars.set(v.name, {
            name: v.name,
            value: '',
            scope: 'workspace' as DisplayScope,
            isSensitive: false,
            resolved: false,
          });
        }
      }
      for (const e of errors) {
        if (!seenErrors.has(e.reference)) {
          seenErrors.set(e.reference, e);
        }
      }
    }

    return {
      inContextVars: [...seenVars.values()],
      inContextErrors: [...seenErrors.values()],
    };
  }, [contextEntity, activeCollectionId, resolver, liveVariables]);

  // ── "All" — every scope's variables, whatever their referenced state
  const allVars = useMemo(() => {
    const vaultList: DisplayVariable[] = vault.secrets.map((s) => {
      // TOTP entries surface a live `TotpPreview` (rendered by
      // VariableRow when `totp` is present); the literal `value` field
      // is empty because the code is dynamic. "resolved" stays true so
      // the row doesn't render as unresolved — cooldown is enforced
      // one layer down at the executor, not visualized here.
      if (s.kind === 'totp') {
        return {
          name: s.name,
          value: '',
          scope: 'vault',
          isSensitive: true,
          resolved: true,
          totp: { seed: s.seed, algorithm: s.algorithm, digits: s.digits, period: s.period },
        };
      }
      return {
        name: s.name,
        value: s.value,
        scope: 'vault',
        isSensitive: true,
        resolved: s.value !== '',
      };
    });
    const envList: V5.Variable[] = activeEnvironmentId
      ? (environments.find((e) => e.uid === activeEnvironmentId)?.variables ?? [])
      : [];
    const envDisplay: DisplayVariable[] = envList.map((v) => ({
      name: v.name,
      value: v.value,
      scope: 'environment',
      isSensitive: v.type === 'secret',
      resolved: v.value !== '',
    }));
    const collList: DisplayVariable[] = activeCollectionId
      ? (findCollectionByUid(activeCollectionId, families)?.variables ?? []).map((v) => ({
          name: v.name,
          value: v.value,
          scope: 'collection' as const,
          isSensitive: v.type === 'secret',
          resolved: v.value !== '',
        }))
      : [];
    const wsList: DisplayVariable[] = workspaceVariables.variables.map((v) => ({
      name: v.name,
      value: v.value,
      scope: 'workspace',
      isSensitive: v.type === 'secret',
      resolved: v.value !== '',
    }));
    const liveList: DisplayVariable[] = liveVariables
      .filter((lv) => isLiveVariableEffective(lv))
      .map((lv) => {
        const entry = liveRegistry.get(lv.name);
        return {
          name: lv.name,
          value: entry?.value ?? '',
          scope: 'live' as const,
          // Values can contain secrets (tokens) — mask by default.
          isSensitive: true,
          resolved: entry !== undefined,
          liveVariableUid: lv.uid,
        };
      });
    return {
      vault: vaultList,
      environment: envDisplay,
      collection: collList,
      workspace: wsList,
      live: liveList,
    };
  }, [
    vault,
    environments,
    activeEnvironmentId,
    workspaceVariables,
    families,
    activeCollectionId,
    liveVariables,
    liveRegistry,
  ]);

  return (
    <div
      className="rules-right-panel rules-right-panel--variables"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <PanelHeader wiring={headerWiring} title={<strong>Scope</strong>} />

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
        {/* Mode summary + toggle — toggle only appears when the focused
            tab has a context to filter to. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {mode === 'in-context' && contextEntityName && scopeKind !== 'none' ? (
              <>
                {scopeKind === 'rule' ? 'In rule: ' : scopeKind === 'request' ? 'In request: ' : 'In template: '}
                <Text strong style={{ fontSize: 11 }}>
                  {contextEntityName}
                </Text>
              </>
            ) : (
              'All scopes'
            )}
          </Text>
          {contextLabel && (
            <div style={{ display: 'flex', fontSize: 10 }}>
              <span
                role="button"
                tabIndex={0}
                onClick={() => setMode('in-context')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setMode('in-context');
                }}
                style={{
                  padding: '2px 6px',
                  cursor: 'pointer',
                  borderRadius: '3px 0 0 3px',
                  ...(mode === 'in-context'
                    ? { background: token.colorPrimary, color: token.colorBgContainer }
                    : {
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRight: 0,
                        color: token.colorTextSecondary,
                      }),
                }}
              >
                {contextLabel}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => setMode('all')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setMode('all');
                }}
                style={{
                  padding: '2px 6px',
                  cursor: 'pointer',
                  borderRadius: '0 3px 3px 0',
                  ...(mode === 'all'
                    ? { background: token.colorPrimary, color: token.colorBgContainer }
                    : { border: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextSecondary }),
                }}
              >
                All
              </span>
            </div>
          )}
        </div>

        {mode === 'in-context' && scopeKind !== 'none' ? (
          <InContextView
            vars={inContextVars}
            errors={inContextErrors}
            scopeKind={scopeKind}
            hasContext={contextEntity !== null}
            openVariableEditor={openVariableEditor}
          />
        ) : (
          <AllScopesView
            allVars={allVars}
            activeEnvironmentName={activeEnvironment}
            defaultEnvironmentName={defaultEnvironment}
            activeCollectionName={activeCollectionName}
            openScopeEditor={openScopeEditor}
          />
        )}
      </div>
    </div>
  );
};

// ── In-context view ───────────────────────────────────────────────

function InContextView({
  vars,
  errors,
  scopeKind,
  hasContext,
  openVariableEditor,
}: {
  vars: DisplayVariable[];
  errors: ResolutionError[];
  scopeKind: ScopeKind;
  hasContext: boolean;
  openVariableEditor: (variable: DispatchVariable, name: string) => (() => void) | null;
}) {
  const { token } = theme.useToken();
  const noun = scopeKind === 'request' ? 'request' : scopeKind === 'template' ? 'template' : 'rule';
  if (!hasContext) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ fontSize: 11 }}>
            Open a {noun} to see the variables it references.
          </Text>
        }
      />
    );
  }
  if (vars.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No variables referenced in this {noun}.
      </Text>
    );
  }
  const resolvedCount = vars.filter((v) => v.resolved).length;
  return (
    <>
      {vars.map((v) => (
        <VariableRow key={v.name} variable={v} onOpenEditor={openVariableEditor(v, v.name)} />
      ))}
      <div style={{ marginTop: 10, fontSize: 11 }}>
        {resolvedCount === vars.length ? (
          <Text style={{ color: token.colorSuccess, fontSize: 11 }}>
            ✓ All {vars.length} variable{vars.length !== 1 ? 's' : ''} resolved
          </Text>
        ) : (
          <Text style={{ color: token.colorError, fontSize: 11 }}>⚠ {vars.length - resolvedCount} unresolved</Text>
        )}
      </div>

      {errors.length > 0 ? <ResolutionErrorList errors={errors} /> : null}
    </>
  );
}

// ── Resolution-error list ─────────────────────────────────────────

/**
 * Structured-error list shown below the variable rows. Each entry
 * renders `{{reference}}` + a tag for the failure reason + the
 * resolver's concrete fix hint. The resolver owns hint generation
 * (see `@openheaders/core/variables/resolver.ts`) — the UI is a
 * rendering layer only.
 */
function ResolutionErrorList({ errors }: { errors: ResolutionError[] }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 10,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 6, color: token.colorError }}>
        <ExclamationCircleOutlined style={{ marginRight: 4 }} />
        Resolution issues ({errors.length})
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {errors.map((e) => (
          <ResolutionErrorRow key={e.reference} error={e} />
        ))}
      </div>
    </div>
  );
}

const REASON_TAG_COLOR: Record<ResolutionError['reason'], string> = {
  unresolved: 'error',
  'unset-in-scope': 'warning',
  'unknown-namespace': 'magenta',
  'reserved-namespace': 'geekblue',
  'step-out-of-context': 'volcano',
  empty: 'default',
  'invalid-resolved-value': 'warning',
};

const REASON_TAG_LABEL: Record<ResolutionError['reason'], string> = {
  unresolved: 'unresolved',
  'unset-in-scope': 'not in scope',
  'unknown-namespace': 'unknown namespace',
  'reserved-namespace': 'reserved',
  'step-out-of-context': 'step ref out of scope',
  empty: 'empty',
  'invalid-resolved-value': 'invalid value',
};

function ResolutionErrorRow({ error }: { error: ResolutionError }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: '6px 8px',
        background: token.colorErrorBg,
        border: `1px solid ${token.colorErrorBorder}`,
        borderRadius: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
        <Tooltip title="The raw reference inside {{…}}">
          <Text code style={{ fontSize: 11 }}>
            {`{{${error.reference}}}`}
          </Text>
        </Tooltip>
        <Tag color={REASON_TAG_COLOR[error.reason]} style={{ fontSize: 10, margin: 0 }}>
          {REASON_TAG_LABEL[error.reason]}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
        {error.hint}
      </Text>
    </div>
  );
}

// ── All-scopes view ───────────────────────────────────────────────

function AllScopesView({
  allVars,
  activeEnvironmentName,
  defaultEnvironmentName,
  activeCollectionName,
  openScopeEditor,
}: {
  allVars: {
    vault: DisplayVariable[];
    environment: DisplayVariable[];
    collection: DisplayVariable[];
    workspace: DisplayVariable[];
    live: DisplayVariable[];
  };
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
  openScopeEditor: (scope: DisplayScope) => (() => void) | null;
}) {
  // If a default env is configured and differs from the active one, surface
  // it in the environment-scope subtitle so users understand why a value is
  // resolving from a different env than the one they picked.
  const envSubtitle = (() => {
    if (activeEnvironmentName && defaultEnvironmentName && defaultEnvironmentName !== activeEnvironmentName) {
      return `${activeEnvironmentName} · default: ${defaultEnvironmentName}`;
    }
    if (activeEnvironmentName) return activeEnvironmentName;
    if (defaultEnvironmentName) return `No environment · default: ${defaultEnvironmentName}`;
    return 'No environment';
  })();

  return (
    <>
      <ScopeSection scope="vault" variables={allVars.vault} onOpenEditor={openScopeEditor('vault')} />
      <ScopeSection
        scope="environment"
        variables={allVars.environment}
        subtitle={envSubtitle}
        onOpenEditor={openScopeEditor('environment')}
      />
      <ScopeSection
        scope="collection"
        variables={allVars.collection}
        subtitle={activeCollectionName ?? 'No active collection'}
        onOpenEditor={openScopeEditor('collection')}
      />
      <ScopeSection scope="workspace" variables={allVars.workspace} onOpenEditor={openScopeEditor('workspace')} />
      <ScopeSection
        scope="live"
        variables={allVars.live}
        subtitle={
          allVars.live.length > 0
            ? `${allVars.live.filter((v) => v.resolved).length}/${allVars.live.length} resolved`
            : 'no live variables defined'
        }
        onOpenEditor={openScopeEditor('live')}
      />
    </>
  );
}

// ── Per-scope block ───────────────────────────────────────────────

function ScopeSection({
  scope,
  variables,
  subtitle,
  onOpenEditor,
}: {
  scope: DisplayScope;
  variables: DisplayVariable[];
  subtitle?: string;
  /** When non-null, the section title row exposes an "Edit" link that
   *  opens this scope's editor. Null hides the affordance — used for
   *  scopes with no editor available in the current context (e.g.,
   *  Environment when no env is selected and there's no default). */
  onOpenEditor?: (() => void) | null;
}) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];
  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {scopeBadge(scope, 16)}
        <Text strong style={{ fontSize: 11 }}>
          {config.label}
        </Text>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            : {subtitle}
          </Text>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {onOpenEditor ? (
            <Tooltip title={`Open the ${config.label.toLowerCase()} variables editor`}>
              <Text
                role="button"
                tabIndex={0}
                onClick={onOpenEditor}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpenEditor();
                }}
                style={{
                  fontSize: 10,
                  color: token.colorPrimary,
                  cursor: 'pointer',
                }}
              >
                Edit
              </Text>
            </Tooltip>
          ) : null}
          <Text type="secondary" style={{ fontSize: 9 }}>
            {config.priority} priority
          </Text>
        </span>
      </div>
      {variables.length > 0 ? (
        variables.map((v) => <VariableRow key={`${scope}-${v.name}`} variable={v} compact />)
      ) : (
        <Text type="secondary" style={{ fontSize: 10 }}>
          No {scope === 'vault' ? 'secrets' : 'variables'} defined.
        </Text>
      )}
    </div>
  );
}

// ── Variable row ──────────────────────────────────────────────────

function VariableRow({
  variable,
  compact = false,
  onOpenEditor,
}: {
  variable: DisplayVariable;
  compact?: boolean;
  /** When non-null, the row is clickable — clicking opens the
   *  variable's owning-scope editor (Inspector → editor handoff). The
   *  reveal-eye / TOTP-preview interactions stay within their own
   *  click targets and stop propagation so they don't trigger the row
   *  click. Null hides the affordance. */
  onOpenEditor?: (() => void) | null;
}) {
  const { token } = theme.useToken();
  const [revealed, setRevealed] = useState(false);
  const scopeConfig = SCOPE_CONFIG[variable.scope];
  const displayValue = variable.isSensitive && !revealed ? '••••••••' : variable.value;

  if (compact) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
        <Text style={{ fontFamily: "'SF Mono', monospace", fontSize: 10 }}>{variable.name}</Text>
        {variable.totp ? (
          <TotpPreview
            seed={variable.totp.seed}
            algorithm={variable.totp.algorithm}
            digits={variable.totp.digits}
            period={variable.totp.period}
            density="compact"
          />
        ) : (
          <Text
            type="secondary"
            style={{
              fontSize: 10,
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {variable.isSensitive ? '••••••••' : variable.value || '(empty)'}
          </Text>
        )}
      </div>
    );
  }

  const clickable = onOpenEditor != null;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpenEditor : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter') onOpenEditor?.();
            }
          : undefined
      }
      title={clickable ? `Open the ${SCOPE_CONFIG[variable.scope].label.toLowerCase()} editor` : undefined}
      style={{
        border: `0.5px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        padding: '6px 8px',
        marginBottom: 5,
        cursor: clickable ? 'pointer' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          fontSize: 11,
          color: variable.resolved ? token.colorPrimary : token.colorWarning,
        }}
      >
        {`{{${variable.name}}}`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {variable.totp ? (
            <TotpPreview
              seed={variable.totp.seed}
              algorithm={variable.totp.algorithm}
              digits={variable.totp.digits}
              period={variable.totp.period}
              density="compact"
            />
          ) : variable.resolved ? (
            <>
              <Text
                style={{
                  fontSize: 10,
                  color: variable.isSensitive ? token.colorTextTertiary : token.colorTextSecondary,
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayValue}
              </Text>
              {variable.isSensitive && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealed((r) => !r);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      setRevealed((r) => !r);
                    }
                  }}
                  style={{ cursor: 'pointer', fontSize: 10, color: token.colorTextTertiary }}
                >
                  {revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </span>
              )}
            </>
          ) : (
            <Text style={{ fontSize: 10, color: token.colorError }}>unresolved</Text>
          )}
        </div>
        <Tag color={scopeConfig.color} style={{ fontSize: 9, marginRight: 0 }}>
          {scopeConfig.label}
          {variable.scope === 'vault' && <LockOutlined style={{ fontSize: 9, marginLeft: 4 }} />}
        </Tag>
      </div>
    </div>
  );
}

export default VariablesPanel;
