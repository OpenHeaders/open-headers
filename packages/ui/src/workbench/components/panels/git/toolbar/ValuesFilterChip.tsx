/**
 * ValuesFilterChip — a log filter chip that holds a LIST of values (the
 * User and the Paths chips), the reference's menu: Select… (the field
 * that takes several — `FilterValuesField`), the chip's own rows (me;
 * Select in Tree…), Recent — the lists applied last, the one that
 * stands marked — and the line naming the key that clears. Every label
 * starts on one x. The delete key clears a held filter while the menu
 * is open.
 */

import { Menu, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { menuCheckIcon, menuIconGutter } from '../../../shared/menu-check';
import FilterValuesField from './FilterValuesField';
import { sameValues } from './filter-values';
import GitFilterChip from './GitFilterChip';

export interface ValuesFilterChipRow {
  key: string;
  label: string;
  disabled?: boolean;
  onPick: () => void;
}

export interface ValuesFilterChipProps {
  label: string;
  /** The chip's reading of the filter; null = idle. */
  value: string | null;
  /** The value's hover — every member, when the reading is cut short. */
  valueTitle?: string;
  /** The filter as a list — what Select… opens holding; empty when it is no list (`me`) or none. */
  values: readonly string[];
  /** Select… finished, or a recent list was picked. An empty list clears. */
  onApply: (values: string[]) => void;
  onClear: () => void;
  /** The names a typed word may become. */
  names: readonly string[];
  /** A bar separates values in the field too (authors); off for paths. */
  bar: boolean;
  /** The chip's own rows, under Select…. */
  rows: readonly ValuesFilterChipRow[];
  /** The lists applied last, newest first. */
  recent: readonly (readonly string[])[];
  /** A recent list as its row reads. */
  recentText: (values: readonly string[]) => string;
  testid: string;
}

const ValuesFilterChip: React.FC<ValuesFilterChipProps> = ({
  label,
  value,
  valueTitle,
  values,
  onApply,
  onClear,
  names,
  bar,
  rows,
  recent,
  recentText,
  testid,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'select'>('menu');

  const close = (): void => {
    setOpen(false);
    setMode('menu');
  };

  // The delete key clears a held filter and closes, as the last line says.
  useEffect(() => {
    if (!open || mode !== 'menu' || value === null) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      event.preventDefault();
      event.stopPropagation();
      onClear();
      setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, mode, value, onClear]);

  return (
    <GitFilterChip
      label={label}
      value={value}
      valueTitle={valueTitle}
      onClear={onClear}
      open={open}
      onOpenChange={(next, info) => {
        // The Dropdown closes on any click in a menu it hosts; a row that
        // picks closes the chip itself, and Select… keeps it open.
        if (!next && info.source === 'menu') return;
        setOpen(next);
        if (!next) setMode('menu');
      }}
      popupRender={() => (
        <div
          className="git-filter-popup"
          style={{
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            overflow: 'hidden',
          }}
          data-testid={`${testid}-popup`}
          data-mode={mode}
        >
          {mode === 'select' ? (
            <FilterValuesField
              names={names}
              values={values}
              bar={bar}
              strict={false}
              onFinish={(next) => {
                onApply(next);
                close();
              }}
              testid={`${testid}-select`}
            />
          ) : (
            <>
              <Menu
                className="git-filter-menu"
                selectable={false}
                style={{ minWidth: 200, maxHeight: 420, overflowY: 'auto', boxShadow: 'none', border: 'none' }}
                onClick={({ key, domEvent }) => {
                  if (key === 'select') {
                    // Opened by Enter, the field would take this key press's line break.
                    domEvent.preventDefault();
                    setMode('select');
                    return;
                  }
                  if (key.startsWith('recent:')) {
                    const again = recent[Number(key.slice('recent:'.length))];
                    if (again !== undefined) onApply([...again]);
                  } else {
                    rows.find((row) => `row:${row.key}` === key)?.onPick();
                  }
                  close();
                }}
                items={[
                  { key: 'select', label: t('workbench.gitLog.menu.select'), icon: menuIconGutter() },
                  ...rows.map((row) => ({
                    key: `row:${row.key}`,
                    label: row.label,
                    icon: menuIconGutter(),
                    disabled: row.disabled,
                  })),
                  ...(recent.length > 0
                    ? [
                        { type: 'divider' as const },
                        {
                          type: 'group' as const,
                          label: t('workbench.gitBranch.group.recent'),
                          children: recent.map((entry, index) => ({
                            key: `recent:${index}`,
                            label: (
                              <span
                                title={entry.length > 1 ? entry.join('\n') : undefined}
                                data-testid={`${testid}-recent`}
                              >
                                {recentText(entry)}
                              </span>
                            ),
                            icon: menuCheckIcon(sameValues(entry, values)),
                          })),
                        },
                      ]
                    : []),
                ]}
              />
              <div
                style={{
                  padding: '4px 12px 5px',
                  borderTop: `1px solid ${token.colorBorderSecondary}`,
                  fontSize: 12,
                  color: token.colorTextTertiary,
                }}
                data-testid={`${testid}-hint`}
              >
                {t('workbench.gitLog.menu.clearHint', { key: isMac ? '⌫' : 'Backspace' })}
              </div>
            </>
          )}
        </div>
      )}
      testid={testid}
    />
  );
};

export default ValuesFilterChip;
