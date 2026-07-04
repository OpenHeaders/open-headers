/**
 * QueryParamQuickRows — the compact query-param row list shared by the
 * quick-editor's create and edit bodies: [operation] [param] [value]
 * [remove] per row, an add-row affordance, and the Remove-All-shadows-
 * everything warning. Rows follow the workbench editor's shape so the
 * cross-surface UX stays consistent.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { TemplateInput } from '@openheaders/ui/workbench/components/template-input';
import { Button, Select, Typography, theme } from 'antd';
import {
  appendQueryParamQuickRow,
  type QueryParamQuickRow,
} from '../../data/rule-create/payload-rule-create';

const { Text } = Typography;

// Same casing + wording as the workbench editor ("Replace Only" =
// skips URLs without the param).
const OPERATION_OPTIONS = [
  { value: 'add', label: 'Add / Replace' },
  { value: 'override', label: 'Replace Only' },
  { value: 'remove', label: 'Remove' },
  { value: 'remove-all', label: 'Remove All' },
] as const;

export interface QueryParamQuickRowsProps {
  rows: QueryParamQuickRow[];
  setRows: (updater: (prev: QueryParamQuickRow[]) => QueryParamQuickRow[]) => void;
  /** Collection that owns (or will own) the rule — scopes the fields'
   *  `{{collection.X}}` suggestions. */
  collectionId?: string;
}

export function QueryParamQuickRows({ rows, setRows, collectionId }: QueryParamQuickRowsProps) {
  const { token } = theme.useToken();

  const updateRow = (uid: string, patch: Partial<QueryParamQuickRow>) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };
  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
  };

  const hasRemoveAll = rows.some((r) => r.operation === 'remove-all');
  const hasOtherOps = rows.some((r) => r.operation !== 'remove-all');

  return (
    <>
      {rows.map((row) => (
        <div key={row.uid} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Select
            size="small"
            value={row.operation}
            onChange={(op) => updateRow(row.uid, { operation: op })}
            options={[...OPERATION_OPTIONS]}
            style={{ width: 125, flexShrink: 0 }}
            dropdownStyle={{ zIndex: 1090 }}
          />
          {row.operation === 'remove-all' ? (
            <Text type="secondary" style={{ fontSize: 11, flex: 1 }}>
              Removes all query parameters from the URL
            </Text>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TemplateInput
                  size="small"
                  wrap
                  maxRows={4}
                  resizable
                  allowClear
                  value={row.param}
                  onChange={(v) => updateRow(row.uid, { param: v })}
                  placeholder="Param Name"
                  suggestionContext={{ collectionId }}
                />
              </div>
              {row.operation !== 'remove' && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TemplateInput
                    size="small"
                    wrap
                    maxRows={4}
                    resizable
                    allowClear
                    value={row.value}
                    onChange={(v) => updateRow(row.uid, { value: v })}
                    placeholder="Param Value"
                    suggestionContext={{ collectionId }}
                  />
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
        Add action
      </Button>
      {hasRemoveAll && hasOtherOps && (
        <div style={{ marginTop: 6, fontSize: 11, color: token.colorWarning, lineHeight: 1.4 }}>
          Remove All strips the entire query string — the other operations in this rule will be ignored.
        </div>
      )}
    </>
  );
}
