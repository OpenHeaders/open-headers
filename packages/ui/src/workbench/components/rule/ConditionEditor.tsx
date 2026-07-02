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

import { CloseOutlined, PlusOutlined, WarningFilled } from '@ant-design/icons';
import type { ConditionType, RuleCondition } from '@openheaders/core/types';
import {
  applyDomainValueCleanup,
  CONDITION_META,
  type ConditionStructuralIssue,
  type ConditionValueIssue,
  type DomainValueIssue,
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
import { ConflictDiffChip, EntityField, SetRowConflictChip, useActionPaths } from '@openheaders/ui/shared/awareness';
import { useFieldConflicts } from '@openheaders/ui/shared/conflicts/Field';
import { getDocId } from '../docs/doc-ids';
import DocInfo from '../shared/DocInfo';
import { TemplateInput } from '../template-input';
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
          No conditions — rule will not match any requests
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
                <Tooltip title="Rows combine with AND — every row must match for the rule to fire. Each row targets a different DNR field, so AND across rows is exact. To OR multiple values within one field, list them inside one row (see the row's OR badge).">
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
                    AND
                  </Tag>
                </Tooltip>
              )}

              {/* Exclude indicator */}
              {isExclude && (
                <Tooltip title="This is an exclusion condition — the rule fires only when NONE of the listed values match.">
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
                    NOT
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
                  options={buildTypeOptions(value, index)}
                />
              </EntityField>
              <DocInfo docId={getDocId(condition.type, 'condition')} />

              {/* Header name (before value for header types) */}
              {def?.inputType === 'header' && (
                <EntityField path={paths.condition(condition.uid, 'headerName')}>
                  <TemplateInput
                    size="small"
                    placeholder="Header name equals..."
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
                    placeholder="Select methods"
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
                    placeholder="Select types"
                    maxTagCount="responsive"
                  />
                ) : def?.inputType === 'single-select-domain-type' ? (
                  <Select
                    size="small"
                    value={condition.values[0]}
                    onChange={(val) => updateCondition(index, { values: [val] })}
                    style={{ width: 140, flexShrink: 0 }}
                    options={DOMAIN_TYPES}
                    placeholder="Select type"
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
                        placeholder={def?.placeholder ?? 'value'}
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
            {structuralIssues.length > 0 && <StructuralIssueBanner issues={structuralIssues} />}
            {valueIssues.length > 0 && <ValueIssueBanner issues={valueIssues} />}
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
          Add condition
        </Button>
      </div>
    </div>
  );
};

/**
 * Tiny inline badge that tells the user how multiple values inside ONE
 * row combine. Together with the "AND" tag between rows, this makes the
 * full logic visible without a docs trip:
 *
 *   - `or`     → `OR`     "values in this row match any (OR)"
 *   - `single` → `1 value` "this condition takes one value; comma-separating won't help"
 *
 * Drawn from `CONDITION_META.valueLogic` — no editor-side hardcoding.
 */
const ValueLogicHint: React.FC<{ type: ConditionType }> = ({ type }) => {
  const { token } = theme.useToken();
  const meta = CONDITION_META[type];
  if (!meta) return null;
  const label = meta.valueLogic === 'or' ? 'OR' : '1 value';
  const tooltip =
    meta.valueLogic === 'or'
      ? 'Multiple values in this row match if ANY value matches (OR). Rows below combine with AND.'
      : 'This condition takes a single value — comma-separating has no effect. Rows below combine with AND.';
  return (
    <Tooltip title={tooltip}>
      <Tag
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1,
          lineHeight: '18px',
          margin: 0,
          padding: '0 4px',
          flexShrink: 0,
          background: token.colorFillTertiary,
          border: `1px solid ${token.colorBorderSecondary}`,
          color: token.colorTextSecondary,
          cursor: 'help',
        }}
      >
        {label}
      </Tag>
    </Tooltip>
  );
};

