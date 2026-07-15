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

import type { MessageKey } from '@openheaders/i18n';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { theme } from 'antd';
import { SCOPE_CONFIG, type DisplayScope } from './types';

const EXAMPLE = 'token';

/** Bare {{name}} precedence ladder (highest → lowest). Live is absent —
 *  it never participates in bare-name resolution. */
const BARE_PRECEDENCE: readonly DisplayScope[] = ['vault', 'environment', 'collection', 'workspace'];

/** `(i)` content for the panel's two top-level sections, so each one is
 *  self-explanatory next to its caret. */
export function getInContextInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.variables.panel.inContextTitle'),
    summary: t('workbench.variables.panel.inContextSummary'),
  };
}

export function getAllScopesInfo(t: Translate): InfoPopoverContent {
  return {
    title: t('workbench.variables.panel.allScopesTitle'),
    summary: t('workbench.variables.panel.allScopesSummary'),
  };
}

/** One-line orientation per scope — the InfoPopover summary line. */
const SCOPE_SUMMARY: Record<DisplayScope, MessageKey> = {
  vault: 'workbench.variables.panel.scopeSummary.vault',
  environment: 'workbench.variables.panel.scopeSummary.environment',
  collection: 'workbench.variables.panel.scopeSummary.collection',
  workspace: 'workbench.variables.panel.scopeSummary.workspace',
  live: 'workbench.variables.panel.scopeSummary.live',
};

export function buildScopeInfo(t: Translate, scope: DisplayScope): InfoPopoverContent {
  const label = t(SCOPE_CONFIG[scope].labelKey);
  const qualifier = t(
    scope === 'vault'
      ? 'workbench.variables.panel.scopeInfo.qualifierSecret'
      : 'workbench.variables.panel.scopeInfo.qualifierVariable',
  );
  return {
    title: t('workbench.variables.panel.scopeInfo.title', { label, qualifier }),
    summary: t(SCOPE_SUMMARY[scope]),
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
  const t = useT();
  const ns = SCOPE_CONFIG[scope].namespace;
  const isLive = scope === 'live';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        {t('workbench.variables.panel.scopeInfo.writePrefix')} <Code>{`{{${ns}.${EXAMPLE}}}`}</Code>
        {isLive ? (
          <>
            {' '}
            {t('workbench.variables.panel.scopeInfo.liveOnlyMiddle')} <Code>{`{{${EXAMPLE}}}`}</Code>
            {t('workbench.variables.panel.scopeInfo.sentenceEnd')}
          </>
        ) : (
          <>
            {' '}
            {t('workbench.variables.panel.scopeInfo.orJustMiddle')} <Code>{`{{${EXAMPLE}}}`}</Code>
            {t('workbench.variables.panel.scopeInfo.sentenceEnd')}
          </>
        )}
      </div>
      <div style={{ height: 1, background: token.colorBorderSecondary }} />
      <div>
        <div style={{ color: token.colorTextSecondary, marginBottom: 4 }}>
          {t('workbench.variables.panel.scopeInfo.barePrefix')} <Code>{`{{${EXAMPLE}}}`}</Code>{' '}
          {t('workbench.variables.panel.scopeInfo.bareSuffix')}
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
                  {t(SCOPE_CONFIG[s].labelKey)}
                </span>
              </span>
            );
          })}
        </div>
        {isLive && (
          <div style={{ color: token.colorTextSecondary, marginTop: 4 }}>
            {t('workbench.variables.panel.scopeInfo.liveOutside')}
          </div>
        )}
      </div>
    </div>
  );
}
