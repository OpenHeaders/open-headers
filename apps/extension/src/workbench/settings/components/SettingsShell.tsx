/**
 * SettingsShell — layout backing both SettingsModal and SettingsTab.
 * Composes CategoryNav + SettingsSearch + a scroll-spy content pane.
 *
 * Data flow:
 *   - query → search.ts → filtered defs → grouped by category
 *   - sections stack vertically, each anchored by data-category-id
 *   - useScrollSpy tracks which section's top has crossed the active line
 *     and exposes scroll-to helpers; clicks on the nav re-use them.
 */

import { Empty, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { allCategories } from '../registry';
import { searchSettings } from '../search';
import type { CategoryDef, SettingDef } from '../types';
import CategoryNav from './CategoryNav';
import SettingsSearch from './SettingsSearch';
import SettingsSection from './SettingsSection';
import { useScrollSpy } from './useScrollSpy';

interface SettingsShellProps {
  /** Optional deep-link target: scroll to this setting key on mount. */
  initialSettingKey?: string;
  /** Optional deep-link target: scroll to this category on mount. */
  initialCategoryId?: string;
}

const SCROLL_TOP_OFFSET = 16;

const SettingsShell: React.FC<SettingsShellProps> = ({ initialSettingKey, initialCategoryId }) => {
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const { activeId, setActiveId, registerSection, scrollToSection, scrollToElement } = useScrollSpy({
    containerRef: contentRef,
    topOffset: SCROLL_TOP_OFFSET,
    initialId: initialCategoryId ?? null,
  });

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

  // Keep activeId in sync with which categories are visible after a search.
  useEffect(() => {
    if (activeId && !visibleCategoryIds.has(activeId)) {
      setActiveId(sectionList[0]?.category.id ?? null);
    } else if (!activeId && sectionList.length > 0) {
      setActiveId(sectionList[0].category.id);
    }
  }, [visibleCategoryIds, activeId, sectionList, setActiveId]);

  // Deep-link on mount: prefer setting-key (centered + flash), fall back to category.
  useEffect(() => {
    if (initialSettingKey) {
      const el = contentRef.current?.querySelector<HTMLElement>(`[data-setting-key="${initialSettingKey}"]`);
      if (el) {
        scrollToElement(el, 'auto', 'center');
        el.animate(
          [{ background: token.colorPrimaryBg }, { background: token.colorPrimaryBg }, { background: 'transparent' }],
          { duration: 1400, easing: 'ease-out' },
        );
        return;
      }
    }
    if (initialCategoryId) scrollToSection(initialCategoryId, 'auto');
    // Mount-only: deep links apply once per shell instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="settings-shell"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: token.colorBgLayout }}
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
          activeCategoryId={activeId}
          onSelect={(id) => scrollToSection(id)}
          visibleCategoryIds={visibleCategoryIds}
        />
        <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', background: token.colorBgLayout }}>
          {sectionList.length === 0 ? (
            <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
              <Empty description="No settings match your search" />
            </div>
          ) : (
            sectionList.map(({ category, defs }) => (
              <SettingsSection key={category.id} category={category} defs={defs} ref={registerSection(category.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsShell;
