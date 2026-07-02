/**
 * ResponseQuickFields — the compact response form shared by the
 * quick-editor's edit and create bodies: status select (Keep-original
 * `0` sentinel + grouped codes), content-type autocomplete, plain
 * textarea body. Edit mode passes `entityUid` so each input publishes
 * field-focus awareness; create mode has no entity yet and renders the
 * bare inputs.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from '@openheaders/ui/workbench/components/rule-fields/status-codes';
import { AutoComplete, Input, Select, theme } from 'antd';
import type { ReactNode } from 'react';
import type { ResponseQuickDraft } from '../../data/response-rule-edit';

export interface ResponseQuickFieldsProps {
  draft: ResponseQuickDraft;
  updateDraft: (patch: Partial<ResponseQuickDraft>) => void;
  /** Live rule uid — wraps the inputs in awareness EntityFields. */
  entityUid?: string;
}

const STATUS_OPTIONS = [{ value: 0, label: 'Keep original status code' }, ...STATUS_CODES];

export function ResponseQuickFields({ draft, updateDraft, entityUid }: ResponseQuickFieldsProps) {
  const { token } = theme.useToken();

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: token.colorTextTertiary,
    marginBottom: 2,
  };

  const field = (path: string, node: ReactNode): ReactNode =>
    entityUid ? <EntityField path={path}>{node}</EntityField> : node;

  const body = (
    <>
      {/* Status + Content-Type on one row; the body gets the full
          width below so JSON payloads have room to breathe. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={fieldLabelStyle}>Status Code</div>
          {field(
            RULE_FIELD.responseStatusCode,
            <Select
              size="small"
              showSearch
              value={draft.statusCode}
              onChange={(code) => updateDraft({ statusCode: code })}
              options={STATUS_OPTIONS}
              style={{ width: '100%' }}
              // Popover container's stacking context is z=1080 — lift
              // the dropdown above it, same as the header popover.
              dropdownStyle={{ zIndex: 1090 }}
              filterOption={(input, option) => {
                const label = String(option?.label ?? '');
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            />,
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={fieldLabelStyle}>Content-Type</div>
          {field(
            RULE_FIELD.responseContentType,
            <AutoComplete
              size="small"
              value={draft.contentType}
              onChange={(v) => updateDraft({ contentType: v })}
              options={CONTENT_TYPE_OPTIONS}
              placeholder="application/json"
              style={{ width: '100%' }}
              dropdownStyle={{ zIndex: 1090 }}
              filterOption={(input, option) => {
                const value = String(option?.value ?? '');
                return value.toLowerCase().includes(input.toLowerCase());
              }}
            />,
          )}
        </div>
      </div>
      <div>
        <div style={fieldLabelStyle}>Response Body</div>
        {field(
          RULE_FIELD.responseBody,
          <Input.TextArea
            value={draft.responseBody}
            onChange={(e) => updateDraft({ responseBody: e.target.value })}
            placeholder={'{"message": "custom response", "data": []}'}
            autoSize={{ minRows: 6, maxRows: 12 }}
            style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}
          />,
        )}
      </div>
    </>
  );

  return entityUid ? (
    <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={entityUid}>
      {body}
    </EntityScopeProvider>
  ) : (
    body
  );
}
