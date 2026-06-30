/**
 * Hover tooltip for a scope's rank label in the "All scopes" view. One
 * layout for every scope so they read consistently:
 *
 *   1. How to reference it — {{ns.token}}, plus the bare {{token}} form
 *      for the four real scopes (Live drops the bare form: it's only
 *      reachable as {{live.token}}).
 *   2. The bare-{{token}} priority order, with the hovered scope bold +
 *      scope-coloured. Live sits outside that order and says so.
 *
 * A single example name (`token`) threads through every reference so the
 * syntax is easy to follow at a glance.
 */

import { SCOPE_COLORS } from '../../shared/scope-colors';
import { SCOPE_CONFIG, type DisplayScope } from './types';

const EXAMPLE = 'token';

/** Bare {{name}} precedence ladder (highest → lowest). Live is absent —
 *  it never participates in bare-name resolution. */
const BARE_PRECEDENCE: readonly DisplayScope[] = ['vault', 'environment', 'collection', 'workspace'];

function Code({ children }: { children: string }) {
  return (
    <code
      style={{
        fontFamily: "'SF Mono', 'Fira Code', monospace",
        fontSize: 10.5,
        padding: '0 4px',
        borderRadius: 3,
        background: 'rgba(255,255,255,0.14)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </code>
  );
}

export function ScopeRankTooltip({ scope }: { scope: DisplayScope }) {
  const ns = SCOPE_CONFIG[scope].namespace;
  const isLive = scope === 'live';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, lineHeight: 1.5 }}>
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
      <div>
        <div style={{ opacity: 0.65, marginBottom: 3 }}>
          Bare <Code>{`{{${EXAMPLE}}}`}</Code> resolves by priority:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          {BARE_PRECEDENCE.map((s, i) => {
            const current = s === scope;
            return (
              <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                <span
                  style={{
                    fontWeight: current ? 700 : 400,
                    color: current ? SCOPE_COLORS[s].bg : undefined,
                    opacity: current ? 1 : 0.75,
                  }}
                >
                  {SCOPE_CONFIG[s].label}
                </span>
              </span>
            );
          })}
        </div>
        {isLive && <div style={{ opacity: 0.65, marginTop: 3 }}>Live sits outside this order.</div>}
      </div>
    </div>
  );
}
