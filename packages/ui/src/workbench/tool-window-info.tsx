/**
 * Single source of truth for the `(i)` title-bar popover copy of every
 * workbench tool window. Keyed by `ToolWindowId`, so the `Record` is
 * exhaustive by construction — add a tool window and the compiler
 * forces its info entry here. Edit a panel's design/text in one place
 * instead of chasing its render site.
 *
 * The shell (`App.tsx`) resolves copy via `getToolWindowInfo(id)` and
 * threads it into the panel's `PanelHeader`.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { NOTIFICATIONS_PANEL_INFO } from '@openheaders/ui/shared/notifications';
import { buildRuleIcon } from './components/shared/rule-icon';
import { scopeBadge } from './components/shared/scope-colors';
import { ALL_RULE_TYPES } from './rule-type-menu';
import type { ToolWindowId } from './types';

/** Inline `{{token}}` reference — code chip so the syntax reads as
 *  syntax, matching the per-scope popovers' treatment. */
const Code = ({ children }: { children: string }) => (
  <code
    style={{
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 11,
      padding: '0 4px',
      borderRadius: 3,
      background: 'var(--ant-color-fill-tertiary)',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </code>
);

const TOOL_WINDOW_INFO: Record<ToolWindowId, InfoPopoverContent> = {
  'http-rules': {
    title: 'HTTP Rules',
    summary:
      'Create rules that rewrite outgoing requests and incoming responses. Rules live in collections and can inject values from variables, the vault, and live workflows.',
    sections: [
      {
        heading: 'Rule types',
        // Single-sourced from the create-menu catalogue so the popover
        // never drifts from what the picker actually offers. The lead
        // icon is the same fixed-width type code rows render, so the
        // labels form an aligned column. Stacked layout: these labels
        // are long, so descriptions get their own line.
        layout: 'stacked',
        items: ALL_RULE_TYPES.map((t) => ({
          icon: buildRuleIcon({ ruleType: t.key, isActive: true }),
          label: t.label,
          desc: t.description,
        })),
      },
    ],
  },
  workflows: {
    title: 'Workflows',
    summary: (
      <>
        A scheduled-refresh variable producer: a request chain plus an extraction rule. Its output surfaces as a{' '}
        <Code>{'{{live.*}}'}</Code> reference you can use anywhere a variable is accepted.
      </>
    ),
  },
  docs: {
    title: 'Docs',
    summary:
      'In-app documentation for rules, variables, workflows, and the workbench itself — browse without leaving the app.',
  },
  'var-scope': {
    title: 'Scope',
    summary: (
      <>
        The variables the active tab references and every scope they resolve against. A bare <Code>{'{{name}}'}</Code>{' '}
        falls through the priority order below; namespaced refs like <Code>{'{{live.*}}'}</Code> target one scope
        directly.
      </>
    ),
    sections: [
      {
        heading: 'Priority order',
        items: [
          { icon: scopeBadge('vault', 14), label: 'Vault', desc: 'Per-user secrets, never synced — highest priority.' },
          {
            icon: scopeBadge('environment', 14),
            label: 'Environment',
            desc: 'The active environment, falling back to the default environment.',
          },
          { icon: scopeBadge('collection', 14), label: 'Collection', desc: "The active entity's collection." },
          {
            icon: scopeBadge('workspace', 14),
            label: 'Workspace',
            desc: 'Shared across the workspace — lowest priority.',
          },
        ],
      },
      {
        heading: 'Namespaced',
        items: [
          {
            icon: scopeBadge('live', 14),
            label: 'Live',
            desc: (
              <>
                Workflow-backed; reached only via <Code>{'{{live.*}}'}</Code>, resolved from the latest run.
              </>
            ),
          },
        ],
      },
    ],
  },
  variables: {
    title: 'Variables',
    summary:
      'The variable catalogue — everything defined across environments, collections, the workspace, and the vault. Use Scope to see what is actually in scope for the active tab.',
    sections: [
      {
        heading: 'Variable types',
        items: [
          { icon: scopeBadge('vault', 14), label: 'Vault', desc: 'Per-user secrets — stored locally, never synced.' },
          {
            icon: scopeBadge('environment', 14),
            label: 'Environment',
            desc: 'Defined per environment; the active one supplies values.',
          },
          {
            icon: scopeBadge('collection', 14),
            label: 'Collection',
            desc: 'Defined on a collection; apply to the entities inside it.',
          },
          { icon: scopeBadge('workspace', 14), label: 'Workspace', desc: 'Shared across the whole workspace.' },
          {
            icon: scopeBadge('live', 14),
            label: 'Live',
            desc: (
              <>
                Workflow-produced values, referenced as <Code>{'{{live.*}}'}</Code>.
              </>
            ),
          },
        ],
      },
    ],
  },
  'api-requests': {
    title: 'API Requests',
    summary: 'Saved API requests and the environments they run against, organized into collections and folders.',
  },
  'deep-network-inspection': {
    title: 'Deep Network Inspection',
    summary:
      'Connection-level (L4) and HTTP (L7) inspection in one view — TCP/TLS health like RTT, retransmissions, and handshake timing alongside full request/response visibility, modification, and replay.',
  },
  'workflow-status': {
    title: 'Workflow Status',
    summary:
      'Per-workflow circuit-breaker dashboard — state, consecutive failures, openings, and next-attempt countdown, with manual Retry and Reset-circuit actions.',
  },
  'test-runs': {
    title: 'Test Runs',
    summary:
      "Results of rule and request test runs — scoped to the active tab's owner (rule, folder, collection, or workspace), or browsed across all runs.",
  },
  notifications: NOTIFICATIONS_PANEL_INFO,
  activity: {
    title: 'Activity',
    summary:
      'Workspace-wide feed of inbound changes from peers, with classifier highlights for sensitive-field rotations, permission-scope expansions, and local-edit supersedes.',
  },
};

/** Title-bar `(i)` popover copy for a workbench tool window. */
export function getToolWindowInfo(id: ToolWindowId): InfoPopoverContent {
  return TOOL_WINDOW_INFO[id];
}
