/**
 * CriteriaEditor — the rows a response is held to (the workflow runs
 * plan, The model): a status match, or an extractor with a comparison —
 * exists, equals a value, matches a pattern. Every row must hold.
 *
 * Pure controlled component — owns no state. An empty list is the
 * owner's "no criteria" state; `emptyText` says what that means there.
 * A row whose pattern does not compile is marked from `errors`, which
 * name their row by its uid.
 */

import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import type { Criterion } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import ExtractorEditor, { defaultExtractorFor } from './ExtractorEditor';
import { StatusMatchControls } from './StepGateEditor';

// Regex format example shown in the pattern placeholder — raw by design.
const CRITERION_PATTERN_EXAMPLE = '^reboot';

const KIND_OPTIONS: { value: Criterion['kind']; labelKey: MessageKey }[] = [
  { value: 'status', labelKey: 'workbench.editors.live.gate.kindStatus' },
  { value: 'exists', labelKey: 'workbench.editors.live.criteria.kindExists' },
  { value: 'equals', labelKey: 'workbench.editors.live.criteria.kindEquals' },
  { value: 'matches', labelKey: 'workbench.editors.live.criteria.kindMatches' },
];

/** The same row under another comparison: its extractor is kept where both have one. */
function withKind(criterion: Criterion, kind: Criterion['kind']): Criterion {
  const uid = criterion.uid;
  if (kind === 'status') return { kind, uid, match: '2xx' };
  const extractor = criterion.kind === 'status' ? defaultExtractorFor('json-path') : criterion.extractor;
  if (kind === 'exists') return { kind, uid, extractor };
  if (kind === 'equals') return { kind, uid, extractor, value: criterion.kind === 'equals' ? criterion.value : '' };
  return { kind, uid, extractor, pattern: criterion.kind === 'matches' ? criterion.pattern : '' };
}

interface CriteriaEditorProps {
  value: readonly Criterion[];
  onChange: (next: Criterion[]) => void;
  /** What an empty list means where this editor sits. */
  emptyText: string;
  /** The step's `criterion-invalid-regex` errors. */
  errors?: readonly StructuralError[];
  /** Prefix of the rows' test ids. */
  testId: string;
}

const CriteriaEditor: React.FC<CriteriaEditorProps> = ({ value, onChange, emptyText, errors = [], testId }) => {
  const { token } = theme.useToken();
  const t = useT();

  const update = (index: number, next: Criterion) => onChange(value.map((each, i) => (i === index ? next : each)));

  return (
    <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: 6, background: token.colorBgContainer }}>
      {value.length === 0 && (
        <div style={{ padding: '6px 10px', fontSize: 11, color: token.colorTextTertiary }}>{emptyText}</div>
      )}
      {value.map((criterion, index) => {
        const patternError = errors.find((error) => error.referencedCriterionUid === criterion.uid);
        return (
          <div
            key={criterion.uid}
            data-testid={`${testId}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              padding: '8px 10px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Select
              size="small"
              style={{ width: 110, flexShrink: 0 }}
              data-testid={`${testId}-${index}-kind`}
              value={criterion.kind}
              options={KIND_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              onChange={(kind) => update(index, withKind(criterion, kind))}
            />
            {criterion.kind === 'status' ? (
              <StatusMatchControls match={criterion.match} onChange={(match) => update(index, { ...criterion, match })} />
            ) : (
              <ExtractorEditor
                compact
                value={criterion.extractor}
                onChange={(extractor) => update(index, { ...criterion, extractor })}
              />
            )}
            {criterion.kind === 'equals' && (
              <Input
                size="small"
                style={{ flex: 1, minWidth: 120 }}
                placeholder={t('workbench.editors.live.gate.equalsPlaceholder')}
                data-testid={`${testId}-${index}-value`}
                value={criterion.value}
                onChange={(e) => update(index, { ...criterion, value: e.target.value })}
              />
            )}
            {criterion.kind === 'matches' && (
              <Tooltip open={patternError ? undefined : false} title={patternError?.message}>
                <Input
                  size="small"
                  style={{ flex: 1, minWidth: 120, fontFamily: 'monospace' }}
                  placeholder={CRITERION_PATTERN_EXAMPLE}
                  status={patternError ? 'error' : undefined}
                  data-testid={`${testId}-${index}-pattern`}
                  value={criterion.pattern}
                  onChange={(e) => update(index, { ...criterion, pattern: e.target.value })}
                />
              </Tooltip>
            )}
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              style={{ color: token.colorTextTertiary, flexShrink: 0, marginInlineStart: 'auto' }}
              aria-label={t('workbench.editors.live.criteria.removeAria', { number: index + 1 })}
            />
          </div>
        );
      })}
      <div style={{ padding: '6px 10px' }}>
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onChange([...value, { kind: 'status', uid: generateUid(), match: '2xx' }])}
          style={{ fontSize: 12 }}
          data-testid={`${testId}-add`}
        >
          {t('workbench.editors.live.criteria.add')}
        </Button>
      </div>
    </div>
  );
};

export default CriteriaEditor;
