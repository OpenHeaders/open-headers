/**
 * StepCapturesEditor — the capture rows of a step's card: a name and an
 * extractor each. A call's rows read its response and may each carry an
 * exposure row under them; a send's and an expect's read a message.
 *
 * Pure controlled component — owns no state. Generic over the row so a
 * call keeps its draft captures and a session step its plain ones.
 */

import { DeleteOutlined } from '@ant-design/icons';
import type { Capture } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { LIVE_WORKFLOW_FIELD } from '@openheaders/ui/shared/awareness/live-paths';
import { Button, Input, Typography, theme } from 'antd';
import type React from 'react';
import ExtractorEditor, { type ExtractorSubjectKind } from './ExtractorEditor';

const { Text } = Typography;

interface StepCapturesEditorProps<C extends Capture> {
  /** The step's place in the workflow — the rows' field path. */
  index: number;
  captures: C[];
  onChange: (next: C[]) => void;
  /** The row a press on "+ Capture" adds, under the name it is handed. */
  newCapture: (name: string) => C;
  /** What the extractors read. Absent = a call's response. */
  subject?: ExtractorSubjectKind;
  /** Said under the header while the step has no capture. */
  emptyText?: string;
  /** A row's exposure controls, under its name and extractor. */
  renderExposure?: (capture: C, rowIndex: number, update: (next: C) => void) => React.ReactNode;
}

function StepCapturesEditor<C extends Capture>({
  index,
  captures,
  onChange,
  newCapture,
  subject,
  emptyText,
  renderExposure,
}: StepCapturesEditorProps<C>) {
  const { token } = theme.useToken();
  const t = useT();

  const update = (rowIndex: number, next: C) => onChange(captures.map((each, i) => (i === rowIndex ? next : each)));

  return (
    <div data-field-path={LIVE_WORKFLOW_FIELD.step(index, 'captures')}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.step.capturesHeader', { count: captures.length })}
        </Text>
        <Button size="small" onClick={() => onChange([...captures, newCapture(`capture${captures.length + 1}`)])}>
          {t('workbench.editors.live.step.addCapture')}
        </Button>
      </div>
      {captures.length === 0 && emptyText !== undefined && (
        <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>
          {emptyText}
        </Text>
      )}
      {captures.map((capture, rowIndex) => (
        <div
          // Key on the row's place alone — not its name. The name is the
          // editable field: keying on it remounts the row on every
          // keystroke and steals focus from the name input mid-type.
          // The list is short and is not reordered.
          key={rowIndex}
          data-testid={`wf-step-${index}-capture-${rowIndex}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            border: `1px dashed ${token.colorBorderSecondary}`,
            borderRadius: 4,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              size="small"
              style={{ width: 160, flexShrink: 0 }}
              prefix={<Text type="secondary">{t('workbench.editors.live.step.namePrefix')}</Text>}
              data-testid={`wf-step-${index}-capture-${rowIndex}-name`}
              value={capture.name}
              onChange={(e) => update(rowIndex, { ...capture, name: e.target.value })}
            />
            <ExtractorEditor
              compact
              subject={subject}
              value={capture.extractor}
              onChange={(extractor) => update(rowIndex, { ...capture, extractor })}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange(captures.filter((_, i) => i !== rowIndex))}
              aria-label={t('workbench.editors.live.step.removeCaptureAria', { name: capture.name || rowIndex + 1 })}
            />
          </div>
          {renderExposure?.(capture, rowIndex, (next) => update(rowIndex, next))}
        </div>
      ))}
    </div>
  );
}

export default StepCapturesEditor;
