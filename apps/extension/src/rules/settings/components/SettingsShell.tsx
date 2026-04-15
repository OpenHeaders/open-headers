/**
 * SettingsShell — the layout that backs both SettingsModal and
 * SettingsTab. Composes CategoryNav + SettingsSearch + scroll-spy
 * content pane.
 *
 * Data flow:
 *   - query → search.ts → filtered defs → grouped by category
 *   - sections stack vertically, each anchored by data-category-id
 *   - IntersectionObserver on each section tells the nav which
 *     category is "current"
 *   - clicking a nav entry scrolls that section into view; scroll-spy
 *     is temporarily suppressed during programmatic scroll so the
 *     highlight lands where the user expected.
 */

import { Empty, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allCategories } from '../registry';
import { searchSettings } from '../search';
import type { CategoryDef, SettingDef } from '../types';
import CategoryNav from './CategoryNav';
import SettingsSearch from './SettingsSearch';
import SettingsSection from './SettingsSection';

interface SettingsShellProps {
  /** Optional deep-link target: scroll to this setting key on mount. */
  initialSettingKey?: string;
  /** Optional deep-link target: scroll to this category on mount. */
  initialCategoryId?: string;
}

const SettingsShell: React.FC<SettingsShellProps> = ({ initialSettingKey, initialCategoryId }) => {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialCategoryId ?? null,
  );

  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const suppressSpyRef = useRef(false);

  // ── Category filtering + grouping ──────────────────────────────────
  //
  // Run the search once per query change. Group the results by
  // category so each SettingsSection gets its own def list, in
  // category order. Empty categories drop out.

  const { sectionList, visibleCategoryIds } = useMemo(() => {
    const results = searchSettings(query);
    const grouped = new Map<string, SettingDef[]>();
    for (const { def } of results) {
      const list = grouped.get(def.category);
      if (list) list.push(def);
      else grouped.set(def.category, [def]);
    }
    const ordered: { category: CategoryDef; defs: SettingDef[] }[] = [];
    for (const cat of allCategories()) {
      const defs = grouped.get(cat.id);
      if (defs && defs.length > 0) ordered.push({ category: cat, defs });
    }
    const visible = new Set(ordered.map((s) => s.category.id));
    return { sectionList: ordered, visibleCategoryIds: visible };
  }, [query]);

  // Ensure the active category is still visible after a query change.
  useEffect(() => {
    if (activeCategoryId && !visibleCategoryIds.has(activeCategoryId)) {
      setActiveCategoryId(sectionList[0]?.category.id ?? null);
    } else if (!activeCategoryId && sectionList.length > 0) {
      setActiveCategoryId(sectionList[0].category.id);
    }
  }, [visibleCategoryIds, activeCategoryId, sectionList]);

  // ── Scroll-spy ─────────────────────────────────────────────────────

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressSpyRef.current) return;
        // Pick the section with the largest visible area near the top.
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.categoryId;
          if (!id) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { id, ratio: entry.intersectionRatio };
          }
        }
        if (best) setActiveCategoryId(best.id);
      },
      { root, rootMargin: '0px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Click-to-scroll ────────────────────────────────────────────────

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = sectionRefs.current.get(categoryId);
    if (!el) return;
    suppressSpyRef.current = true;
    setActiveCategoryId(categoryId);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      suppressSpyRef.current = false;
    }, 500);
  }, []);

  // ── Deep link on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (initialSettingKey) {
      const el = contentRef.current?.querySelector<HTMLElement>(
        `[data-setting-key="${initialSettingKey}"]`,
      );
      if (el) {
        suppressSpyRef.current = true;
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        el.animate(
          [
            { background: token.colorPrimaryBg },
            { background: token.colorPrimaryBg },
            { background: 'transparent' },
          ],
          { duration: 1400, easing: 'ease-out' },
        );
        window.setTimeout(() => {
          suppressSpyRef.current = false;
        }, 600);
      }
    } else if (initialCategoryId) {
      // Delay a tick so section refs are populated.
      window.setTimeout(() => scrollToCategory(initialCategoryId), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div
      className="settings-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: token.colorBgLayout,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 20px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
        }}
      >
        <SettingsSearch query={query} onQueryChange={setQuery} />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CategoryNav
          activeCategoryId={activeCategoryId}
          onSelect={scrollToCategory}
          visibleCategoryIds={visibleCategoryIds}
        />
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            background: token.colorBgLayout,
          }}
        >
          {sectionList.length === 0 ? (
            <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
              <Empty description="No settings match your search" />
            </div>
          ) : (
            sectionList.map(({ category, defs }) => (
              <SettingsSection
                key={category.id}
                category={category}
                defs={defs}
                ref={(el) => {
                  if (el) sectionRefs.current.set(category.id, el);
                  else sectionRefs.current.delete(category.id);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsShell;
