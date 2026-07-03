/**
 * QuickConditionsRow — the "when does this rule fire" row of the
 * quick-editor popovers, rendered by the shell directly below the
 * destination row. Collapsed: a one-line summary of the rule's actual
 * conditions. Expanded (click): the workbench `ConditionEditor` bound
 * to the draft's condition list — the same rows, pickers and validation
 * banners the Rule Editor shows, so everything a rule matches on is
 * editable without leaving the devtools window.
 *
 * The expanded editor is wrapped in a scoped `ConfigProvider`:
 * `fontSize: 12` matches the popover's type scale (same treatment as
 * the destination selects), and `zIndexPopupBase: 1040` lifts every
 * antd popup the editor spawns — Select dropdowns land at 1090
 * (SelectLike offset +50), above the popover shell's 1080, without
 * threading `dropdownStyle` through the workbench component.
 */

import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { RuleCondition } from '@openheaders/core/types';
import ConditionEditor from '@openheaders/ui/workbench/components/rule/ConditionEditor';
import { DOMAIN_TYPES, getTypeDef } from '@openheaders/ui/workbench/components/rule/condition-types';
import { ConfigProvider, theme } from 'antd';
import { useState } from 'react';

/** One-line digest of a condition list — `<type label> <values>` per
 *  row, joined with `·` (the AND connector reads as noise at this
 *  size). Pure so the collapsed row's wording is pinnable in tests. */
export function summarizeConditions(conditions: readonly RuleCondition[]): string {
  if (conditions.length === 0) return 'none — matches no requests';
  return conditions
    .map((c) => {
      const label = getTypeDef(c.type)?.label ?? c.type;
      const values =
        c.type === 'domain-type'
          ? (DOMAIN_TYPES.find((d) => d.value === c.values[0])?.label ?? c.values[0] ?? '')
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
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="dt-quick-dest-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Show and edit when this rule fires"
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
          Conditions{' '}
          <span style={{ color: value.length > 0 ? token.colorText : token.colorTextTertiary }}>
            {summarizeConditions(value)}
          </span>
        </span>
      </button>
      {open && (
        <ConfigProvider theme={{ token: { fontSize: 12, zIndexPopupBase: 1040 } }}>
          <div style={{ marginTop: 6 }}>
            <ConditionEditor value={value} onChange={onChange} />
          </div>
        </ConfigProvider>
      )}
    </div>
  );
}
