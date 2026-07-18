/**
 * QueryParamQuickRows — the compact query-param row list shared by the
 * quick-editor's create and edit bodies: [operation] [param] [value]
 * [remove] per row, an add-row affordance, and the Remove-All-shadows-
 * everything warning. Rows follow the workbench editor's shape so the
 * cross-surface UX stays consistent.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField } from '@openheaders/ui/shared/awareness';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { DetectedValueInput } from '@openheaders/ui/workbench/components/value-editors';
import { Button, Select, Typography, theme } from 'antd';
import type { ReactNode } from 'react';
import {
  appendQueryParamQuickRow,
  type QueryParamQuickRow,
} from '../../data/rule-create/payload-rule-create';

const { Text } = Typography;

// Same wording as the workbench editor ("Replace Only" = skips URLs
// without the param) — the labels reuse its keys.
const OPERATION_OPTION_META = [
  { value: 'add', labelKey: 'workbench.editors.rule.fields.opAddReplace' },
  { value: 'override', labelKey: 'workbench.editors.rule.fields.opReplaceOnly' },
  { value: 'remove', labelKey: 'workbench.editors.rule.fields.opRemove' },
  { value: 'remove-all', labelKey: 'workbench.editors.rule.fields.opRemoveAll' },
] as const;

export interface QueryParamQuickRowsProps {
  rows: QueryParamQuickRow[];
  setRows: (updater: (prev: QueryParamQuickRow[]) => QueryParamQuickRow[]) => void;
  /** Collection that owns (or will own) the rule — scopes the fields'
   *  `{{collection.X}}` suggestions. */
  collectionId?: string;
  /** Awareness path generator for the row leaves — the EDIT body passes
   *  `RULE_FIELD.queryParam` (its rows carry persisted entry uids);
   *  create mode omits it (no entity exists yet, same shell degradation
   *  as every uid-less create body). */
  fieldPath?: (uid: string, leaf: 'param' | 'value' | 'operation') => string;
}

export function QueryParamQuickRows({ rows, setRows, collectionId, fieldPath }: QueryParamQuickRowsProps) {
  const t = useT();
  const { token } = theme.useToken();
  const operationOptions = OPERATION_OPTION_META.map(({ value, labelKey }) => ({ value, label: t(labelKey) }));
  const wrap = (uid: string, leaf: 'param' | 'value' | 'operation', node: ReactNode): ReactNode =>
    fieldPath ? <EntityField path={fieldPath(uid, leaf)}>{node}</EntityField> : node;

  const updateRow = (uid: string, patch: Partial<QueryParamQuickRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };
  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  };

  const hasRemoveAll = rows.some((r) => r.operation === 'remove-all');
  // Add / Replace composes with Remove All (the adds become the whole
  // new query string), so only the genuinely inert combinations warn —
  // same gate as the workbench editor.
  const hasInertOps = rows.some((r) => r.operation === 'override' || r.operation === 'remove');

  return (
    <>
      {rows.map((row) => (
        <div key={row.uid} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          {wrap(
            row.uid,
            'operation',
            <Select
              size="small"
              value={row.operation}
              onChange={(op) => updateRow(row.uid, { operation: op })}
              options={operationOptions}
              style={{ width: 125, flexShrink: 0 }}
              dropdownStyle={{ zIndex: 1090 }}
            />,
          )}
          {row.operation === 'remove-all' ? (
            <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
              {t('workbench.editors.rule.fields.queryParam.removesAllNote')}
            </Text>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                {wrap(
                  row.uid,
                  'param',
                  <TemplateInput
                    size="small"
                    wrap
                    maxRows={4}
                    resizable
                    allowClear
                    value={row.param}
                    onChange={(v) => updateRow(row.uid, { param: v })}
                    placeholder={t('workbench.editors.rule.fields.queryParam.namePlaceholder')}
                    suggestionContext={{ collectionId }}
                  />,
                )}
              </div>
              {row.operation !== 'remove' && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  {wrap(
                    row.uid,
                    'value',
                    <DetectedValueInput
                      editorVariant="compact"
                      size="small"
                      wrap
                      maxRows={4}
                      resizable
                      allowClear
                      value={row.value}
                      onChange={(v) => updateRow(row.uid, { value: v })}
                      placeholder={t('workbench.editors.rule.fields.queryParam.valuePlaceholder')}
                      suggestionContext={{ collectionId }}
                    />,
                  )}
                </div>
              )}
            </>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined style={{ fontSize: 10 }} />}
            onClick={() => removeRow(row.uid)}
            disabled={rows.length === 1}
            style={{ color: token.colorTextTertiary, flexShrink: 0 }}
          />
        </div>
      ))}
      <Button
        type="dashed"
        onClick={() => setRows(appendQueryParamQuickRow)}
        icon={<PlusOutlined />}
        size="small"
        style={{ fontSize: 12 }}
      >
        {t('panel.quickEditor.queryParam.addAction')}
      </Button>
      {hasRemoveAll && hasInertOps && (
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
          {t('panel.quickEditor.queryParam.removeAllWarning')}
        </div>
      )}
    </>
  );
}
