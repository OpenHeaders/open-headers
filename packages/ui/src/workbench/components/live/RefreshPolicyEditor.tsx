/**
 * RefreshPolicyEditor — when a workflow runs, as the fields of its
 * Settings card (the workflows redesign, Workflow panel): by hand only,
 * or on a schedule; and under a schedule its kind — a fixed interval, or
 * ahead of an expiry a step captured — with that kind's own fields.
 *
 * The expiry kinds pick their source from the workflow's steps and
 * captures, so the user picks a real capture rather than typing a step
 * id and a capture name.
 */

import { MIN_REFRESH_INTERVAL_SECONDS } from '@openheaders/core/schemas';
import type { RefreshPolicy } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ComboKnob, durationMsInterpreter, formatDurationMs, numericPresets } from '@openheaders/ui/shared/combo-knob';
import { InputNumber, Select } from 'antd';
import type React from 'react';
import { CardField } from './WorkflowCard';

/** Interval knob domain — the ComboKnob speaks milliseconds (shared
 *  duration labels: "30 s" / "5 min" / "1 h"), the policy stores whole
 *  seconds. Bounds mirror the schema floor (30 s alarm clamp) and the
 *  editor's long-standing 24 h cap; clearing returns to the 5-minute
 *  default `defaultPolicyFor` mints. */
const MAX_REFRESH_INTERVAL_SECONDS = 86_400;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 300;
const interpretInterval = durationMsInterpreter({
  min: MIN_REFRESH_INTERVAL_SECONDS * 1_000,
  max: MAX_REFRESH_INTERVAL_SECONDS * 1_000,
});
const INTERVAL_PRESETS = numericPresets(
  [30_000, 60_000, 300_000, 900_000, 3_600_000, 86_400_000],
  formatDurationMs,
);

type RunsChoice = 'manual' | 'scheduled';
type ScheduleKind = Exclude<RefreshPolicy['kind'], 'manual'>;

/**
 * The kinds of schedule. `expires-in` and `expires-at` look similar but
 * drive different math — one reads a RELATIVE duration (seconds until
 * expiry, like OAuth's `expires_in`), the other reads an ABSOLUTE
 * timestamp (epoch milliseconds, like a JWT `exp` claim). Labels make the
 * distinction explicit so users pick correctly; the line under the fields
 * reiterates with an example.
 */
const SCHEDULE_OPTIONS: { value: ScheduleKind; labelKey: MessageKey }[] = [
  { value: 'interval', labelKey: 'workbench.editors.live.refreshPolicy.interval' },
  { value: 'expires-in', labelKey: 'workbench.editors.live.refreshPolicy.expiresIn' },
  { value: 'expires-at', labelKey: 'workbench.editors.live.refreshPolicy.expiresAt' },
];

interface CaptureTarget {
  stepId: string;
  captureName: string;
  label: string;
}

interface Props {
  value: RefreshPolicy;
  onChange: (next: RefreshPolicy) => void;
  availableCaptures: CaptureTarget[];
  disabled?: boolean;
}

export function defaultPolicyFor(kind: RefreshPolicy['kind'], captures: CaptureTarget[]): RefreshPolicy {
  switch (kind) {
    case 'interval':
      return { kind: 'interval', seconds: DEFAULT_REFRESH_INTERVAL_SECONDS };
    case 'expires-in':
      return {
        kind: 'expires-in',
        stepId: captures[0]?.stepId ?? '',
        captureName: captures[0]?.captureName ?? '',
        leadSeconds: 30,
      };
    case 'expires-at':
      return {
        kind: 'expires-at',
        stepId: captures[0]?.stepId ?? '',
        captureName: captures[0]?.captureName ?? '',
        leadSeconds: 30,
      };
    case 'manual':
      return { kind: 'manual' };
  }
}

