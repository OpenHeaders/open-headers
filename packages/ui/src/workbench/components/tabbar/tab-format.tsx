/**
 * tab-format — pure formatters and predicates for the workbench tab strip.
 *
 * Everything here is stateless: given a tab (+ the entity lookups it may
 * reference) these functions return an icon node, a truncated label, a
 * draft/scratch classification, or a placeholder style. TabBar's
 * sub-components and App.tsx (drag preview) share this single source of
 * truth so tab appearance stays identical across every surface.
 */

import {
  AppstoreOutlined,
  CodeSandboxOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  GiftOutlined,
  SettingOutlined,
  SisternodeOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { isWorkflowComplete, isWorkflowDraft } from '@openheaders/core/live';
import type { LiveWorkflow, Request, Rule, Template } from '@openheaders/core/types';
import { isRequestComplete, isRuleComplete, isRuleDraft } from '@openheaders/core/utils';
import { theme } from 'antd';
import type React from 'react';
import type { WorkbenchTab } from '../../types';
import { ExampleChip } from '../shared/ExampleChip';
import { buildRuleIcon } from '../shared/rule-icon';
import { METHOD_COLORS } from '../sidebar/icons';
import { scopeBadge } from '../shared/scope-colors';
import { renderTwoToneIcon } from '../shared/TwoToneIconPicker';

// ── Icon helper ─────────────────────────────────────────────────────

const TAB_ICON_GRAY = '#999';
const TAB_ICON_YELLOW = 'var(--ant-color-warning, #faad14)';

/** Stable empty-set for the default arg of `tabIcon` — prevents a
 *  new Set identity per render when callers haven't wired the
 *  unresolved state yet (tests, transient call sites). */
export const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * The entity-lookup bundle every tab-strip surface needs to render a
 * tab icon and resolve its draft/paused/unresolved state. Shared so the
 * pill content, the sortable wrapper, the cross-leaf marker, and the
 * search overlay declare one identical set of props instead of four
 * verbatim copies. Positionally mirrors {@link tabIcon}'s lookup params.
 */
export interface TabEntityLookups {
  rules: Rule[];
  templates: Template[];
  requests: Request[];
  pausedUids: ReadonlySet<string>;
  unresolvableRuleUids: ReadonlySet<string>;
  unresolvableRequestUids: ReadonlySet<string>;
  liveWorkflows: LiveWorkflow[];
  unresolvableWorkflowUids: ReadonlySet<string>;
}

export function tabIcon(
  tab: WorkbenchTab,
  rules: Rule[],
  templates: Template[],
  pausedUids: ReadonlySet<string>,
  requests: Request[] = [],
  unresolvableRequestUids: ReadonlySet<string> = EMPTY_SET,
  unresolvableRuleUids: ReadonlySet<string> = EMPTY_SET,
  liveWorkflows: LiveWorkflow[] = [],
  unresolvableWorkflowUids: ReadonlySet<string> = EMPTY_SET,
  options?: {
    /** Drop list-alignment paddings (empty arrow slot on rules, 36px
     *  method-tag min-width on requests). Tooltips set this so the icon
     *  hugs neighboring text instead of reserving space for siblings
     *  that don't exist in the tooltip context. */
    compact?: boolean;
  },
): React.ReactNode {
  if (tab.mode === 'settings') return <SettingOutlined style={{ fontSize: 12, color: '#1677ff' }} />;
  if (tab.mode === 'whats-new') return <GiftOutlined style={{ fontSize: 12, color: '#1677ff' }} />;
  if (tab.mode === 'collection-overview') {
    const paused = tab.entityId ? pausedUids.has(tab.entityId) : false;
    return <FolderOpenOutlined style={{ fontSize: 12, color: paused ? TAB_ICON_YELLOW : TAB_ICON_GRAY }} />;
  }
  if (tab.mode === 'folder-overview') {
    const paused = tab.entityId ? pausedUids.has(tab.entityId) : false;
    return <FolderOutlined style={{ fontSize: 12, color: paused ? TAB_ICON_YELLOW : TAB_ICON_GRAY }} />;
  }
  if (tab.mode === 'template-edit' && tab.templateUid) {
    const tpl = templates.find((t) => t.uid === tab.templateUid);
    return (
      renderTwoToneIcon(tpl?.icon ?? '', { fontSize: 12 }) || (
        <FileTextOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />
      )
    );
  }
  if (tab.mode === 'workspace-manager') return <AppstoreOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />;
  if (tab.mode === 'daemon-admin') return <TeamOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />;
  if (tab.mode === 'env-edit') return scopeBadge('environment');
  if (tab.mode === 'spec-edit') return <FileTextOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />;
  if (tab.mode === 'workspace-vars') return scopeBadge('workspace');
  if (tab.mode === 'vault') return scopeBadge('vault');
  if (tab.mode === 'script-packages') return <CodeSandboxOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />;
  if (tab.mode === 'live-vars' || tab.mode === 'live-variable-edit' || tab.mode === 'live-variable-create')
    return scopeBadge('live', 14, tab.mode === 'live-variable-create');
  if (tab.mode === 'live-workflow-edit' || tab.mode === 'live-workflow-create') {
    const workflow = tab.liveWorkflowUid ? liveWorkflows.find((w) => w.uid === tab.liveWorkflowUid) : undefined;
    const unresolved = tab.liveWorkflowUid ? unresolvableWorkflowUids.has(tab.liveWorkflowUid) : false;
    const complete = workflow ? isWorkflowComplete(workflow) : false;
    // Draft = unpublished but otherwise complete. Greyed so the user
    // sees at a glance the workflow isn't yet on the wire — same UX
    // contract as `isRuleDraft` in the Rule sidebar / tab strip.
    const draft = workflow ? isWorkflowDraft(workflow) : true;
    const color =
      tab.mode === 'live-workflow-create' || draft
        ? TAB_ICON_GRAY
        : unresolved
          ? TAB_ICON_YELLOW
          : complete
            ? '#1677ff'
            : TAB_ICON_GRAY;
    return <SisternodeOutlined style={{ fontSize: 12, color }} />;
  }
  if (
    tab.mode === 'collection-vars' ||
    tab.mode === 'request-collection-vars' ||
    tab.mode === 'template-collection-vars'
  )
    return scopeBadge('collection');
  if (tab.mode === 'response-example' || tab.mode === 'grpc-response-example') {
    // Example marker — the shared "e.g." chip, tertiary-tinted because
    // examples are records, not runnable requests.
    return (
      <span style={{ display: 'inline-flex', minWidth: options?.compact ? undefined : 36 }}>
        <ExampleChip color={TAB_ICON_GRAY} />
      </span>
    );
  }
  if (tab.mode === 'grpc-edit') {
    // gRPC tabs carry the sidebar leaf's cased tag — NOT the rule-icon
    // fallback, which uppercases unknown type codes into "GRPC".
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--oh-method-grpc, #0b5cad)',
          fontFamily: "'SF Mono', monospace",
          minWidth: options?.compact ? undefined : 36,
          display: 'inline-block',
        }}
      >
        gRPC
      </span>
    );
  }
  if (tab.mode === 'websocket-edit') {
    // WebSocket tabs carry the sidebar leaf's flavor tag (WS / SIO) —
    // the gRPC treatment applied to the session-shaped sibling.
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--oh-method-ws, #0f766e)',
          fontFamily: "'SF Mono', monospace",
          minWidth: options?.compact ? undefined : 36,
          display: 'inline-block',
        }}
      >
        {tab.ruleType === 'SIO' ? 'SIO' : 'WS'}
      </span>
    );
  }
  if (tab.mode === 'request-edit' || tab.mode === 'request-create') {
    // Request tabs carry the HTTP method as their "icon" — compact
    // color-coded marker readable at tab-strip density.
    //
    // `request-create` tabs are scratch (not yet persisted) — gray
    // method tag matches the gray dot on the same axis. `request-edit`
    // tabs are colored unless the persisted request is incomplete or
    // has unresolved refs (mirrors the rule-tab "draft" treatment).
    const method = tab.ruleType || 'GET';
    const request =
      tab.mode === 'request-edit' && tab.requestUid ? requests.find((r) => r.uid === tab.requestUid) : undefined;
    const incomplete = request ? !isRequestComplete(request) : false;
    const unresolved = request ? unresolvableRequestUids.has(request.uid) : false;
    const muted = tab.mode === 'request-create' || incomplete || unresolved;
    const color = muted ? TAB_ICON_GRAY : (METHOD_COLORS[method] ?? 'var(--ant-color-text, #1a1a1a)');
    return (
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color,
          fontFamily: "'SF Mono', monospace",
          minWidth: options?.compact ? undefined : 36,
          display: 'inline-block',
          opacity: muted ? 0.7 : 1,
        }}
      >
        {method}
      </span>
    );
  }
  // Rule tabs — use the same rich icon as the sidebar
  const rule = tab.ruleUid ? rules.find((r) => r.uid === tab.ruleUid) : undefined;
  const paused = tab.ruleUid ? pausedUids.has(tab.ruleUid) : false;
  // Unresolved rules get the same "can't run" treatment as paused/
  // incomplete: `isActive = false` → the sidebar/tab icon renders in
  // the greyed-out palette. Badge (sidebar) + tooltip (tab) carry the
  // reason so the user knows to fix the variable, not the rule.
  const unresolved = tab.ruleUid ? unresolvableRuleUids.has(tab.ruleUid) : false;
  const isActive = rule ? rule.enabled && isRuleComplete(rule) && !paused && !unresolved : false;
  return buildRuleIcon({ ruleType: tab.ruleType, rule, isActive, paused, compactArrow: options?.compact });
}

