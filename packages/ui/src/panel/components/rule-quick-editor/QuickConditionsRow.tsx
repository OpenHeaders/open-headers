/**
 * QuickConditionsRow — the "when does this rule fire" row of the
 * quick-editor popovers, rendered by the shell directly below the
 * destination row. Collapsed: a one-line summary of the rule's actual
 * conditions. Expanded (click): the workbench `ConditionEditor` bound
 * to the draft's condition list — the same rows, pickers and validation
 * banners the Rule Editor shows, so everything a rule matches on is
 * editable without leaving the devtools window.
 *
 * The expanded editor is wrapped in a scoped `ConfigProvider` with
 * `fontSize: 12` to match the popover's type scale (same treatment as
 * the destination selects). Its Select dropdowns and tooltips need no
 * z-index plumbing: they portal to `document.body`, OUTSIDE the panel
 * root's isolated stacking context, so they paint above the popover
 * (whose 1080 is local to that context) by stacking-order alone.
 */

import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { RuleCondition } from '@openheaders/core/types';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import ConditionEditor from '@openheaders/ui/workbench/components/rule/ConditionEditor';
import { DOMAIN_TYPES, getTypeDef } from '@openheaders/ui/workbench/components/rule/condition-types';
import { ConfigProvider, theme } from 'antd';
import { useState } from 'react';

/** One-line digest of a condition list — `<type label> <values>` per
 *  row, joined with `·` (the AND connector reads as noise at this
 *  size). Pure — the caller passes its `useT()` translator (shared-
 *  module rule) — so the collapsed row's wording is pinnable in tests. */
export function summarizeConditions(conditions: readonly RuleCondition[], t: Translate): string {
  if (conditions.length === 0) return t('panel.quickEditor.conditions.none');
  return conditions
    .map((c) => {
      const def = getTypeDef(c.type);
      const label = def ? t(def.labelKey) : c.type;
      const values =
        c.type === 'domain-type'
          ? (() => {
              const domainType = DOMAIN_TYPES.find((d) => d.value === c.values[0]);
              return domainType ? t(domainType.labelKey) : (c.values[0] ?? '');
            })()
          : c.values.join(', ');
      const name = c.headerName ? `${c.headerName}: ` : '';
      const text = `${name}${values}`.trim();
      return text ? `${label} ${text}` : label;
    })
    .join(' · ');
}

export interface QuickConditionsRowProps {
  value: RuleCondition[];
  onChange: (next: RuleCondition[]) => void;
}

export function QuickConditionsRow({ value, onChange }: QuickConditionsRowProps) {
  const t = useT();
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="dt-quick-dest-toggle"
        onClick={() => setOpen((v) => !v)}
        title={t('panel.quickEditor.conditions.title')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          fontSize: 11,
          color: token.colorTextSecondary,
          minWidth: 0,
        }}
      >
        {open ? <DownOutlined style={{ fontSize: 8 }} /> : <RightOutlined style={{ fontSize: 8 }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {t('panel.quickEditor.conditions.label')}{' '}
          <span style={{ color: value.length > 0 ? token.colorText : token.colorTextTertiary }}>
            {summarizeConditions(value, t)}
          </span>
        </span>
      </button>
      {open && (
        <ConfigProvider theme={{ token: { fontSize: 12 } }}>
          <div style={{ marginTop: 6 }}>
            <ConditionEditor value={value} onChange={onChange} />
          </div>
        </ConfigProvider>
      )}
    </div>
  );
}