const RefreshPolicyEditor: React.FC<Props> = ({ value, onChange, availableCaptures, disabled }) => {
  const t = useT();
  const runsLabel = t('workbench.editors.live.form.runsSection');
  const scheduleLabel = t('workbench.editors.live.refreshPolicy.schedule');
  const captureLabel = t('workbench.editors.live.priority.capture');
  const leadLabel = t('workbench.editors.live.refreshPolicy.lead');

  return (
    <>
      <div className="oh-wf-field-grid">
        <CardField label={runsLabel}>
          <Select
            disabled={disabled}
            data-testid="wf-settings-runs"
            aria-label={runsLabel}
            value={value.kind === 'manual' ? 'manual' : 'scheduled'}
            options={[
              { value: 'manual', label: t('workbench.editors.live.refreshPolicy.manual') },
              { value: 'scheduled', label: t('workbench.editors.live.refreshPolicy.scheduled') },
            ]}
            onChange={(runs: RunsChoice) =>
              onChange(defaultPolicyFor(runs === 'manual' ? 'manual' : 'interval', availableCaptures))
            }
          />
        </CardField>
        {value.kind !== 'manual' && (
          <CardField label={scheduleLabel}>
            <Select
              disabled={disabled}
              data-testid="wf-settings-schedule"
              aria-label={scheduleLabel}
              value={value.kind}
              options={SCHEDULE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              onChange={(kind: ScheduleKind) => onChange(defaultPolicyFor(kind, availableCaptures))}
            />
          </CardField>
        )}
        {value.kind === 'interval' && (
          <CardField label={t('workbench.editors.live.refreshPolicy.every')}>
            <ComboKnob
              disabled={disabled}
              value={value.seconds * 1_000}
              onChange={(ms) =>
                onChange({
                  kind: 'interval',
                  seconds:
                    ms === undefined
                      ? DEFAULT_REFRESH_INTERVAL_SECONDS
                      : Math.max(MIN_REFRESH_INTERVAL_SECONDS, Math.round(ms / 1_000)),
                })
              }
              presets={INTERVAL_PRESETS}
              interpret={interpretInterval}
              format={formatDurationMs}
              placeholder={formatDurationMs(DEFAULT_REFRESH_INTERVAL_SECONDS * 1_000)}
              ariaLabel={t('workbench.editors.live.refreshPolicy.interval')}
              style={{ width: '100%' }}
            />
          </CardField>
        )}
        {(value.kind === 'expires-in' || value.kind === 'expires-at') && (
          <>
            <CardField label={captureLabel}>
              <Select
                disabled={disabled}
                placeholder={t('workbench.editors.live.refreshPolicy.selectCapture')}
                data-testid="wf-settings-capture"
                aria-label={captureLabel}
                value={value.stepId && value.captureName ? `${value.stepId}::${value.captureName}` : undefined}
                options={availableCaptures.map((c) => ({
                  value: `${c.stepId}::${c.captureName}`,
                  label: c.label,
                }))}
                onChange={(key: string) => {
                  const [stepId, captureName] = key.split('::');
                  onChange({ kind: value.kind, stepId, captureName, leadSeconds: value.leadSeconds });
                }}
                notFoundContent={
                  <span className="oh-wf-quiet">{t('workbench.editors.live.refreshPolicy.noCaptures')}</span>
                }
              />
            </CardField>
            <CardField label={leadLabel}>
              <InputNumber
                disabled={disabled}
                min={0}
                data-testid="wf-settings-lead"
                aria-label={leadLabel}
                value={value.leadSeconds}
                onChange={(lead) =>
                  onChange({
                    kind: value.kind,
                    stepId: value.stepId,
                    captureName: value.captureName,
                    leadSeconds: typeof lead === 'number' ? Math.max(0, lead) : 0,
                  })
                }
              />
            </CardField>
          </>
        )}
      </div>
      {value.kind === 'interval' && value.seconds < 60 && (
        <div className="oh-wf-row-line" style={{ color: 'var(--oh-wf-blocked)' }}>
          {t('workbench.editors.live.refreshPolicy.subMinuteWarning')}
        </div>
      )}
      {value.kind === 'expires-in' && (
        <div className="oh-wf-row-line oh-wf-quiet">
          {t('workbench.editors.live.refreshPolicy.expiresInHelpPrefix')}{' '}
          <code className="oh-wf-code">{'{"expires_in": 3600}'}</code>
          {t('workbench.editors.live.refreshPolicy.expiresInHelpMid')}{' '}
          <code className="oh-wf-code">run_time + captured_seconds</code>
          {t('workbench.editors.live.refreshPolicy.expiresInHelpSuffix')}
        </div>
      )}
      {value.kind === 'expires-at' && (
        <div className="oh-wf-row-line oh-wf-quiet">
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpPrefix')}{' '}
          <strong>{t('workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds')}</strong>{' '}
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpMid')}{' '}
          <code className="oh-wf-code">1745312000000</code>
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpSuffix')}
        </div>
      )}
      {(value.kind === 'expires-in' || value.kind === 'expires-at') && availableCaptures.length === 0 && (
        <div className="oh-wf-row-line" style={{ color: 'var(--oh-wf-blocked)' }}>
          {t('workbench.editors.live.refreshPolicy.noCapturesWarning')}
        </div>
      )}
    </>
  );
};

export default RefreshPolicyEditor;
