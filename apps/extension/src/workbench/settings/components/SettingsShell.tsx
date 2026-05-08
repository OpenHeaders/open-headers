/**
 * SettingsShell — layout backing both SettingsModal and SettingsTab.
 *
 * Page-swap model: the sidebar selects exactly one category and the
 * right pane renders only that category's content. While the user is
 * searching, the right pane swaps to a flat results list and the
 * sidebar surfaces per-category match counts.
 */

import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { allCategories } from '../registry';
import { searchSettings } from '../search';
import type { CategoryDef, SettingDef } from '../types';
import CategoryNav from './CategoryNav';
import CategoryPane from './CategoryPane';
import SearchResultsPane from './SearchResultsPane';
import SettingsSearch from './SettingsSearch';

interface SettingsShellProps {
  initialSettingKey?: string;
  initialCategoryId?: string;
}

const SettingsShell: React.FC<SettingsShellProps> = ({ initialSettingKey, initialCategoryId }) => {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const paneRef = useRef<HTMLDivElement>(null);

  const isSearching = query.trim().length > 0;
  const results = useMemo(() => searchSettings(query), [query]);

  // ── Per-category def lists + match counts ───────────────────────────
  const { byCategory, matchCount } = useMemo(() => {
    const buckets = new Map<string, SettingDef[]>();
    for (const { def } of results) {
      const list = buckets.get(def.category);
      if (list) list.push(def);
      else buckets.set(def.category, [def]);
    }
    const counts = new Map<string, number>();
    if (isSearching) {
      for (const [id, defs] of buckets) counts.set(id, defs.length);
    }
    return { byCategory: buckets, matchCount: counts };
  }, [results, isSearching]);

  // ── Active category (first non-empty, by category order) ────────────
  const orderedCategories = useMemo(() => {
    const cats = allCategories();
    const visible: CategoryDef[] = [];
    for (const cat of cats) {
      if ((byCategory.get(cat.id)?.length ?? 0) > 0) visible.push(cat);
    }
    return { all: cats, visible };
  }, [byCategory]);

  const [activeId, setActiveId] = useState<string | null>(() => initialCategoryId ?? null);

  // Keep activeId valid as the visible set changes (e.g. after search edits).
  useEffect(() => {
    const visibleIds = new Set(orderedCategories.visible.map((c) => c.id));
    if (!activeId || !visibleIds.has(activeId)) {
      setActiveId(orderedCategories.visible[0]?.id ?? null);
    }
  }, [orderedCategories, activeId]);

  // Reset scroll on category swap or mode swap.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are triggers, not values
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [activeId, isSearching]);

  // Deep-link on mount: scroll the matching setting into view and flash it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only deep link
  useEffect(() => {
    if (!initialSettingKey) return;
    const id = window.requestAnimationFrame(() => {
      const pane = paneRef.current;
      if (!pane) return;
      const el = pane.querySelector<HTMLElement>(`[data-setting-key="${initialSettingKey}"]`);
      if (!el) return;
      const containerRect = pane.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + pane.scrollTop - pane.clientHeight / 2 + elRect.height / 2;
      pane.scrollTo({ top: Math.max(0, offset), behavior: 'auto' });
      el.animate(
        [{ background: token.colorPrimaryBg }, { background: token.colorPrimaryBg }, { background: 'transparent' }],
        { duration: 1400, easing: 'ease-out' },
      );
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────

  const activeCategory = activeId ? orderedCategories.all.find((c) => c.id === activeId) : null;
  const activeDefs = activeCategory ? (byCategory.get(activeCategory.id) ?? []) : [];

  const handleSelectCategory = (id: string) => {
    if (isSearching) setQuery('');
    setActiveId(id);
  };

  return (
    <div
      className="settings-shell"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgLayout }}
    >
      <style>{`
        .settings-card {
          background: ${token.colorBgContainer};
          border: 1px solid ${token.colorBorderSecondary};
          border-radius: 10px;
          overflow: hidden;
        }
        .settings-card .settings-field-row { border-bottom: none !important; padding-left: 16px !important; padding-right: 16px !important; }
        .settings-card .settings-field-row + .settings-field-row { border-top: 1px solid ${token.colorBorderSecondary}; }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <SettingsSearch query={query} onQueryChange={setQuery} />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CategoryNav
          categories={orderedCategories.all}
          activeCategoryId={isSearching ? null : activeId}
          onSelect={handleSelectCategory}
          matchCount={matchCount}
          isSearching={isSearching}
        />
        <div ref={paneRef} style={{ flex: 1, overflowY: 'auto', background: token.colorBgLayout }}>
          {isSearching ? (
            <SearchResultsPane results={results} query={query} onJumpToCategory={handleSelectCategory} />
          ) : activeCategory ? (
            <CategoryPane category={activeCategory} defs={activeDefs} />
          ) : (
            <div style={{ padding: 64, textAlign: 'center', color: token.colorTextSecondary, fontSize: 13 }}>
              No settings registered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsShell;
