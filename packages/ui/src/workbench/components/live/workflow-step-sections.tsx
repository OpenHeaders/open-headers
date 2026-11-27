/**
 * The Collapse section of {@link WorkflowStepEditor} that every step
 * has: Priority.
 * A pure factory rebuilt every render (as the inline array
 * was) so state and handlers stay current — no memoization is required
 * because no renderer closes over a value that must be referentially
 * stable.
 */

import { InfoCircleOutlined } from '@ant-design/icons';
import type { StructuralError } from '@openheaders/core/live';
import type { PriorityRef } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { Button, type CollapseProps, Select, Space, Tooltip } from 'antd';
import type { GlobalToken } from 'antd/es/theme/interface';

export interface SharedStepSectionsOptions {
  token: GlobalToken;
  t: Translate;
  index: number;
  priorityError: StructuralError | undefined;
  priority: PriorityRef | undefined;
  priorityStepOptions: { value: string; label: string }[];
  priorityCaptureOptions: { value: string; label: string }[];
  /** The form is read-only — a control that sets its own `disabled` stays off whatever its own condition says. */
  readOnly: boolean;
  setPriority: (next: PriorityRef | undefined) => void;
}

/** The section every step has, whatever its action. */
export function buildSharedStepSections({
  token,
  t,
  index,
  priorityError,
  priority,
  priorityStepOptions,
  priorityCaptureOptions,
  readOnly,
  setPriority,
}: SharedStepSectionsOptions): NonNullable<CollapseProps['items']> {
  return [
    {
      key: 'priority',
      label: (
        <span style={{ fontSize: 11 }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 0.4, color: token.colorTextSecondary }}>
            {t('workbench.editors.live.sections.priority')}
          </span>
          <span style={{ marginLeft: 6, color: token.colorTextTertiary }}>
            {priority
              ? `(${priority.stepId}.${priority.captureName})`
              : t('workbench.editors.live.sections.none')}
          </span>
        </span>
      ),
      children: (
        <div style={{ padding: '0 0 4px' }} data-testid={`wf-step-${index}-priority`}>
          <Space wrap size={6} style={{ width: '100%' }}>
            <Tooltip
              open={priorityError && priorityError.issue !== 'priority-unknown-capture' ? undefined : false}
              title={priorityError?.message}
            >
              <Select
                size="small"
                placeholder={t('workbench.editors.live.sections.priorityStepPlaceholder')}
                style={{ width: 160 }}
                status={priorityError && priorityError.issue !== 'priority-unknown-capture' ? 'error' : undefined}
                data-testid={`wf-step-${index}-priority-step`}
                value={priority?.stepId}
                options={priorityStepOptions}
                onChange={(stepId) => {
                  setPriority({
                    stepId,
                    captureName: priority?.captureName ?? '',
                    sort: priority?.sort,
                  });
                }}
              />
            </Tooltip>
            <Tooltip
              open={priorityError?.issue === 'priority-unknown-capture' ? undefined : false}
              title={priorityError?.message}
            >
              <Select
                size="small"
                placeholder={t('workbench.editors.live.sections.priorityCapturePlaceholder')}
                style={{ width: 160 }}
                disabled={readOnly || !priority?.stepId}
                status={priorityError?.issue === 'priority-unknown-capture' ? 'error' : undefined}
                data-testid={`wf-step-${index}-priority-capture`}
                value={priority?.captureName}
                options={priorityCaptureOptions}
                onChange={(captureName) => {
                  if (!priority) return;
                  setPriority({ ...priority, captureName });
                }}
              />
            </Tooltip>
            <Select
              size="small"
              style={{ width: 140 }}
              disabled={readOnly || !priority?.stepId}
              data-testid={`wf-step-${index}-priority-sort`}
              value={priority?.sort ?? 'numeric'}
              options={[
                { value: 'numeric', label: t('workbench.editors.live.sections.sortNumeric') },
                { value: 'lexicographic', label: t('workbench.editors.live.sections.sortLexicographic') },
              ]}
              onChange={(sort) => {
                if (!priority) return;
                setPriority({ ...priority, sort });
              }}
            />
            <Tooltip title={t('workbench.editors.live.sections.priorityTooltip')}>
              <InfoCircleOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
            {priority && (
              <Button size="small" type="text" onClick={() => setPriority(undefined)}>
                {t('workbench.editors.live.sections.clear')}
              </Button>
            )}
          </Space>
        </div>
      ),
    },
  ];
}
