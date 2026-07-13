/**
 * ConditionEditor — condition rows that map 1:1 to Chrome DNR fields.
 *
 * Each condition row IS exactly one Chrome DNR field — its "slot". No
 * operator abstraction. What the user configures is exactly what Chrome
 * executes.
 *
 * Categories:
 *   URL Matching: url-filter, url-regex (share one DNR slot — mutex)
 *   Domain Filtering: request-domains, exclude-request-domains, initiator-domains, exclude-initiator-domains
 *   Request Filtering: request-methods, exclude-request-methods, resource-types, exclude-resource-types, domain-type
 *   Header Matching: response-header, exclude-response-header (Chrome 128+)
 *
 * # One row per slot
 *
 * Two rows that target the same DNR slot would silently overwrite each
 * other in `buildDnrCondition`. The picker therefore disables types whose
 * slot is already claimed by another row. Header types are exempt from
 * picker-side disabling: their slot identity includes the header name
 * (which the picker can't predict), so the structural validator instead
 * flags `(type, headerName)` collisions per-row after the user types a
 * name.
 *
 * # Why one row, not many merged automatically
 *
 * Multiple rows of the same plural type (e.g. four `request-domains`
 * rows) used to merge into a single Chrome `requestDomains` array, but
 * that contradicted the editor's "rows AND" contract — the merge made
 * them OR. Locking to one row preserves the AND model and gives the
 * user a single canonical place to express OR (the values inside the
 * row, comma-separated).
 *
 * `request-header` / `exclude-request-header` are intentionally NOT in the
 * picker: Chrome MV3 DNR has no request-header matching, so they ship
 * nothing. They remain in the schema for forward-compat with older imports.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { ConditionType, RuleCondition } from '@openheaders/core/types';
import {
  applyDomainValueCleanup,
  CONDITION_META,
  type ConditionStructuralIssue,
  getConditionTypeSlotKey,
  isDomainListConditionType,
  validateConditionStructure,
  validateConditionValues,
  validateDomainValues,
  generateUid,
} from '@openheaders/core/utils';
import { Button, Select, Tag, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ConflictDiffChip, EntityField, SetRowConflictChip, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useFieldConflicts } from '@openheaders/ui/shared/conflicts/Field';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import { TemplateInput } from '../template-input';
import {
  DomainIssueBanner,
  StructuralIssueBanner,
  ValueIssueBanner,
  ValueLogicHint,
} from './condition-issue-banners';
import { buildTypeOptions, DOMAIN_TYPES, getTypeDef, HTTP_METHODS, RESOURCE_TYPES } from './condition-types';

// ── Props ────────────────────────────────────────────────────────

interface ConditionEditorProps {
  value?: RuleCondition[];
  onChange?: (conditions: RuleCondition[]) => void;
}

/** Inline conflict chip for one condition leaf — reads local value
 *  directly from the controlled state (ConditionEditor doesn't sit
 *  under a `Form.List`, so we can't subscribe via `Form.useWatch`).
 *  Mounts a `<ConflictDiffChip>` only when a conflict surfaces at the
 *  path. No-op outside a `<ConflictsProvider>`. */
function ConditionLeafConflictChip({
  path,
  localValue,
  onTakeTheirs,
}: {
  path: string;
  localValue: string;
  onTakeTheirs: (theirs: string) => void;
}): React.ReactElement | null {
  const conflicts = useFieldConflicts();
  if (!conflicts) return null;
  const conflict = conflicts.getConflict(path, localValue);
  if (!conflict) return null;
  return (
    <ConflictDiffChip
      theirs={conflict.theirs}
      base={conflict.base}
      local={localValue}
      remote={conflict.remote}
      onTakeTheirs={() => {
        onTakeTheirs(conflict.theirs);
        conflicts.acceptTheirs(path, conflict.theirs);
      }}
      onKeepMine={() => conflicts.dismiss(path)}
    />
  );
}

