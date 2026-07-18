/**
 * ResponseQuickFields — the compact response form shared by the
 * quick-editor's edit and create bodies: status select (Keep-original
 * `0` sentinel + grouped codes), content-type autocomplete, and the
 * SAME format-aware body editor the rule-editor tab document uses
 * (Formatted/Raw toggle, content-type-driven Monaco coloring; the form
 * value is WIRE text). Edit mode passes `entityUid` so each input
 * publishes field-focus awareness; create mode has no entity yet and
 * renders the bare inputs.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityField, EntityScopeProvider, RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { CONTENT_TYPE_OPTIONS, STATUS_CODES } from '@openheaders/ui/workbench/components/rule-fields/status-codes';
import { AutoComplete, Select, theme } from 'antd';
import { lazy, type ReactNode, Suspense, useMemo } from 'react';
import { detectLanguage } from '../../data/mime';
import type { ResponseQuickDraft } from '../../data/rule-create/response-rule-edit';
import Skeleton from '../detail/Skeleton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco into the panel's initial chunk.
const FormatAwareBodyEditor = lazy(
  () => import('@openheaders/ui/workbench/components/rule-fields/FormatAwareBodyEditor'),
);

// JSON format example — raw by design across the rule editors.
const RESPONSE_BODY_EXAMPLE = '{"message": "custom response", "data": []}';

export interface ResponseQuickFieldsProps {
  draft: ResponseQuickDraft;
  updateDraft: (patch: Partial<ResponseQuickDraft>) => void;
  /** Live rule uid — wraps the inputs in awareness EntityFields. */
  entityUid?: string;
}

export function ResponseQuickFields({ draft, updateDraft, entityUid }: ResponseQuickFieldsProps) {
  const t = useT();
  const { token } = theme.useToken();
  const statusOptions = useMemo(
    () => [{ value: 0, label: t('workbench.editors.rule.fields.response.keepOriginalStatus') }, ...STATUS_CODES],
    [t],
  );

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
          <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.statusCode')}</div>
          {field(
            RULE_FIELD.responseStatusCode,
            <Select
              size="small"
              showSearch
              value={draft.statusCode}
              onChange={(code) => updateDraft({ statusCode: code })}
              options={statusOptions}
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
          <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.contentType')}</div>
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
        <div style={fieldLabelStyle}>{t('workbench.editors.rule.fields.response.bodyLabel')}</div>
        {field(
          RULE_FIELD.responseBody,
          <Suspense fallback={<Skeleton />}>
            <FormatAwareBodyEditor
              value={draft.responseBody}
              onChange={(v) => updateDraft({ responseBody: v })}
              language={detectLanguage(draft.contentType) ?? 'json'}
              placeholder={RESPONSE_BODY_EXAMPLE}
              minHeight={160}
            />
          </Suspense>,
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
