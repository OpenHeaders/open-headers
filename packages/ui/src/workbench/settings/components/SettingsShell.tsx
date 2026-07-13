/**
 * SettingsShell — layout backing both SettingsModal and SettingsTab.
 *
 * Page-swap model: the sidebar selects exactly one category and the
 * right pane renders only that category's content. While the user is
 * searching, the right pane swaps to a flat results list and the
 * sidebar surfaces per-category match counts.
 */

import { UndoOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, type InputRef, Popconfirm, Skeleton, theme } from 'antd';
import type React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useDaemonAdminStatus } from '../../components/daemon-admin/use-daemon-admin-status';
import { useModifiedCount, useResetAllSettings } from '../hooks';
import { allCategories, getDef } from '../registry';
import { searchSettings } from '../search';
import type { CategoryDef, SettingDef, SettingKey } from '../types';
import CategoryNav, { type CategoryNavHandle } from './CategoryNav';
import CategoryPane from './CategoryPane';
import SearchResultsPane from './SearchResultsPane';
import SettingsSearch from './SettingsSearch';

interface SettingsShellProps {
  initialSettingKey?: string;
  initialCategoryId?: string;
}

const SettingsShell: React.FC<SettingsShellProps> = ({ initialSettingKey, initialCategoryId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [query, setQuery] = useState('');
  const paneRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<InputRef>(null);
  const navRef = useRef<CategoryNavHandle>(null);

  const focusSearch = useCallback(() => {
    searchRef.current?.focus({ cursor: 'all' });
  }, []);
  const focusSidebar = useCallback(() => {
    navRef.current?.focusActive();
  }, []);

  const isSearching = query.trim().length > 0;
  const results = useMemo(() => searchSettings(query, t), [query, t]);

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
  // Categories with a custom pane stay selectable even with zero setting
  // defs — group landing pages own no settings of their own.
  const daemonAdmin = useDaemonAdminStatus();
  const orderedCategories = useMemo(() => {
    const cats = allCategories().filter((c) => c.when?.({ daemonAdmin }) !== false);
    const visible: CategoryDef[] = [];
    for (const cat of cats) {
      if ((byCategory.get(cat.id)?.length ?? 0) > 0 || cat.renderPane) visible.push(cat);
    }
    return { all: cats, visible };
  }, [byCategory, daemonAdmin]);

  // The setting's own category wins over an explicit initialCategoryId
  // when both are passed — otherwise deep-linking to a key in a different
  // category would mount the wrong pane and the row wouldn't be in the DOM.
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (initialSettingKey) {
      const def = getDef(initialSettingKey as SettingKey);
      if (def) return def.category;
    }
    return initialCategoryId ?? null;
  });

  // Keep activeId valid as the visible set changes (e.g. after search edits).
  useEffect(() => {
    const visibleIds = new Set(orderedCategories.visible.map((c) => c.id));
    if (!activeId || !visibleIds.has(activeId)) {
      setActiveId(orderedCategories.visible[0]?.id ?? null);
    }
  }, [orderedCategories, activeId]);

  // `/` focuses search — same convention used elsewhere in the app.
  // Suppressed when another input has focus so users can type "/" into
  // setting fields.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const inField =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      if (inField) return;
      e.preventDefault();
      focusSearch();
    };
    root.addEventListener('keydown', onKeyDown);
    return () => root.removeEventListener('keydown', onKeyDown);
  }, [focusSearch]);

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
      // Hold the flash, then fade — long enough to survive the eye
      // travel from wherever the deep link was clicked.
      el.animate(
        [
          { background: token.colorPrimaryBg, offset: 0 },
          { background: token.colorPrimaryBg, offset: 0.85 },
          { background: 'transparent', offset: 1 },
        ],
        { duration: 5000, easing: 'ease-out' },
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
    <ConfigProvider componentSize="small">
      <div
        ref={rootRef}
        className="settings-shell"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: token.colorBgContainer,
          fontSize: 13,
        }}
      >
        <style>{`
          .settings-card {
            background: ${token.colorBgContainer};
            border: 1px solid ${token.colorBorderSecondary};
            border-radius: 8px;
            overflow: hidden;
          }
          .settings-card .settings-field-row { border-bottom: none !important; padding-left: 12px !important; padding-right: 12px !important; }
          .settings-card .settings-field-row + .settings-field-row { border-top: 1px solid ${token.colorBorderSecondary}; }
        `}</style>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <SettingsSearch
            query={query}
            onQueryChange={setQuery}
            inputRef={searchRef}
            autoFocus
            onArrowDown={focusSidebar}
          />
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CategoryNav
            ref={navRef}
            categories={orderedCategories.all}
            activeCategoryId={isSearching ? null : activeId}
            onSelect={handleSelectCategory}
            matchCount={matchCount}
            isSearching={isSearching}
            onLeaveTop={focusSearch}
          />
          <div ref={paneRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none', background: token.colorBgContainer }}>
            {isSearching ? (
              <SearchResultsPane results={results} query={query} onJumpToCategory={handleSelectCategory} />
            ) : activeCategory ? (
              (() => {
                const Pane = activeCategory.renderPane ?? CategoryPane;
                // `renderPane` may be a React.lazy component — categories
                // that need heavy UI (Monaco / large form trees) defer
                // their pane import so the settings-bootstrap path stays
                // light. Wrap unconditionally; the default `CategoryPane`
                // resolves synchronously and Suspense is a no-op for it.
                return (
                  <Suspense fallback={<CategoryPaneSkeleton />}>
                    <Pane category={activeCategory} defs={activeDefs} onSelectCategory={handleSelectCategory} />
                  </Suspense>
                );
              })()
            ) : (
              <div style={{ padding: 64, textAlign: 'center', color: token.colorTextSecondary, fontSize: 13 }}>
                {t('workbench.settings.shell.noneRegistered')}
              </div>
            )}
          </div>
        </div>
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '6px 14px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            fontSize: 11,
            color: token.colorTextTertiary,
            flex: 'none',
          }}
        >
          <Hint keys={['/']} label={t('workbench.settings.shell.hint.search')} />
          <Hint keys={['↑', '↓']} label={t('workbench.settings.shell.hint.navigate')} />
          <Hint keys={['↵']} label={t('workbench.settings.shell.hint.select')} />
          <Hint keys={['Esc']} label={t('workbench.settings.shell.hint.clearClose')} />
          <div style={{ flex: 1 }} />
          <ResetAllButton />
        </footer>
      </div>
    </ConfigProvider>
  );
};