/** Saved-removed affordance for one condition row. */
function ConditionSetRowChip({
  setPath,
  uid,
  onUseSaved,
}: {
  setPath: string;
  uid: string;
  onUseSaved: () => void;
}): React.ReactElement | null {
  const conflicts = useFieldConflicts();
  if (!conflicts?.getSetConflict) return null;
  const setRemove = conflicts.getSetConflict(setPath, uid, true);
  if (!setRemove || setRemove.kind !== 'set-remove') return null;
  const setKey = `set:${setPath}.${uid}`;
  return (
    <SetRowConflictChip
      baseSummary={setRemove.base}
      remote={setRemove.remote}
      onUseSaved={() => {
        onUseSaved();
        conflicts.acceptTheirs(setKey, '');
      }}
      onKeepMine={() => conflicts.dismiss(setKey)}
    />
  );
}

// ── Component ────────────────────────────────────────────────────

const ConditionEditor: React.FC<ConditionEditorProps> = ({ value = [], onChange }) => {
  const t = useT();
  const paths = useActionPaths();
  const { token } = theme.useToken();

  // Group structural issues by row so each row can render its own banner.
  // Single pass, recomputed only when the condition list changes.
  const structuralIssuesByRow = useMemo(() => {
    const byRow = new Map<number, ConditionStructuralIssue[]>();
    for (const issue of validateConditionStructure(value)) {
      const list = byRow.get(issue.index) ?? [];
      list.push(issue);
      byRow.set(issue.index, list);
    }
    return byRow;
  }, [value]);

  const updateCondition = useCallback(
    (index: number, updates: Partial<RuleCondition>) => {
      const next = value.map((c, i) => (i === index ? { ...c, ...updates } : c));
      onChange?.(next);
    },
    [value, onChange],
  );

  const removeCondition = useCallback(
    (index: number) => {
      onChange?.(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const addCondition = useCallback(() => {
    // Pick the first unclaimed type by `pickerOrder` so adding a
    // second condition lands on a usable, prominent row instead of
    // a disabled-on-arrival default. Header types are always available
    // (their slot includes headerName) so they're valid fallbacks if
    // every non-header slot is taken. Source of truth: the metadata
    // table in `condition-metadata.ts` — not the editor's display
    // ordering.
    const claimed = new Set<string>();
    for (const c of value) {
      const m = CONDITION_META[c.type];
      if (m?.perHeader) continue;
      const k = getConditionTypeSlotKey(c.type);
      if (k) claimed.add(k);
    }
    const candidates = (Object.values(CONDITION_META) as ReadonlyArray<(typeof CONDITION_META)[ConditionType]>)
      .filter((m) => m.supportedByDnr)
      .filter((m) => {
        if (m.perHeader) return true;
        const k = getConditionTypeSlotKey(m.type);
        return k !== null && !claimed.has(k);
      })
      .sort((a, b) => a.pickerOrder - b.pickerOrder);
    const type: ConditionType = candidates[0]?.type ?? 'request-domains';
    const newCondition: RuleCondition = { uid: generateUid(), type, values: [] };
    if (CONDITION_META[type]?.perHeader) newCondition.headerName = '';
    onChange?.([...value, newCondition]);
  }, [value, onChange]);

  const handleTypeChange = useCallback(
    (index: number, type: ConditionType) => {
      const def = getTypeDef(type);
      const current = value[index];
      if (def?.inputType !== 'header') {
        // Strip headerName entirely for non-header types — leaving it
        // as `undefined` would survive the spread as an own property
        // (Object.keys includes undefined-valued keys), and the form's
        // structural fingerprint would then carry `"headerName":undefined`
        // that the post-save canonical doesn't have. That residual diff
        // pinned the editor to a permanent dirty state on type changes.
        const next = value.map((c, i) => {
          if (i !== index) return c;
          const { headerName: _omit, ...rest } = c;
          void _omit;
          return { ...rest, type, values: [] };
        });
        onChange?.(next);
        return;
      }
      const updates: Partial<RuleCondition> = { type, values: [] };
      if (!current.headerName) updates.headerName = '';
      updateCondition(index, updates);
    },
    [value, onChange, updateCondition],
  );

  const handleValuesText = useCallback(
    (index: number, text: string) => {
      const values = text
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter(Boolean);
      updateCondition(index, { values: values.length > 0 ? values : [text] });
    },
    [updateCondition],
  );

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        background: token.colorBgContainer,
      }}
    >
      {value.length === 0 && (
        <div style={{ padding: '12px 16px', color: token.colorTextTertiary, fontSize: 12, textAlign: 'center' }}>
          {t('workbench.editors.rule.condition.empty')}
        </div>
      )}

      {value.map((condition, index) => {
        const def = getTypeDef(condition.type);
        const isExclude = condition.type.startsWith('exclude-');
        // Domain-typed conditions (request/initiator-domains and their
        // exclude variants) get inline validation — Chrome rejects
        // wildcards / ports / schemes / uppercase atomically, which
        // otherwise leaves the user staring at a non-applying rule
        // with zero feedback.
        const domainIssues = validateDomainValues(condition);
        const valueIssues = validateConditionValues(condition);
        const structuralIssues = structuralIssuesByRow.get(index) ?? [];
        // Rows that ship nothing to Chrome (overridden by a later row in
        // the same mutex group, or an unsupported-by-DNR type) get muted
        // visually so the user can see at a glance which rows are dead
        // weight. The banner explains why; the muting reinforces it.
        const isInert = structuralIssues.some(
          (i) => i.kind === 'duplicate-slot' || i.kind === 'mutex-conflict' || i.kind === 'unsupported-by-dnr',
        );

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 10px',
              borderBottom: index < value.length - 1 ? `1px solid ${token.colorBorderSecondary}` : undefined,
              opacity: isInert ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* AND badge — connector between rows. */}
              {index > 0 && (
                <Tooltip title={t('workbench.editors.rule.condition.andTooltip')}>
                  <Tag
                    color="blue"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 1,
                      lineHeight: '18px',
                      margin: 0,
                      padding: '0 4px',
                      flexShrink: 0,
                      cursor: 'help',
                    }}
                  >
                    {t('workbench.editors.rule.condition.andTag')}
                  </Tag>
                </Tooltip>
              )}

              {/* Exclude indicator */}
              {isExclude && (
                <Tooltip title={t('workbench.editors.rule.condition.notTooltip')}>
                  <Tag
                    color="warning"
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      lineHeight: '18px',
                      margin: 0,
                      padding: '0 4px',
                      flexShrink: 0,
                      cursor: 'help',
                    }}
                  >
                    {t('workbench.editors.rule.condition.notTag')}
                  </Tag>
                </Tooltip>
              )}

              {/* Type selector + docs link */}
              <EntityField path={paths.condition(condition.uid, 'type')}>
                <Select
                  size="small"
                  value={condition.type}
                  onChange={(type) => handleTypeChange(index, type)}
                  style={{ width: 160, flexShrink: 0 }}
                  popupMatchSelectWidth={240}
                  options={buildTypeOptions(value, index, t)}
                />
              </EntityField>
              <DocInfo docId={getDocId(condition.type, 'condition')} />

              {/* Header name (before value for header types) */}
              {def?.inputType === 'header' && (
                <EntityField path={paths.condition(condition.uid, 'headerName')}>
                  <TemplateInput
                    size="small"
                    placeholder={t('workbench.editors.rule.condition.headerNamePlaceholder')}
                    wrap
                    maxRows={4}
                    resizable
                    allowClear
                    value={condition.headerName ?? ''}
                    onChange={(next) => updateCondition(index, { headerName: next })}
                    style={{ width: 180, flexShrink: 0 }}
                  />
                </EntityField>
              )}

              {/* Value input — varies by type. All variants wrap with
                  EntityField so the per-condition `values` path publishes
                  presence regardless of input shape. */}
              <EntityField path={paths.condition(condition.uid, 'values')}>
                {def?.inputType === 'multi-select-methods' ? (
                  <Select
                    size="small"
                    mode="multiple"
                    value={condition.values}
                    onChange={(vals) => updateCondition(index, { values: vals })}
                    style={{ flex: 1, minWidth: 0 }}
                    options={HTTP_METHODS.map((v) => ({ value: v, label: v }))}
                    placeholder={t('workbench.editors.rule.condition.selectMethods')}
                    maxTagCount="responsive"
                  />
                ) : def?.inputType === 'multi-select-resources' ? (
                  <Select
                    size="small"
                    mode="multiple"
                    value={condition.values}
                    onChange={(vals) => updateCondition(index, { values: vals })}
                    style={{ flex: 1, minWidth: 0 }}
                    options={RESOURCE_TYPES.map((v) => ({ value: v, label: v }))}
                    placeholder={t('workbench.editors.rule.condition.selectTypes')}
                    maxTagCount="responsive"
                  />
                ) : def?.inputType === 'single-select-domain-type' ? (
                  <Select
                    size="small"
                    value={condition.values[0]}
                    onChange={(val) => updateCondition(index, { values: [val] })}
                    style={{ width: 140, flexShrink: 0 }}
                    options={DOMAIN_TYPES.map((d) => ({ value: d.value, label: t(d.labelKey) }))}
                    placeholder={t('workbench.editors.rule.condition.selectType')}
                  />
                ) : (
                  (() => {
                    const isDomainList = isDomainListConditionType(condition.type);
                    // Both variants share the textarea treatment (wrap to 4
                    // rows, inner scroll, resize grip, clear ✕); domain
                    // lists additionally keep multiline SEMANTICS so pasted
                    // newline-separated domains survive. The 4-row cap now
                    // comes from the component's `maxRows`, not a style
                    // override.
                    return (
                      <TemplateInput
                        size="small"
                        multiline={isDomainList}
                        wrap
                        maxRows={4}
                        resizable
                        allowClear
                        placeholder={def?.placeholder ?? t('workbench.editors.rule.condition.valuePlaceholder')}
                        value={condition.values.join(isDomainList ? ', ' : ', ')}
                        onChange={(next) => handleValuesText(index, next)}
                        style={{ flex: 1, minWidth: 0, ...(isDomainList ? { minHeight: 32 } : null) }}
                      />
                    );
                  })()
                )}
              </EntityField>

              {/* Value-logic hint — explains how multiple values inside this row combine. */}
              <ValueLogicHint type={condition.type} />

              {/* Inline per-row + per-leaf conflict affordances. SetRowChip
                  surfaces "saved version removed this row"; the leaf chips
                  surface peer edits to `type` / `headerName` / `values`. */}
              <ConditionSetRowChip
                setPath="conditions"
                uid={condition.uid}
                onUseSaved={() => removeCondition(index)}
              />
              <ConditionLeafConflictChip
                path={paths.condition(condition.uid, 'type')}
                localValue={String(condition.type)}
                onTakeTheirs={(theirs) =>
                  updateCondition(index, { type: theirs as ConditionType })
                }
              />
              {def?.inputType === 'header' && (
                <ConditionLeafConflictChip
                  path={paths.condition(condition.uid, 'headerName')}
                  localValue={condition.headerName ?? ''}
                  onTakeTheirs={(theirs) => updateCondition(index, { headerName: theirs })}
                />
              )}
              <ConditionLeafConflictChip
                path={paths.condition(condition.uid, 'values')}
                localValue={(condition.values ?? []).join(', ')}
                onTakeTheirs={(theirs) =>
                  updateCondition(index, {
                    values: theirs === '' ? [] : theirs.split(',').map((v) => v.trim()),
                  })
                }
              />

              {/* Delete */}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ fontSize: 10 }} />}
                onClick={() => removeCondition(index)}
                style={{ color: token.colorTextTertiary, flexShrink: 0 }}
              />
            </div>
            {structuralIssues.length > 0 && <StructuralIssueBanner issues={structuralIssues} conditions={value} />}
            {valueIssues.length > 0 && <ValueIssueBanner issues={valueIssues} conditionType={condition.type} />}
            {domainIssues.length > 0 && (
              <DomainIssueBanner
                issues={domainIssues}
                onApplyCleanup={() => updateCondition(index, applyDomainValueCleanup(condition, domainIssues))}
              />
            )}
          </div>
        );
      })}

      {/* Add condition. Empty state: centered under the hint text.
          With rows: a left-aligned footer row below an inset separator. */}
      <div
        style={{
          padding: value.length > 0 ? '6px 10px' : '0 10px 14px',
          borderTop: value.length > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
          textAlign: value.length > 0 ? undefined : 'center',
        }}
      >
        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondition} style={{ fontSize: 12 }}>
          {t('workbench.editors.rule.condition.add')}
        </Button>
      </div>
    </div>
  );
};

export default ConditionEditor;
