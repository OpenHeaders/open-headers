/**
 * Global back-end config sections — the settings-schema rows that apply
 * to EVERY connection, grouped by subcategory under the connections
 * list. Connection identity (address, token, auto-connect) lives on the
 * `OH.backends` records and renders inside each row's editor. Each def's
 * `when` predicate is honored here so a section whose every row is
 * hidden drops its header too.
 */

import { theme } from 'antd';
import type React from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import SettingRow from '../fields/SettingRow';
import { resolveLabel } from '../localize';
import { get as storeGet } from '../store';
import type { CategoryDef, SettingDef, SettingKey, SettingsMap, SubcategoryDef } from '../types';

export const GlobalConfigSections: React.FC<{
  defs: readonly SettingDef[];
  category: CategoryDef;
}> = ({ defs, category }) => {
  const { token } = theme.useToken();
  const t = useT();

  const evaluateWhen = (d: SettingDef): boolean =>
    d.when ? d.when(<K extends SettingKey>(k: K): SettingsMap[K] => storeGet(k)) : true;
  const visibleDefs = defs.filter(evaluateWhen);

  const grouped = groupBySubcategory(visibleDefs, category.subcategories, t);

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
  t: Translate,
): GroupedSection[] {
  const byId = new Map<string, SettingDef[]>();
  const orderedIds = (subcategories ?? []).slice().sort((a, b) => a.order - b.order).map((s) => s.id);
  const labels = new Map((subcategories ?? []).map((s) => [s.id, resolveLabel(s, t)]));

  for (const id of orderedIds) byId.set(id, []);
  for (const def of defs) {
    const id = def.subcategory ?? '__uncategorized';
    if (!byId.has(id)) byId.set(id, []);
    const bucket = byId.get(id);
    if (bucket) bucket.push(def);
  }

  return Array.from(byId.entries()).map(([id, list]) => ({
    id,
    label: labels.get(id) ?? t('workbench.settings.shell.otherGroup'),
    defs: list,
  }));
}
