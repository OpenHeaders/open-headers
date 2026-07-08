/**
 * Global back-end config sections — the settings-schema rows that apply
 * to EVERY connection (reliability knobs, notification cues), grouped
 * by subcategory under the connections list. Connection identity
 * (address, token, auto-connect) lives on the `OH.backends` records and
 * renders inside each row's editor; the daemon-side inbound rows
 * (`lan-peers`) render in the tier-zero card. Each def's `when`
 * predicate is honored here — with no enabled backend there is no wire
 * to tune, so the sections fold away exactly as the old tier-zero
 * ("nothing outbound to configure") branch did.
 */

import { theme } from 'antd';
import type React from 'react';
import type { Host } from '../../../shared/host-vocabulary';
import SettingRow from '../fields/SettingRow';
import { get as storeGet } from '../store';
import type { CategoryDef, SettingDef, SettingKey, SettingsMap, SubcategoryDef } from '../types';
import OfflineFallbackOrderSection from './offline-fallback-order-section';

const SUBSECTION_BLURB: Record<string, string> = {
  reliability: 'Auto-reconnection behavior over an unstable wire. Applies to every connection.',
  notifications: 'Visual cues when a link is down.',
};

export const GlobalConfigSections: React.FC<{
  host: Host;
  defs: readonly SettingDef[];
  category: CategoryDef;
}> = ({ host, defs, category }) => {
  const { token } = theme.useToken();

  // `backend.showBadgeWhenDisconnected` toggles a `chrome.action`
  // toolbar badge — meaningless outside the browser extension. The
  // lan-peers rows belong to the tier-zero card (daemon-side), and the
  // `when` predicates gate on the derived mode (no enabled backend →
  // nothing to tune → the row hides).
  // Evaluated here (not just in SettingRow) so a section whose every
  // row is `when`-hidden drops its header too.
  const evaluateWhen = (d: SettingDef): boolean =>
    d.when ? d.when(<K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k)) : true;
  const visibleDefs = defs.filter((d) => {
    if (d.subcategory === 'lan-peers') return false;
    if (d.key === 'backend.showBadgeWhenDisconnected' && host !== 'extension') return false;
    return evaluateWhen(d);
  });

  const grouped = groupBySubcategory(visibleDefs, category.subcategories);

  return (
    <>
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
