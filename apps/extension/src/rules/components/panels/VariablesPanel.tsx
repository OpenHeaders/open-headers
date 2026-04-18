/**
 * VariablesPanel — right-pane live view of variable scopes.
 *
 * Two modes:
 *   - "In request" — only variables referenced in the active rule /
 *     collection-overview tab, resolved against every scope with the
 *     active-tab's collection context so the user sees the exact
 *     value that will hit DNR.
 *   - "All"        — every scope's variables grouped by priority, so
 *     users can understand what's available workspace-wide.
 *
 * Data source: `useEnvironments` for vault / environment / workspace
 * vars, `useRules` for collection variables. Resolution runs in the
 * renderer — the SW already ships a snapshot of every scope via
 * `environmentsChanged`, so a second resolver instance here stays in
 * sync without extra RPCs.
 */

import {
  CloseOutlined,
  CodeOutlined,
  ExclamationCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import type { ResolutionError } from '@openheaders/core/variables';
import { VariableResolver } from '@openheaders/core/variables';
import { Empty, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import type { RulesTab } from '../../types';

const { Text } = Typography;

interface VariablesPanelProps {
  onClose: () => void;
  /** Active tab so the panel can compute "in request" variables. */
  activeTab: RulesTab | null;
}

// ── Scope config ────────────────────────────────────────────────────

const SCOPE_CONFIG = {
  vault: { label: 'Vault', color: '#e74c3c', priority: 'highest', letter: '🔒' },
  environment: { label: 'Environment', color: '#3498db', priority: 'high', letter: 'E' },
  collection: { label: 'Collection', color: '#2ecc71', priority: 'medium', letter: 'C' },
  workspace: { label: 'Workspace', color: '#f39c12', priority: 'lowest', letter: 'W' },
} as const;

type DisplayScope = keyof typeof SCOPE_CONFIG;

interface DisplayVariable {
  name: string;
  value: string;
  scope: DisplayScope;
  isSensitive: boolean;
  resolved: boolean;
}

const TEMPLATE_RX = /\{\{[^}]+\}\}/;

/**
 * Walk every string leaf of a JSON-serializable value and collect the
 * strings that contain at least one `{{...}}` reference. We need the
 * full strings (not just names) so we can feed them through
 * `resolver.resolveTemplate` and get the structured `ResolutionError`
 * list alongside the resolved values.
 *
 * Traversing leaves (instead of `JSON.stringify(rule)`-plus-regex) keeps
 * escaped `{{...}}` inside code strings and inject snippets honest —
 * we only surface references the executor would actually try to resolve.
 */
function collectTemplateStrings(input: unknown, out: string[]): void {
  if (typeof input === 'string') {
    if (TEMPLATE_RX.test(input)) out.push(input);
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collectTemplateStrings(item, out);
    return;
  }
  if (input && typeof input === 'object') {
    for (const v of Object.values(input as Record<string, unknown>)) collectTemplateStrings(v, out);
  }
}

// ── Panel ──────────────────────────────────────────────────────────

const VariablesPanel: React.FC<VariablesPanelProps> = ({ onClose, activeTab }) => {
  const { token } = theme.useToken();
  const [mode, setMode] = useState<'in-request' | 'all'>('in-request');

  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvironments();
  const { rules, localCollections, localCollectionTrees } = useRules();

  // Identify the active rule + collection for the current tab. Other
  // tab modes (landing, settings, run-report, etc.) don't carry a
  // variable-resolution context, so we render an explanatory empty
  // state in those cases.
  const { activeRule, activeCollectionId } = useMemo<{
    activeRule: V5.Rule | null;
    activeCollectionId: string | null;
  }>(() => {
    if (!activeTab) return { activeRule: null, activeCollectionId: null };
    let rule: V5.Rule | null = null;
    if (activeTab.mode === 'edit' && activeTab.ruleUid) {
      rule = rules.find((r) => r.uid === activeTab.ruleUid) ?? null;
    }
    let collId: string | null = null;
    if (activeTab.mode === 'collection-overview' && activeTab.entityId) {
      collId = activeTab.entityId;
    } else if (activeTab.mode === 'collection-vars' && activeTab.collectionUid) {
      collId = activeTab.collectionUid;
    } else if (rule) {
      // Derive the containing collection from the rule's path.
      const hit = localCollections.find((c) => rule?.path.startsWith(`${c.path}/`));
      collId = hit?.uid ?? null;
    } else if (activeTab.mode === 'folder-overview' && activeTab.entityId) {
      // Walk the collection trees to find which collection owns this folder.
      for (const col of localCollectionTrees) {
        const stack: V5.TreeNode[] = [...col.tree];
        let found = false;
        while (stack.length > 0) {
          const node = stack.shift();
          if (!node) break;
          if (node.type === 'folder' && node.uid === activeTab.entityId) {
            collId = col.uid;
            found = true;
            break;
          }
          if (node.type === 'folder') stack.push(...node.children);
        }
        if (found) break;
      }
    }
    return { activeRule: rule, activeCollectionId: collId };
  }, [activeTab, rules, localCollections, localCollectionTrees]);

  // Build a resolver that mirrors the SW's. Rebuilt every render —
  // cheap (array wiring only) and free of subtle sync bugs.
  const resolver = useMemo(() => {
    const r = new VariableResolver();
    r.setVault(vault);
    r.setEnvironments(environments);
    r.setActiveEnvironmentId(activeEnvironmentId);
    r.setDefaultEnvironmentId(defaultEnvironmentId);
    r.setWorkspaceVariables(workspaceVariables);
    for (const c of localCollections) r.setCollectionVariables(c.uid, c.variables ?? []);
    return r;
  }, [vault, environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, localCollections]);

  const activeEnvironment = activeEnvironmentId
    ? (environments.find((e) => e.uid === activeEnvironmentId)?.name ?? null)
    : null;
  const defaultEnvironment = defaultEnvironmentId
    ? (environments.find((e) => e.uid === defaultEnvironmentId)?.name ?? null)
    : null;
  const activeCollectionName = activeCollectionId
    ? (localCollections.find((c) => c.uid === activeCollectionId)?.name ?? null)
    : null;

  // ── "In request" — variables referenced by the active rule/scope
  //    Walks every template-containing string in the rule, resolves
  //    each through the full resolveTemplate machinery (so namespaces,
  //    default-env fallback, reserved-namespace detection all apply),
  //    then dedupes variables by display name and errors by reference.
  const { inRequestVars, inRequestErrors } = useMemo<{
    inRequestVars: DisplayVariable[];
    inRequestErrors: ResolutionError[];
  }>(() => {
    if (!activeRule) return { inRequestVars: [], inRequestErrors: [] };
    const templateStrings: string[] = [];
    collectTemplateStrings(activeRule, templateStrings);

    const ctx = activeCollectionId ? { collectionId: activeCollectionId } : undefined;
    const seenVars = new Map<string, DisplayVariable>();
    const seenErrors = new Map<string, ResolutionError>();

    for (const str of templateStrings) {
      const { variables, errors } = resolver.resolveTemplate(str, ctx);
      for (const v of variables) {
        if (seenVars.has(v.name)) continue;
        if (v.resolved) {
          seenVars.set(v.name, {
            name: v.name,
            value: v.value ?? '',
            scope: (v.scope ?? 'workspace') as DisplayScope,
            isSensitive: v.isSensitive ?? false,
            resolved: true,
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
      inRequestVars: [...seenVars.values()],
      inRequestErrors: [...seenErrors.values()],
    };
  }, [activeRule, activeCollectionId, resolver]);

  // ── "All" — every scope's variables, whatever their referenced state
  const allVars = useMemo(() => {
    const vaultList: DisplayVariable[] = vault.secrets.map((s) => ({
      name: s.name,
      value: s.value,
      scope: 'vault',
      isSensitive: true,
      resolved: s.value !== '',
    }));
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
      ? (localCollections.find((c) => c.uid === activeCollectionId)?.variables ?? []).map((v) => ({
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
    return { vault: vaultList, environment: envDisplay, collection: collList, workspace: wsList };
  }, [vault, environments, activeEnvironmentId, workspaceVariables, localCollections, activeCollectionId]);

  return (
    <div
      className="rules-right-panel rules-right-panel--variables"
      style={{
        background: token.colorBgLayout,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CodeOutlined />
          Variables
        </Text>
        <CloseOutlined
          style={{ color: token.colorTextTertiary, cursor: 'pointer', fontSize: 12 }}
          onClick={onClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose();
          }}
          aria-label="Close Variables panel"
        />
      </div>

      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {mode === 'in-request' && activeRule ? (
              <>
                In:{' '}
                <Text strong style={{ fontSize: 11 }}>
                  {activeRule.name}
                </Text>
              </>
            ) : (
              'All scopes'
            )}
          </Text>
          <div style={{ display: 'flex', fontSize: 10 }}>
            <span
              role="button"
              tabIndex={0}
              onClick={() => setMode('in-request')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setMode('in-request');
              }}
              style={{
                padding: '2px 6px',
                cursor: 'pointer',
                borderRadius: '3px 0 0 3px',
                ...(mode === 'in-request'
                  ? { background: token.colorPrimary, color: token.colorBgContainer }
                  : {
                      border: `1px solid ${token.colorBorderSecondary}`,
                      borderRight: 0,
                      color: token.colorTextSecondary,
                    }),
              }}
            >
              In request
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
        </div>

        {mode === 'in-request' ? (
          <InRequestView vars={inRequestVars} errors={inRequestErrors} activeRule={activeRule} />
        ) : (
          <AllScopesView
            allVars={allVars}
            activeEnvironmentName={activeEnvironment}
            defaultEnvironmentName={defaultEnvironment}
            activeCollectionName={activeCollectionName}
          />
        )}
      </div>
    </div>
  );
};

// ── In-request view ───────────────────────────────────────────────

function InRequestView({
  vars,
  errors,
  activeRule,
}: {
  vars: DisplayVariable[];
  errors: ResolutionError[];
  activeRule: V5.Rule | null;
}) {
  const { token } = theme.useToken();
  if (!activeRule) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ fontSize: 11 }}>
            Select a rule or collection to see its variables.
          </Text>
        }
      />
    );
  }
  if (vars.length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No variables referenced in this rule.
      </Text>
    );
  }
  const resolvedCount = vars.filter((v) => v.resolved).length;
  return (
    <>
      {vars.map((v) => (
        <VariableRow key={v.name} variable={v} />
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
  empty: 'default',
};

const REASON_TAG_LABEL: Record<ResolutionError['reason'], string> = {
  unresolved: 'unresolved',
  'unset-in-scope': 'not in scope',
  'unknown-namespace': 'unknown namespace',
  'reserved-namespace': 'reserved',
  empty: 'empty',
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
}: {
  allVars: {
    vault: DisplayVariable[];
    environment: DisplayVariable[];
    collection: DisplayVariable[];
    workspace: DisplayVariable[];
  };
  activeEnvironmentName: string | null;
  defaultEnvironmentName: string | null;
  activeCollectionName: string | null;
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
      <ScopeSection scope="vault" variables={allVars.vault} />
      <ScopeSection scope="environment" variables={allVars.environment} subtitle={envSubtitle} />
      <ScopeSection
        scope="collection"
        variables={allVars.collection}
        subtitle={activeCollectionName ?? 'No active collection'}
      />
      <ScopeSection scope="workspace" variables={allVars.workspace} />
    </>
  );
}

// ── Per-scope block ───────────────────────────────────────────────

function ScopeSection({
  scope,
  variables,
  subtitle,
}: {
  scope: DisplayScope;
  variables: DisplayVariable[];
  subtitle?: string;
}) {
  const { token } = theme.useToken();
  const config = SCOPE_CONFIG[scope];
  return (
    <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}`, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: scope === 'vault' ? 12 : 10,
            fontWeight: 700,
            color: 'white',
            background: config.color,
          }}
        >
          {config.letter}
        </span>
        <Text strong style={{ fontSize: 11 }}>
          {config.label}
        </Text>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 10 }}>
            : {subtitle}
          </Text>
        )}
        <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto' }}>
          {config.priority} priority
        </Text>
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

function VariableRow({ variable, compact = false }: { variable: DisplayVariable; compact?: boolean }) {
  const { token } = theme.useToken();
  const [revealed, setRevealed] = useState(false);
  const scopeConfig = SCOPE_CONFIG[variable.scope];
  const displayValue = variable.isSensitive && !revealed ? '••••••••' : variable.value;

  if (compact) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 11 }}>
        <Text style={{ fontFamily: "'SF Mono', monospace", fontSize: 10 }}>{variable.name}</Text>
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
      </div>
    );
  }

  return (
    <div
      style={{
        border: `0.5px solid ${token.colorBorderSecondary}`,
        borderRadius: 4,
        padding: '6px 8px',
        marginBottom: 5,
      }}
    >
      <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, color: token.colorWarning }}>
        {`{{${variable.name}}}`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {variable.resolved ? (
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
          ) : (
            <Text style={{ fontSize: 10, color: token.colorError }}>unresolved</Text>
          )}
          {variable.isSensitive && variable.resolved && (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setRevealed((r) => !r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setRevealed((r) => !r);
              }}
              style={{ cursor: 'pointer', fontSize: 10, color: token.colorTextTertiary }}
            >
              {revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            </span>
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