/**
 * Banner for per-input value validation issues. Renders error-severity
 * issues with the danger palette (Chrome will reject the rule) and
 * warning-severity issues with the warning palette (rule loads but
 * probably doesn't do what the user intended). When both severities are
 * present in one row we render both blocks so the user sees the full
 * picture without color-coding hiding warnings behind errors.
 */
const ValueIssueBanner: React.FC<{ issues: readonly ConditionValueIssue[] }> = ({ issues }) => {
  const { token } = theme.useToken();
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return (
    <>
      {errors.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            marginLeft: 26,
            background: token.colorErrorBg,
            border: `1px solid ${token.colorErrorBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorErrorText,
          }}
        >
          <WarningFilled style={{ color: token.colorError, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {dedupeMessages(errors).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '6px 8px',
            marginLeft: 26,
            background: token.colorWarningBg,
            border: `1px solid ${token.colorWarningBorder}`,
            borderRadius: 4,
            fontSize: 11,
            lineHeight: 1.4,
            color: token.colorWarningText,
          }}
        >
          <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {dedupeMessages(warnings).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

function dedupeMessages(issues: readonly ConditionValueIssue[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    out.push(issue.message);
  }
  return out;
}

interface StructuralIssueBannerProps {
  issues: readonly ConditionStructuralIssue[];
}

const StructuralIssueBanner: React.FC<StructuralIssueBannerProps> = ({ issues }) => {
  const { token } = theme.useToken();
  // Dedupe identical messages — a row can only carry one mutex-conflict
  // and one duplicate-slot at a time, but unsupported-by-dnr can
  // stack with a future kind, so the dedupe keeps the banner readable.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    lines.push(issue.message);
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        marginLeft: 26,
        background: token.colorWarningBg,
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.4,
        color: token.colorWarningText,
      }}
    >
      <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
};

interface DomainIssueBannerProps {
  issues: readonly DomainValueIssue[];
  onApplyCleanup: () => void;
}

const DomainIssueBanner: React.FC<DomainIssueBannerProps> = ({ issues, onApplyCleanup }) => {
  const { token } = theme.useToken();
  // Group consecutive same-kind messages so the banner doesn't
  // repeat the same advice five times for five entries with the same
  // mistake (common when bulk-pasting a domain list).
  const summary = summarizeIssues(issues);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        marginLeft: 26, // align under the type+input columns
        background: token.colorWarningBg,
        border: `1px solid ${token.colorWarningBorder}`,
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.4,
        color: token.colorWarningText,
      }}
    >
      <WarningFilled style={{ color: token.colorWarning, fontSize: 12, marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {summary.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        {summary.affectedRaw.length > 0 && (
          <Tooltip title={summary.affectedRaw.join(', ')}>
            <span style={{ color: token.colorTextTertiary, cursor: 'help' }}>
              {summary.affectedRaw.length} affected entr{summary.affectedRaw.length === 1 ? 'y' : 'ies'}
            </span>
          </Tooltip>
        )}
      </div>
      {summary.fixable && (
        <Button
          size="small"
          type="link"
          onClick={onApplyCleanup}
          style={{ padding: '0 4px', height: 22, fontSize: 11 }}
        >
          Clean up
        </Button>
      )}
    </div>
  );
};

interface IssueSummary {
  lines: string[];
  affectedRaw: string[];
  fixable: boolean;
}

function summarizeIssues(issues: readonly DomainValueIssue[]): IssueSummary {
  const seenMessages = new Set<string>();
  const lines: string[] = [];
  const affected: string[] = [];
  let fixable = false;
  for (const issue of issues) {
    if (!seenMessages.has(issue.message)) {
      seenMessages.add(issue.message);
      lines.push(issue.message);
    }
    affected.push(issue.raw);
    // `non-ascii` requires manual punycode encoding — no auto-fix.
    if (issue.kind !== 'non-ascii') fixable = true;
  }
  return { lines, affectedRaw: affected, fixable };
}

export default ConditionEditor;
