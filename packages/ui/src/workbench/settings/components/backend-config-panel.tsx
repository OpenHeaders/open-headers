import { Alert, theme } from 'antd';
import type React from 'react';
import type { Host } from '../../../shared/host-vocabulary';
import type { BackendMode } from '../schema/backend';
import { hostIsTheBackend } from '../schema/backend';
import SettingRow from '../fields/SettingRow';
import type { CategoryDef, SettingDef, SubcategoryDef } from '../types';
import { isModeValidForHost, SCENARIOS } from './backend-scenarios';
import DaemonTokensSection from './daemon-tokens-section';
import OfflineFallbackOrderSection from './offline-fallback-order-section';

/**
 * Subsection headings are derived from the category's `subcategories`
 * registration so the schema is the single source of truth for both
 * ordering and labels. Falls back to the bare subcategory id if a
 * setting references an unregistered subcategory.
 */
const SUBSECTION_BLURB: Record<string, string> = {
  connection: 'How this client reaches the back-end.',
  reliability: 'Auto-connect and reconnection behavior over an unstable wire.',
  notifications: 'Visual cues when the link is down.',
  'lan-peers': 'Who outside this machine can reach the daemon.',
};

export const ConfigPanel: React.FC<{
  pending: boolean;
  mode: BackendMode;
  host: Host;
  defs: readonly SettingDef[];
  category: CategoryDef;
}> = ({ pending, mode, host, defs, category }) => {
  const { token } = theme.useToken();

  // Host can't host this back-end mode — e.g. the desktop app or a
  // web bundle previewing `in-browser`, which only makes sense in a
  // browser extension. Render a hard-stop alert; no config inputs, no
  // Apply path. The picker already grays the tile, this alert is the
  // second backstop for users who reached the mode via search.
  if (!isModeValidForHost(mode, host)) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Not available on this host"
        description={
          mode === 'in-browser'
            ? 'Only the browser extension can host an in-browser back-end (its service worker is the back-end). To use this mode, open the Open Headers extension popup on this machine.'
            : `${SCENARIOS.find((s) => s.mode === mode)?.title ?? mode} isn't selectable from this surface.`
        }
      />
    );
  }

  // Two "host IS the back-end" cases: there's no outbound wire to tune,
  // but the desktop daemon still has inbound-side surfaces (the bind
  // address and the Paired-devices token management) for peers reaching
  // IN. Render just those — every other config field is outbound.
  if (hostIsTheBackend(mode, host)) {
    // LAN-peers config is meaningful only on the desktop daemon. Gate
    // the whole section at the branch level; strip each row's `when`
    // since the schema's `when` reads the *active* mode (not the
    // previewed mode this pane renders) and would hide rows we want
    // visible while the user is configuring a desktop-app preview.
    const isDaemonContext = host === 'desktop' && mode === 'desktop-app';
    const daemonDefs = isDaemonContext
      ? defs.filter((d) => d.subcategory === 'lan-peers').map((d) => (d.when ? { ...d, when: undefined } : d))
      : [];
    return (
      <>
        <Alert
          type="success"
          showIcon
          message={<span style={{ fontSize: 13 }}>Nothing outbound to configure</span>}
          description={
            <span style={{ fontSize: 12 }}>
              {mode === 'in-browser'
                ? 'The browser service worker is the back-end. Workspaces, rules, and vault live in this browser only — no external host to point at.'
                : 'The desktop app process is the back-end. Other localhost clients connect into it; there is no outbound wire to tune.'}
            </span>
          }
          style={{ marginBottom: 12 }}
        />
        {daemonDefs.length > 0 && (
          <section style={{ marginBottom: 12 }}>
            <header style={{ marginBottom: 6, padding: '0 2px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: token.colorTextSecondary,
                }}
              >
                LAN peers
              </h3>
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                {SUBSECTION_BLURB['lan-peers']}
              </div>
            </header>
            <div
              className="settings-card"
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {daemonDefs.map((def) => (
                <SettingRow key={def.key} def={def} />
              ))}
            </div>
          </section>
        )}
        {isDaemonContext && <DaemonTokensSection />}
      </>
    );
  }

  // Host-conditioned filtering. `backend.showBadgeWhenDisconnected`
  // toggles a `chrome.action` toolbar badge — meaningless outside the
  // browser extension, so drop it from the desktop / web surface.
  // Also strip each def's `when` predicate: the schema's `when` reads
  // the GLOBAL `backend.mode` setting (= the active mode), but we
  // render the PREVIEWED mode's config so the user can configure a
  // back-end they haven't switched into yet. The previewed-mode guards
  // above (host-validity + host-is-backend + pending) already gate the
  // section as a whole.
  const visibleDefs = defs
    .filter((d) => {
      if (d.key === 'backend.showBadgeWhenDisconnected' && host !== 'extension') return false;
      return true;
    })
    .map((d) => (d.when ? { ...d, when: undefined } : d));

  const grouped = groupBySubcategory(visibleDefs, category.subcategories);

  return (
    <>
      {pending && (
        <Alert
          type="info"
          showIcon
          message={<span style={{ fontSize: 13 }}>Coming soon</span>}
          description={
            <span style={{ fontSize: 12 }}>
              {mode === 'local-self-hosted'
                ? 'The standalone local / LAN daemon is on the roadmap. Pre-selecting this mode is fine; the connection layer activates once the daemon ships.'
                : 'Self-hosted remote back-ends are on the roadmap. Pre-selecting this mode is fine; the connection layer activates once the remote endpoint protocol ships.'}
            </span>
          }
          style={{ marginBottom: 12 }}
        />
      )}
      {grouped.map(({ id, label, defs: groupDefs }) =>
        groupDefs.length === 0 ? null : (
          <section key={id} style={{ marginBottom: 12 }}>
            <header style={{ marginBottom: 6, padding: '0 2px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  textTransform: 'uppercase',
                  color: token.colorTextSecondary,
                }}
              >
                {label}
              </h3>
              {SUBSECTION_BLURB[id] && (
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 1 }}>
                  {SUBSECTION_BLURB[id]}
                </div>
              )}
            </header>
            <div
              className="settings-card"
              style={{
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {groupDefs.map((def) => (
                <SettingRow key={def.key} def={def} />
              ))}
            </div>
          </section>
        ),
      )}
      {/* Offline-fallback runner order — an extension-peer concern: when
          the configured backend drops, one browser self-refreshes an
          exclusive workflow's credential, chosen by this ranking. The
          desktop daemon is the authoritative runner, so it has nothing to
          elect. */}
      {host === 'extension' && <OfflineFallbackOrderSection />}
    </>
  );
};

interface GroupedSection {
  id: string;
  label: string;
  defs: SettingDef[];
}

/**
 * Group settings by their `subcategory` field, ordered by the
 * category's registered `subcategories` list. Anything missing a
 * subcategory falls into a synthetic "Other" group at the end — this
 * keeps the grouping resilient if a new setting forgets to declare
 * its subcategory.
 */
function groupBySubcategory(
  defs: readonly SettingDef[],
  subcategories: readonly SubcategoryDef[] | undefined,
): GroupedSection[] {
  const byId = new Map<string, SettingDef[]>();
  const orderedIds = (subcategories ?? []).slice().sort((a, b) => a.order - b.order).map((s) => s.id);
  const labels = new Map((subcategories ?? []).map((s) => [s.id, s.label]));

  for (const id of orderedIds) byId.set(id, []);
  for (const def of defs) {
    const id = def.subcategory ?? '__uncategorized';
    if (!byId.has(id)) byId.set(id, []);
    const bucket = byId.get(id);
    if (bucket) bucket.push(def);
  }

  return Array.from(byId.entries()).map(([id, list]) => ({
    id,
    label: labels.get(id) ?? 'Other',
    defs: list,
  }));
}
