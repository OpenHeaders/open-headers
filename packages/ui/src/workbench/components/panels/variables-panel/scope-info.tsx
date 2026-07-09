/**
 * Per-scope `(i)` popover content for the "All scopes" view — the same
 * InfoPopover model the rest of the app uses, so each scope's rank label
 * is replaced by a hover-revealed (i) that explains the scope on click.
 *
 * One consistent body for every scope: how to reference it
 * ({{ns.token}}, plus the bare {{token}} form for the four real scopes —
 * Live drops it), then the bare-{{token}} priority order with the hovered
 * scope bold + scope-coloured. A single example name (`token`) threads
 * through every reference so the syntax is easy to follow.
 */

import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { theme } from 'antd';
import { SCOPE_CONFIG, type DisplayScope } from './types';

const EXAMPLE = 'token';

/** Bare {{name}} precedence ladder (highest → lowest). Live is absent —
 *  it never participates in bare-name resolution. */
const BARE_PRECEDENCE: readonly DisplayScope[] = ['vault', 'environment', 'collection', 'workspace'];

/** `(i)` content for the panel's two top-level sections, so each one is
 *  self-explanatory next to its caret. */
export const IN_CONTEXT_INFO: InfoPopoverContent = {
  title: 'In scope',
  summary:
    'The variables the active rule, request, or template references — each resolved through every scope so you see the exact value that will apply. Empty until you open one.',
};

export const ALL_SCOPES_INFO: InfoPopoverContent = {
  title: 'All scopes',
  summary:
    "Every variable defined across all scopes, grouped by resolution priority. Open a scope's (i) for how to reference it and where it ranks.",
};

/** One-line orientation per scope — the InfoPopover summary line. */
const SCOPE_SUMMARY: Record<DisplayScope, string> = {
  vault: 'Per-user secrets, stored in your vault and never synced.',
  environment: 'Variables from the active environment, with default-environment fallback.',
  collection: 'Variables scoped to the active collection.',
  workspace: 'Variables shared across the whole workspace.',
  live: 'A workflow-backed value, resolved from the latest run.',
};

export function buildScopeInfo(scope: DisplayScope): InfoPopoverContent {
  const { label } = SCOPE_CONFIG[scope];
  const qualifier = scope === 'vault' ? 'secret' : 'variable';
  return {
    title: `${label} ${qualifier}`,
    summary: SCOPE_SUMMARY[scope],
    description: <ScopeInfoBody scope={scope} />,
  };
}

function Code({ children }: { children: string }) {
  const { token } = theme.useToken();
  return (
    <code
      style={{
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 11,
        padding: '0 4px',
        borderRadius: 3,
        background: token.colorFillTertiary,
        color: token.colorText,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </code>
  );
}

function ScopeInfoBody({ scope }: { scope: DisplayScope }) {
  const { token } = theme.useToken();
  const ns = SCOPE_CONFIG[scope].namespace;
  const isLive = scope === 'live';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        Write <Code>{`{{${ns}.${EXAMPLE}}}`}</Code>
        {isLive ? (
          <>
            {' '}
            only — not as bare <Code>{`{{${EXAMPLE}}}`}</Code>.
          </>
        ) : (
          <>
            {' '}
            or just <Code>{`{{${EXAMPLE}}}`}</Code>.
          </>
        )}
      </div>
      <div style={{ height: 1, background: token.colorBorderSecondary }} />
      <div>
        <div style={{ color: token.colorTextSecondary, marginBottom: 4 }}>
          Bare <Code>{`{{${EXAMPLE}}}`}</Code> resolves by priority:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          {BARE_PRECEDENCE.map((s, i) => {
            const current = s === scope;
            return (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <span style={{ color: token.colorTextQuaternary }}>›</span>}
                <span
                  style={{
                    fontWeight: current ? 700 : 400,
                    color: current ? `var(--scope-${s}-color)` : token.colorTextSecondary,
                  }}
                >
                  {SCOPE_CONFIG[s].label}
                </span>
              </span>
            );
          })}
        </div>
        {isLive && <div style={{ color: token.colorTextSecondary, marginTop: 4 }}>Live sits outside this order.</div>}
      </div>
    </div>
  );
}