const TAB_LABEL_MAX = 20;
/**
 * Whether a rule edit tab is showing a still-drafting (unpublished)
 * rule — drives the gray pill on the tab strip + the italic label.
 * Orthogonal to `tab.dirty` (which means "uncommitted form edits
 * since last save"). The "what counts as a draft" semantic lives in
 * core's {@link isRuleDraft} so every surface stays in lockstep.
 */
export function isRuleDraftTab(tab: WorkbenchTab, rules: Rule[]): boolean {
  if (tab.mode !== 'edit' || !tab.ruleUid) return false;
  const rule = rules.find((r) => r.uid === tab.ruleUid);
  return rule !== undefined && isRuleDraft(rule);
}

/**
 * Whether the tab is a "*-create" draft mode — entity is NOT yet
 * persisted; Save click runs the where-to-save modal. Drives the gray
 * tab dot (orthogonal to dirty/orange). Symmetric across rules and
 * requests: both global-create gestures (header +, command palette)
 * land here. Context-create gestures persist immediately and open in
 * the regular 'edit' / 'request-edit' mode, so they bypass this.
 */
export function isCreateDraftMode(tab: WorkbenchTab): boolean {
  return (
    tab.mode === 'request-create' ||
    tab.mode === 'rule-create' ||
    tab.mode === 'live-variable-create' ||
    tab.mode === 'live-workflow-create'
  );
}

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}

export function renderTabLabel(_tab: WorkbenchTab, displayLabel: string): string {
  return truncateMiddle(displayLabel, TAB_LABEL_MAX);
}

// ── Shared empty-placeholder style ───────────────────────────────
//
// Both the in-place source placeholder (inside SortableTab while
// isDragging) and the cross-leaf insertion marker share this exact
// visual so the user sees ONE consistent "where the tab will land"
// affordance across panels: a blue-tinted rectangle with a dashed
// primary outline, no content painted.

export function emptyPlaceholderStyle(token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties {
  return {
    background: token.colorPrimaryBg,
    outline: `1px dashed ${token.colorPrimary}`,
    outlineOffset: -2,
  };
}
