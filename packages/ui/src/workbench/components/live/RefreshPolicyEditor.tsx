/**
 * RefreshPolicyEditor — inline picker for a workflow's refresh cadence.
 *
 * Supports all four RefreshPolicy kinds. `expires-in` / `expires-at`
 * dropdowns resolve against the workflow's steps + captures so the user
 * picks a real source rather than typing stepId/captureName strings.
 */

import type { RefreshPolicy } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InputNumber, Select, Space, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

/**
 * User-facing refresh-policy kinds. `expires-in` and `expires-at` look
 * similar but drive different math — one reads a RELATIVE duration
 * (seconds until expiry, like OAuth's `expires_in`), the other reads
 * an ABSOLUTE timestamp (epoch milliseconds, like a JWT `exp` claim).
 * Labels make the distinction explicit so users pick correctly; the
 * trailing helper text under the row reiterates with an example.
 */
const KIND_OPTIONS: { value: RefreshPolicy['kind']; labelKey: MessageKey }[] = [
  { value: 'manual', labelKey: 'workbench.editors.live.refreshPolicy.manual' },
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
      return { kind: 'interval', seconds: 300 };
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
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <Space wrap size={6}>
        <Select
          size="small"
          disabled={disabled}
          style={{ width: 220 }}
          value={value.kind}
          options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(kind) => onChange(defaultPolicyFor(kind as RefreshPolicy['kind'], availableCaptures))}
        />
        {value.kind === 'interval' && (
          <InputNumber
            size="small"
            disabled={disabled}
            min={30}
            max={86400}
            step={30}
            addonAfter={t('workbench.editors.live.refreshPolicy.secondsUnit')}
            value={value.seconds}
            onChange={(seconds) =>
              onChange({
                kind: 'interval',
                seconds: typeof seconds === 'number' ? Math.max(30, seconds) : 30,
              })
            }
            style={{ width: 180 }}
          />
        )}
        {(value.kind === 'expires-in' || value.kind === 'expires-at') && (
          <>
            <Select
              size="small"
              disabled={disabled}
              placeholder={t('workbench.editors.live.refreshPolicy.selectCapture')}
              style={{ width: 260 }}
              value={value.stepId && value.captureName ? `${value.stepId}::${value.captureName}` : undefined}
              options={availableCaptures.map((c) => ({
                value: `${c.stepId}::${c.captureName}`,
                label: c.label,
              }))}
              onChange={(key) => {
                const [stepId, captureName] = (key as string).split('::');
                if (value.kind === 'expires-in') {
                  onChange({ kind: 'expires-in', stepId, captureName, leadSeconds: value.leadSeconds });
                } else {
                  onChange({ kind: 'expires-at', stepId, captureName, leadSeconds: value.leadSeconds });
                }
              }}
              notFoundContent={<Text type="secondary">{t('workbench.editors.live.refreshPolicy.noCaptures')}</Text>}
            />
            <InputNumber
              size="small"
              disabled={disabled}
              min={0}
              addonAfter={t('workbench.editors.live.refreshPolicy.leadUnit')}
              value={value.leadSeconds}
              onChange={(lead) => {
                const leadSeconds = typeof lead === 'number' ? Math.max(0, lead) : 0;
                if (value.kind === 'expires-in') {
                  onChange({ kind: 'expires-in', stepId: value.stepId, captureName: value.captureName, leadSeconds });
                } else {
                  onChange({ kind: 'expires-at', stepId: value.stepId, captureName: value.captureName, leadSeconds });
                }
              }}
              style={{ width: 140 }}
            />
          </>
        )}
      </Space>
      {value.kind === 'interval' && value.seconds < 60 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.refreshPolicy.subMinuteWarning')}
        </Text>
      )}
      {value.kind === 'expires-in' && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.refreshPolicy.expiresInHelpPrefix')}{' '}
          <code style={{ fontSize: 10 }}>{'{"expires_in": 3600}'}</code>
          {t('workbench.editors.live.refreshPolicy.expiresInHelpMid')}{' '}
          <code style={{ fontSize: 10 }}>run_time + captured_seconds</code>
          {t('workbench.editors.live.refreshPolicy.expiresInHelpSuffix')}
        </Text>
      )}
      {value.kind === 'expires-at' && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpPrefix')}{' '}
          <strong>{t('workbench.editors.live.refreshPolicy.expiresAtHelpMilliseconds')}</strong>{' '}
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpMid')}{' '}
          <code style={{ fontSize: 10 }}>1745312000000</code>
          {t('workbench.editors.live.refreshPolicy.expiresAtHelpSuffix')}
        </Text>
      )}
      {(value.kind === 'expires-in' || value.kind === 'expires-at') && availableCaptures.length === 0 && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {t('workbench.editors.live.refreshPolicy.noCapturesWarning')}
        </Text>
      )}
    </Space>
  );
};

export default RefreshPolicyEditor;
