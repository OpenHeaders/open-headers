/**
 * SpecTab — the HTTP request's spec binding surface: the picker for
 * the request's own OpenAPI link (a request inside a spec-generated
 * collection inherits the collection's link until it picks one), the
 * linked document and its drift, the operation this request pairs
 * with by method + URL template, and the fields that differ from the
 * spec with a per-field Apply — the same comparison the collection's
 * Update dialog runs, one request at a time.
 */

import type { Collection } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { Button, Select, Tag, Typography } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { SPEC_FORMAT_LABELS } from '../specs/spec-format-labels';
import type { SpecChangedField } from '../specs/spec-update-plan';
import { type Draft, headersFromRequest, paramsFromRequest } from './draft';
import type { RequestSpecOperation } from './request-spec-binding';
import { useRequestSpecBinding } from './useRequestSpecBinding';

const { Text } = Typography;

/** The spec fields the tab can converge — `name` is the tab's identity,
 *  not draft content, so a rename stays the user's. */
const APPLICABLE_FIELDS: readonly SpecChangedField[] = ['description', 'headers', 'params', 'auth', 'body'];

const FIELD_LABEL_KEYS = {
  name: 'workbench.editors.spec.update.field.name',
  description: 'workbench.editors.spec.update.field.description',
  headers: 'workbench.editors.spec.update.field.headers',
  params: 'workbench.editors.spec.update.field.params',
  auth: 'workbench.editors.spec.update.field.auth',
  body: 'workbench.editors.spec.update.field.body',
} as const;

interface SpecTabProps {
  workspaceId: string | null;
  /** The request's containing collection, when saved into one. */
  collection: Collection | undefined;
  requestName: string;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
}

const SpecTab: React.FC<SpecTabProps> = ({ workspaceId, collection, requestName, draft, setDraft }) => {
  const t = useT();
  const binding = useRequestSpecBinding(workspaceId, collection, draft, requestName);
  const specs = useSpecs(workspaceId);
  const openapiSpecs = useMemo(
    () => specs.filter((s) => s.format === 'openapi-3.0' || s.format === 'openapi-3.1'),
    [specs],
  );
  const inherited =
    binding.kind !== 'unlinked' && binding.source.kind === 'collection' ? binding.source.collection : null;
  const inheritedSpecName =
    inherited && (binding.kind === 'linked' || binding.kind === 'parseError') ? binding.spec.name : null;

  const apply = useCallback(
    (operation: RequestSpecOperation, fields: readonly SpecChangedField[]) => {
      const { updates } = operation;
      setDraft((d) => {
        const next = { ...d };
        for (const field of fields) {
          if (field === 'description' && updates.description !== undefined) next.description = updates.description;
          if (field === 'headers' && updates.headers) next.headers = headersFromRequest(updates.headers);
          if (field === 'params' && updates.params) next.params = paramsFromRequest(updates.params);
          if (field === 'auth' && updates.auth) next.auth = updates.auth;
          if (field === 'body' && updates.body) next.body = updates.body;
        }
        return next;
      });
    },
    [setDraft],
  );

  const picker = (
    <div>
      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
        {t('workbench.editors.request.spec.selectLabel')}
      </Text>
      <Select
        style={{ width: '100%' }}
        allowClear
        placeholder={
          inheritedSpecName !== null
            ? t('workbench.editors.request.spec.inheritedPlaceholder', { name: inheritedSpecName })
            : t('workbench.editors.request.spec.selectPlaceholder')
        }
        // null, not undefined — an undefined value flips the antd
        // Select to uncontrolled.
        value={draft.specLink?.specUid ?? null}
        options={openapiSpecs.map((s) => ({ value: s.uid, label: s.name }))}
        onChange={(specUid: string | undefined) =>
          setDraft((d) => ({ ...d, specLink: specUid === undefined ? undefined : { specUid } }))
        }
        data-testid="request-spec-select"
      />
    </div>
  );

  if (binding.kind === 'unlinked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="request-spec-tab">
        {picker}
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.spec.none')}
        </Text>
      </div>
    );
  }

  const specName = binding.kind === 'missing' ? null : binding.spec.name;
  const applicable =
    binding.kind === 'linked'
      ? binding.operation?.changedFields.filter((f) => APPLICABLE_FIELDS.includes(f))
      : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }} data-testid="request-spec-tab">
      {picker}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {specName !== null && (
          <Text style={{ fontSize: 12 }} data-testid="request-spec-name">
            {specName}
          </Text>
        )}
        {binding.kind !== 'missing' && (
          <Tag style={{ margin: 0, fontSize: 11 }}>{SPEC_FORMAT_LABELS[binding.spec.format]}</Tag>
        )}
        {inherited && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.editors.request.spec.fromCollection', { name: inherited.name })}
          </Text>
        )}
      </div>
      {binding.kind === 'missing' && (
        <Text type="warning" style={{ fontSize: 11 }} data-testid="request-spec-missing">
          {t('workbench.editors.request.spec.missing')}
        </Text>
      )}
      {binding.kind === 'parseError' && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.request.spec.parseFailure', { message: binding.message })}
        </Text>
      )}
      {binding.kind === 'linked' && binding.drifted === true && (
        <Text type="warning" style={{ fontSize: 11 }} data-testid="request-spec-drifted">
          {t('workbench.editors.request.spec.drifted')}
        </Text>
      )}
      {binding.kind === 'linked' && binding.operation === null && (
        <Text type="secondary" style={{ fontSize: 12 }} data-testid="request-spec-no-operation">
          {t('workbench.editors.request.spec.noOperation', { method: draft.method, url: draft.url })}
        </Text>
      )}
      {binding.kind === 'linked' && binding.operation !== null && applicable !== undefined && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="request-spec-operation">
          <div>
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 4 }}>
              {t('workbench.editors.request.spec.operation')}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 500 }}>{binding.operation.spec.name}</Text>
            {binding.operation.spec.description && (
              <Text type="secondary" style={{ display: 'block', fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 4 }}>
                {binding.operation.spec.description}
              </Text>
            )}
          </div>
          {applicable.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }} data-testid="request-spec-in-sync">
              {t('workbench.editors.request.spec.inSync')}
            </Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {applicable.map((field) => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, flex: 1 }}>
                    {t('workbench.editors.request.spec.fieldDiffers', { field: t(FIELD_LABEL_KEYS[field]) })}
                  </Text>
                  <Button
                    size="small"
                    onClick={() => binding.operation && apply(binding.operation, [field])}
                    data-testid={`request-spec-apply-${field}`}
                  >
                    {t('workbench.editors.request.spec.apply')}
                  </Button>
                </div>
              ))}
              {applicable.length > 1 && (
                <div>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => binding.operation && apply(binding.operation, applicable)}
                    data-testid="request-spec-apply-all"
                  >
                    {t('workbench.editors.request.spec.applyAll')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpecTab;
