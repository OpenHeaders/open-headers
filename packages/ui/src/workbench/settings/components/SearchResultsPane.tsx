/**
 * SearchResultsPane — flat results view shown while the user is searching.
 *
 * Results are grouped by category, one card per category, with the
 * category label as a small breadcrumb header above each card. Clicking
 * the breadcrumb jumps the user to that category and clears the search.
 */

import { theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import SettingRow from '../fields/SettingRow';
import { allCategories } from '../registry';
import type { SettingsSearchResult } from '../search';
import type { CategoryDef, SettingDef } from '../types';

interface SearchResultsPaneProps {
  results: readonly SettingsSearchResult[];
  query: string;
  onJumpToCategory: (categoryId: string) => void;
}

const SearchResultsPane: React.FC<SearchResultsPaneProps> = ({ results, query, onJumpToCategory }) => {
  const { token } = theme.useToken();

  const grouped = useMemo(() => {
    const catOrder = new Map(allCategories().map((c, i) => [c.id, { def: c, index: i }] as const));
    const buckets = new Map<string, SettingDef[]>();
    for (const { def } of results) {
      const list = buckets.get(def.category);
      if (list) list.push(def);
      else buckets.set(def.category, [def]);
    }
    const ordered: { cat: CategoryDef; defs: SettingDef[] }[] = [];
    for (const [catId, defs] of buckets) {
      const meta = catOrder.get(catId);
      if (meta) ordered.push({ cat: meta.def, defs });
    }
    ordered.sort((a, b) => (catOrder.get(a.cat.id)?.index ?? 0) - (catOrder.get(b.cat.id)?.index ?? 0));
    return ordered;
  }, [results]);

  if (results.length === 0) {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center', color: token.colorTextSecondary, fontSize: 13 }}>
        No settings match <strong style={{ color: token.colorText }}>{query.trim()}</strong>
      </div>
    );
  }

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          Search results
        </h2>
        <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
          {results.length} {results.length === 1 ? 'match' : 'matches'} for <em>{query.trim()}</em>
        </p>
      </header>
      {grouped.map(({ cat, defs }) => (
        <section key={cat.id} style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => onJumpToCategory(cat.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              margin: '0 0 5px 4px',
              padding: 0,
              border: 'none',
              background: 'transparent',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: token.colorTextTertiary,
              cursor: 'pointer',
            }}
            title="Jump to category"
          >
            <span style={{ fontSize: 12, opacity: 0.85 }}>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
          <div className="settings-card">
            {defs.map((def) => (
              <SettingRow key={def.key} def={def} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default SearchResultsPane;
