/**
 * KeymapPane — custom right-pane renderer for the Keyboard settings
 * category. Replaces the flat record-button rows with an interactive
 * keymap: subcategory groups with collapsible headers, one KeymapRow
 * per action (inline record, unbind, reset, modified dot, conflict and
 * reserved-chord warnings), a plain-text filter over action labels/
 * descriptions, and a sticky bottom strip summarizing duplicate
 * assignments — clicking it filters the list down to the conflicted
 * rows and back.
 */

import { DownOutlined, RightOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import { Input, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSettingsReady } from '../../hooks';
import { resolveLabel, resolveOptionalDescription } from '../../localize';
import type { CategoryPaneProps } from '../../types';
import { buildKeymapGroups } from './keymap-groups';
import KeymapRow from './KeymapRow';
import { useKeymapConflicts } from './use-keymap-conflicts';

const KeymapPane: React.FC<CategoryPaneProps> = ({ category, defs }) => {
  const { token } = theme.useToken();
  const t = useT();
  useSettingsReady();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [conflictsOnly, setConflictsOnly] = useState(false);

  const conflicts = useKeymapConflicts(defs);
  // The show-only-conflicts mode has no strip to leave through once the
  // last conflict resolves — drop it so a future conflict doesn't
  // surprise-filter the list.
  useEffect(() => {
    if (conflicts.size === 0) setConflictsOnly(false);
  }, [conflicts]);
  const restrictTo = useMemo(
    () => (conflictsOnly && conflicts.size > 0 ? new Set(conflicts.keys()) : null),
    [conflictsOnly, conflicts],
  );
  const groups = useMemo(
    () => buildKeymapGroups(category, defs, query, t, restrictTo),
    [category, defs, query, t, restrictTo],
  );
  // Restriction to conflicted rows counts as searching: hits must not
  // hide inside collapsed sections here either.
  const isSearching = query.trim().length > 0 || restrictTo !== null;
  const description = resolveOptionalDescription(category, t);

  const toggleGroup = (id: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: '14px 18px 20px' }}>
      <header style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
          {resolveLabel(category, t)}
        </h2>
        {description && (
          <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>{description}</p>
        )}
      </header>

      <Input
        size="small"
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder={t('workbench.settings.keymapPane.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 12, maxWidth: 320 }}
      />

      {groups.length === 0 && (
        <p style={{ fontSize: 12, color: token.colorTextSecondary }}>
          {t('workbench.settings.keymapPane.noMatches')}
        </p>
      )}

      {groups.map((group, i) => {
        const id = group.sub?.id ?? `_orphans_${i}`;
        // Search expands everything — a filter that hides its own hits
        // inside collapsed sections reads as broken.
        const isCollapsed = !isSearching && collapsed.has(id);
        return (
          <section key={id} style={{ marginBottom: 14 }}>
            {group.sub && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px' }}>
                <button
                  type="button"
                  onClick={() => toggleGroup(id)}
                  aria-expanded={!isCollapsed}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: token.colorText,
                    flex: 'none',
                  }}
                >
                  {isCollapsed ? (
                    <RightOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
                  ) : (
                    <DownOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
                  )}
                  {resolveLabel(group.sub, t)}
                </button>
                <div style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
              </div>
            )}
            {!isCollapsed && (
              <div className="settings-card">
                {group.defs.map((def) => (
                  <KeymapRow key={def.key} def={def} scopeDefs={defs} conflicts={conflicts.get(def.key)} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {conflicts.size > 0 && (
        <button
          type="button"
          onClick={() => setConflictsOnly((v) => !v)}
          style={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: `1px solid ${token.colorWarningBorder}`,
            borderRadius: token.borderRadiusSM,
            background: token.colorWarningBg,
            cursor: 'pointer',
            fontSize: 12,
            color: token.colorText,
            textAlign: 'left',
          }}
        >
          <WarningOutlined style={{ fontSize: 12, color: token.colorWarning }} />
          <span style={{ flex: 1 }}>{t('workbench.settings.keymapPane.conflictSummary', { count: conflicts.size })}</span>
          <span style={{ color: token.colorPrimary }}>
            {conflictsOnly
              ? t('workbench.settings.keymapPane.conflictShowAll')
              : t('workbench.settings.keymapPane.conflictShowOnly')}
          </span>
        </button>
      )}
    </div>
  );
};

export default KeymapPane;
