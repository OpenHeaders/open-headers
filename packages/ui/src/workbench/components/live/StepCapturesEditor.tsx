/**
 * StepCapturesEditor — the Captures card of a step's panel (the
 * workflows redesign, Step panel): a table of what each capture is
 * named, what it reads and what it reads it by, and the steps that use
 * it. A call's rows read its response and may each carry an exposure
 * line under them; a send's and an expect's read a message. Under a row,
 * the value the capture last held — masked until the card's eye is
 * pressed, since a capture can hold a token.
 *
 * Controlled but for the eye. Generic over the row so a call keeps its
 * draft captures and a session step its plain ones.
 */

import { CloseOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import type { Capture } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import ExtractorEditor, { type ExtractorSubjectKind } from './ExtractorEditor';
import { maskValue } from './live-display';
import WorkflowCard from './WorkflowCard';

interface StepCapturesEditorProps<C extends Capture> {
  /** The step's place in the workflow — the rows' field path. */
  index: number;
  captures: C[];
  onChange: (next: C[]) => void;
  /** The row a press on "Add capture" adds, under the name it is handed. */
  newCapture: (name: string) => C;
  /** What the extractors read. Absent = a call's response. */
  subject?: ExtractorSubjectKind;
  /** A row's exposure controls, on a line under it. */
  renderExposure?: (capture: C, rowIndex: number, update: (next: C) => void) => React.ReactNode;
  /** The steps that read a capture, by its name. */
  readersOf: (captureName: string) => readonly string[];
  /** The values the captures last held, by name. */
  lastValues: Readonly<Record<string, string>>;
}

function StepCapturesEditor<C extends Capture>({
  index,
  captures,
  onChange,
  newCapture,
  subject,
  renderExposure,
  readersOf,
  lastValues,
}: StepCapturesEditorProps<C>) {
  const { token } = theme.useToken();
  const t = useT();
  // Masked by default — a capture can hold an access token. One eye for the card.
  const [reveal, setReveal] = useState(false);
  const hasValues = captures.some((capture) => lastValues[capture.name] !== undefined);
  const revealLabel = t('workbench.editors.live.captures.reveal');

  const update = (rowIndex: number, next: C) => onChange(captures.map((each, i) => (i === rowIndex ? next : each)));

  return (
    <WorkflowCard
      testId={`wf-step-${index}-captures`}
      fieldPath={LIVE_WORKFLOW_FIELD.step(index, 'captures')}
      title={t('workbench.editors.live.captures.title')}
      description={t('workbench.editors.live.captures.description')}
      extra={
        <>
          {hasValues && (
            <Tooltip title={revealLabel}>
              {/* It edits nothing, so it is told by its own `disabled`, never a read-only form's. */}
              <Button
                type="text"
                disabled={false}
                data-testid={`wf-step-${index}-captures-reveal`}
                aria-label={revealLabel}
                aria-pressed={reveal}
                icon={reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setReveal((shown) => !shown)}
              />
            </Tooltip>
          )}
          <Button onClick={() => onChange([...captures, newCapture(`capture${captures.length + 1}`)])}>
            {t('workbench.editors.live.step.addCapture')}
          </Button>
        </>
      }
    >
      {captures.length === 0 ? (
        <div className="oh-wf-card-note">{t('workbench.editors.live.captures.none')}</div>
      ) : (
        <div className="oh-wf-card-columns oh-wf-captures-grid">
          <span>{t('workbench.editors.live.captures.colName')}</span>
          <span>{t('workbench.editors.live.criteria.colSource')}</span>
          <span>{t('workbench.editors.live.criteria.colPath')}</span>
          <span>{t('workbench.editors.live.captures.colUsedBy')}</span>
        </div>
      )}
      {captures.map((capture, rowIndex) => {
        const readers = readersOf(capture.name);
        const lastValue = lastValues[capture.name];
        return (
          <div
            // Key on the row's place alone — not its name. The name is the
            // editable field: keying on it remounts the row on every
            // keystroke and steals focus from the name input mid-type.
            // The list is short and is not reordered.
            key={rowIndex}
            className="oh-wf-card-row oh-wf-captures-grid"
            data-testid={`wf-step-${index}-capture-${rowIndex}`}
          >
            <Input
              className="oh-wf-code oh-wf-capture-name"
              style={{ minWidth: 0 }}
              data-testid={`wf-step-${index}-capture-${rowIndex}-name`}
              aria-label={t('workbench.editors.live.captures.colName')}
              value={capture.name}
              onChange={(e) => update(rowIndex, { ...capture, name: e.target.value })}
            />
            <ExtractorEditor
              cells
              subject={subject}
              value={capture.extractor}
              onChange={(extractor) => update(rowIndex, { ...capture, extractor })}
            />
            <span
              className="oh-wf-quiet oh-wf-capture-readers"
              data-testid={`wf-step-${index}-capture-${rowIndex}-used-by`}
              title={readers.join(', ')}
            >
              {readers.length > 0 ? readers.join(', ') : '—'}
            </span>
            <Button
              className="oh-wf-row-remove"
              type="text"
              icon={<CloseOutlined style={{ fontSize: 10 }} />}
              onClick={() => onChange(captures.filter((_, i) => i !== rowIndex))}
              style={{ color: token.colorTextTertiary }}
              aria-label={t('workbench.editors.live.step.removeCaptureAria', { name: capture.name || rowIndex + 1 })}
            />
            {renderExposure !== undefined && (
              <div className="oh-wf-row-line">
                {renderExposure(capture, rowIndex, (next) => update(rowIndex, next))}
              </div>
            )}
            {lastValue !== undefined && (
              <div className="oh-wf-row-line oh-wf-quiet" data-testid={`wf-step-${index}-capture-${rowIndex}-last`}>
                {t('workbench.editors.live.captures.lastValue')}{' '}
                <span className="oh-wf-code oh-wf-capture-value">{reveal ? lastValue : maskValue(lastValue, t)}</span>
              </div>
            )}
          </div>
        );
      })}
    </WorkflowCard>
  );
}

export default StepCapturesEditor;