const CategoryPaneSkeleton: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <div style={{ padding: '14px 18px 20px', maxWidth: 760 }}>
      <Skeleton.Input active size="small" style={{ width: 140, marginBottom: 10 }} />
      <div
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 14,
        }}
      >
        <Skeleton active paragraph={{ rows: 1, width: '90%' }} title={false} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton.Button key={i} active block style={{ height: 48 }} />
        ))}
      </div>
      <div
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 14,
        }}
      >
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
      <div
        style={{
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: '14px 16px',
        }}
      >
        <Skeleton active paragraph={{ rows: 2 }} />
      </div>
    </div>
  );
};

const ResetAllButton: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  const modified = useModifiedCount();
  const resetAll = useResetAllSettings();
  const disabled = modified === 0;
  return (
    <Popconfirm
      title={t('workbench.settings.shell.resetAllTitle')}
      description={
        modified === 0
          ? t('workbench.settings.shell.resetAllNone')
          : t('workbench.settings.shell.resetAllDescription', { count: modified })
      }
      okText={t('workbench.settings.shell.resetConfirm')}
      okButtonProps={{ danger: true, disabled }}
      cancelText={t('shared.action.cancel')}
      onConfirm={() => {
        if (!disabled) resetAll();
      }}
      placement="topRight"
      disabled={disabled}
    >
      <Button
        size="small"
        type="text"
        icon={<UndoOutlined />}
        disabled={disabled}
        style={{ fontSize: 11, color: disabled ? token.colorTextTertiary : token.colorTextSecondary }}
      >
        {modified === 0
          ? t('workbench.settings.shell.resetAll')
          : t('workbench.settings.shell.resetAllCount', { count: modified })}
      </Button>
    </Popconfirm>
  );
};

const Hint: React.FC<{ keys: readonly string[]; label: string }> = ({ keys, label }) => {
  const { token } = theme.useToken();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {keys.map((k) => (
        <kbd
          key={k}
          style={{
            display: 'inline-block',
            minWidth: 18,
            padding: '0 5px',
            borderRadius: 4,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgLayout,
            color: token.colorTextSecondary,
            fontSize: 10,
            fontFamily: 'inherit',
            lineHeight: '16px',
            textAlign: 'center',
          }}
        >
          {k}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  );
};

export default SettingsShell;
