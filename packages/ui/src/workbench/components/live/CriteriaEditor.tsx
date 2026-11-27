/**
 * CriteriaEditor — the rows a response or a message is held to (the
 * workflow runs plan, The model), as a card of a step's panel (the
 * workflows redesign, Step panel): a table of what a row reads, what it
 * reads it by, how it compares, and what it expects. A row is a status
 * match, or an extractor with a comparison — exists, equals a value,
 * matches a pattern. Every row must hold. A message has no status, so
 * its rows offer none.
 *
 * Pure controlled component — owns no state. An empty list is the
 * owner's "no criteria" state; `emptyText` says what that means there.
 * A row whose pattern does not compile, or whose value reads a step it
 * cannot, is marked from `errors`, which name their row by its uid.
 */

import { CloseOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import type { Criterion } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import ExtractorEditor, { defaultExtractorFor, type ExtractorSubjectKind } from './ExtractorEditor';
import { StatusMatchControls } from './StepGateEditor';
import WorkflowCard from './WorkflowCard';

// Regex format example shown in the pattern placeholder — raw by design.
const CRITERION_PATTERN_EXAMPLE = '^reboot';

const KIND_OPTIONS: { value: Criterion['kind']; labelKey: MessageKey }[] = [
  { value: 'status', labelKey: 'workbench.editors.live.gate.kindStatus' },
  { value: 'exists', labelKey: 'workbench.editors.live.criteria.kindExists' },
  { value: 'equals', labelKey: 'workbench.editors.live.criteria.kindEquals' },
  { value: 'matches', labelKey: 'workbench.editors.live.criteria.kindMatches' },
];

/** The row a press on Add starts as: a status for a response, the first comparison for a message, which has none. */
function seedCriterion(subject: ExtractorSubjectKind): Criterion {
  const uid = generateUid();
  return subject === 'response'
    ? { kind: 'status', uid, match: '2xx' }
    : { kind: 'exists', uid, extractor: defaultExtractorFor('json-path') };
}

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
  title: string;
  /** One line under the title. */
  description?: string;
  value: readonly Criterion[];
  onChange: (next: Criterion[]) => void;
  /** What an empty list means where this editor sits. */
  emptyText: string;
  /** The step's errors that name a row. */
  errors?: readonly StructuralError[];
  /** Prefix of the rows' test ids. */
  testId: string;
  /** The card's own test id. */
  cardTestId?: string;
  /** What the rows are held against. Absent = a call's response; a message has no status row. */
  subject?: ExtractorSubjectKind;
  /** A note at the card's foot — what the last run made of the rows together. */
  footer?: React.ReactNode;
}

const CriteriaEditor: React.FC<CriteriaEditorProps> = ({
  title,
  description,
  value,
  onChange,
  emptyText,
  errors = [],
  testId,
  cardTestId,
  subject = 'response',
  footer,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const kindOptions =
    subject === 'response' ? KIND_OPTIONS : KIND_OPTIONS.filter((option) => option.value !== 'status');

  const update = (index: number, next: Criterion) => onChange(value.map((each, i) => (i === index ? next : each)));

  return (
    <WorkflowCard
      testId={cardTestId}
      title={title}
      description={description}
      extra={
        <Button onClick={() => onChange([...value, seedCriterion(subject)])} data-testid={`${testId}-add`}>
          {t('workbench.editors.live.criteria.add')}
        </Button>
      }
      footer={footer}
    >
      {value.length === 0 ? (
        <div className="oh-wf-card-note">{emptyText}</div>
      ) : (
        <div className="oh-wf-card-columns oh-wf-criteria-grid">
          <span>{t('workbench.editors.live.criteria.colSource')}</span>
          <span>{t('workbench.editors.live.criteria.colPath')}</span>
          <span>{t('workbench.editors.live.criteria.colOperator')}</span>
          <span>{t('workbench.editors.live.gate.colExpected')}</span>
        </div>
      )}
      {value.map((criterion, index) => {
        const rowError = errors.find((error) => error.referencedCriterionUid === criterion.uid);
        return (
          <div key={criterion.uid} className="oh-wf-card-row oh-wf-criteria-grid" data-testid={`${testId}-${index}`}>
            {criterion.kind === 'status' ? (
              // A status row reads the response's status code, by nothing.
              <>
                <span className="oh-wf-quiet">{t('workbench.editors.live.extractor.statusCode')}</span>
                <span />
              </>
            ) : (
              <ExtractorEditor
                cells
                subject={subject}
                value={criterion.extractor}
                onChange={(extractor) => update(index, { ...criterion, extractor })}
              />
            )}
            <Select
              style={{ minWidth: 0 }}
              data-testid={`${testId}-${index}-kind`}
              value={criterion.kind}
              options={kindOptions.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              onChange={(kind) => update(index, withKind(criterion, kind))}
            />
            <div className="oh-wf-cell-controls">
              {criterion.kind === 'status' && (
                <StatusMatchControls
                  match={criterion.match}
                  onChange={(match) => update(index, { ...criterion, match })}
                />
              )}
              {criterion.kind === 'equals' && (
                <Tooltip open={rowError ? undefined : false} title={rowError?.message}>
                  <Input
                    className="oh-wf-code"
                    style={{ flex: '1 1 72px', minWidth: 0 }}
                    placeholder={t('workbench.editors.live.gate.equalsPlaceholder')}
                    status={rowError ? 'error' : undefined}
                    data-testid={`${testId}-${index}-value`}
                    value={criterion.value}
                    onChange={(e) => update(index, { ...criterion, value: e.target.value })}
                  />
                </Tooltip>
              )}
              {criterion.kind === 'matches' && (
                <Tooltip open={rowError ? undefined : false} title={rowError?.message}>
                  <Input
                    className="oh-wf-code"
                    style={{ flex: '1 1 72px', minWidth: 0 }}
                    placeholder={CRITERION_PATTERN_EXAMPLE}
                    status={rowError ? 'error' : undefined}
                    data-testid={`${testId}-${index}-pattern`}
                    value={criterion.pattern}
                    onChange={(e) => update(index, { ...criterion, pattern: e.target.value })}
                  />
                </Tooltip>
              )}
            </div>
            <Button
              className="oh-wf-row-remove"
              type="text"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              style={{ color: token.colorTextTertiary }}
              aria-label={t('workbench.editors.live.criteria.removeAria', { number: index + 1 })}
            />
          </div>
        );
      })}
    </WorkflowCard>
  );
};

export default CriteriaEditor;
