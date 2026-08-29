/**
 * SessionResilienceGroup — the session-resilience block the long-lived
 * session editors' Settings tabs render (WebSocket / Socket.IO, MQTT):
 * ONE component for the one policy the session kinds share, so the
 * rows, their order, their bounds and their dots never drift between
 * editors again.
 *
 *   Reconnect automatically · [Reconnect period · Reconnect attempts ·
 *   Exponential backoff] · Idle timeout · Heartbeat message ·
 *   [Heartbeat interval]
 *
 * The reconnect quartet renders everywhere; the liveness rows follow
 * the host's mask (`liveness`): a raw WebSocket session carries the
 * idle deadline and the heartbeat frame, a Socket.IO session the idle
 * deadline alone (engine.io answers its own pings; the deadline
 * defaults to the handshake cadence), MQTT neither (keep-alive is its
 * CONNECT knob). Same contract as the TLS & trust block: the block
 * edits a `ResilienceValue` and hands the WHOLE next value back — the
 * host merges it into its draft (the session drafts keep the two
 * booleans concrete); modified dots track distance from the runtime
 * defaults; the optional `unsaved` set adds the unsaved marker per
 * row. Labels, placeholders and help come from the request-settings
 * catalog; an editor with richer popover copy passes `rowInfo` and
 * falls back to the shared copy for the keys it leaves undefined.
 */

import {
  MAX_HEARTBEAT_MESSAGE_LENGTH,
  MAX_RECONNECT_ATTEMPTS,
  MAX_REQUEST_TIMEOUT_MS,
  MIN_REQUEST_TIMEOUT_MS,
} from '@openheaders/core/schemas';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  countInterpreter,
  durationMsInterpreter,
  formatDurationMs,
  numericPresets,
} from '@openheaders/ui/shared/combo-knob';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { ComboKnobRow, DependentRows, GroupSection, KnobRow, TextKnobRow } from '@openheaders/ui/shared/settings-rows';
import type React from 'react';
import { type ResilienceInfoKey, type ResilienceLiveness, resilienceRowInfo } from './resilience-row-info';

/** The policy slice the block edits — the two switches concrete (the
 *  session drafts' posture: absent on the entity reads as off /
 *  backoff on), the rest `undefined` = the runtime default. */
export interface ResilienceValue {
  autoReconnect: boolean;
  reconnectPeriodMs?: number | undefined;
  reconnectMaxAttempts?: number | undefined;
  reconnectBackoff: boolean;
  idleTimeoutMs?: number | undefined;
  heartbeatMessage?: string | undefined;
  heartbeatIntervalMs?: number | undefined;
}

export const RESILIENCE_KEYS = [
  'autoReconnect',
  'reconnectPeriodMs',
  'reconnectMaxAttempts',
  'reconnectBackoff',
  'idleTimeoutMs',
  'heartbeatMessage',
  'heartbeatIntervalMs',
] as const;

export type ResilienceKey = (typeof RESILIENCE_KEYS)[number];

/** Whether any row sits off its runtime default. */
export function isResilienceModified(value: ResilienceValue): boolean {
  return (
    value.autoReconnect ||
    value.reconnectPeriodMs !== undefined ||
    value.reconnectMaxAttempts !== undefined ||
    !value.reconnectBackoff ||
    value.idleTimeoutMs !== undefined ||
    value.heartbeatMessage !== undefined ||
    value.heartbeatIntervalMs !== undefined
  );
}

/** The waits are app milliseconds on the wire — free text becomes
 *  concrete candidates ("30" → "30 ms" / "30 s"); readings outside the
 *  field's range stay visible as disabled entries naming the bound. */
const interpretDuration = durationMsInterpreter({ min: MIN_REQUEST_TIMEOUT_MS, max: MAX_REQUEST_TIMEOUT_MS });
const RECONNECT_PERIOD_PRESETS = numericPresets([1_000, 2_000, 5_000, 10_000, 30_000], formatDurationMs);
const interpretReconnectMaxAttempts = countInterpreter({ min: 1, max: MAX_RECONNECT_ATTEMPTS });
const RECONNECT_MAX_ATTEMPTS_PRESETS = numericPresets([3, 5, 10, 50], String);
const IDLE_TIMEOUT_PRESETS = numericPresets([15_000, 30_000, 60_000, 120_000, 300_000], formatDurationMs);
const HEARTBEAT_INTERVAL_PRESETS = numericPresets([5_000, 15_000, 30_000, 60_000], formatDurationMs);

export interface SessionResilienceGroupProps {
  groupLabel: string;
  groupInfo: InfoPopoverContent;
  expanded: boolean;
  onToggle: () => void;
  value: ResilienceValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: ResilienceValue) => void;
  /** Which liveness rows render and how the idle deadline defaults. */
  liveness: ResilienceLiveness;
  /** Editor-specific popover copy; `undefined` for a key falls back
   *  to the shared request-settings copy. */
  rowInfo?: (key: ResilienceInfoKey) => InfoPopoverContent | undefined;
  /** Keys whose value differs from the saved baseline; absent = no
   *  such plane. */
  unsaved?: ReadonlySet<string>;
  /** `<prefix>-auto-reconnect`, `<prefix>-reconnect-period`, … */
  testIdPrefix: string;
}

const SessionResilienceGroup: React.FC<SessionResilienceGroupProps> = ({
  groupLabel,
  groupInfo,
  expanded,
  onToggle,
  value,
  onChange,
  liveness,
  rowInfo,
  unsaved,
  testIdPrefix,
}) => {
  const t = useT();
  const info = (key: ResilienceInfoKey): InfoPopoverContent =>
    rowInfo?.(key) ?? resilienceRowInfo(t, key, groupLabel, liveness);
  const isUnsaved = (key: ResilienceKey): boolean => unsaved?.has(key) === true;
  const set = (patch: Partial<ResilienceValue>): void => onChange({ ...value, ...patch });

  return (
    <GroupSection
      label={groupLabel}
      expanded={expanded}
      onToggle={onToggle}
      info={groupInfo}
      modified={isResilienceModified(value)}
      unsaved={RESILIENCE_KEYS.some(isUnsaved)}
    >
      <KnobRow
        label={t('workbench.editors.request.settings.autoReconnect')}
        checked={value.autoReconnect}
        modified={value.autoReconnect}
        unsaved={isUnsaved('autoReconnect')}
        onReset={() => set({ autoReconnect: false })}
        onChange={(autoReconnect) => set({ autoReconnect })}
        info={info('autoReconnect')}
        testId={`${testIdPrefix}-auto-reconnect`}
      />
      <DependentRows>
        <ComboKnobRow
          label={t('workbench.editors.request.settings.reconnectPeriod')}
          value={value.reconnectPeriodMs}
          onChange={(reconnectPeriodMs) => set({ reconnectPeriodMs })}
          info={info('reconnectPeriod')}
          presets={RECONNECT_PERIOD_PRESETS}
          interpret={interpretDuration}
          format={formatDurationMs}
          placeholder={t('workbench.editors.request.settings.reconnectPeriodPlaceholder')}
          disabled={!value.autoReconnect}
          unsaved={isUnsaved('reconnectPeriodMs')}
          testId={`${testIdPrefix}-reconnect-period`}
        />
        <ComboKnobRow
          label={t('workbench.editors.request.settings.reconnectMaxAttempts')}
          value={value.reconnectMaxAttempts}
          onChange={(reconnectMaxAttempts) => set({ reconnectMaxAttempts })}
          info={info('reconnectMaxAttempts')}
          presets={RECONNECT_MAX_ATTEMPTS_PRESETS}
          interpret={interpretReconnectMaxAttempts}
          format={String}
          placeholder={t('workbench.editors.request.settings.reconnectMaxAttemptsPlaceholder')}
          disabled={!value.autoReconnect}
          unsaved={isUnsaved('reconnectMaxAttempts')}
          testId={`${testIdPrefix}-reconnect-max-attempts`}
        />
        <KnobRow
          label={t('workbench.editors.request.settings.reconnectBackoff')}
          checked={value.reconnectBackoff}
          modified={!value.reconnectBackoff}
          unsaved={isUnsaved('reconnectBackoff')}
          onReset={() => set({ reconnectBackoff: true })}
          onChange={(reconnectBackoff) => set({ reconnectBackoff })}
          info={info('reconnectBackoff')}
          disabled={!value.autoReconnect}
          testId={`${testIdPrefix}-reconnect-backoff`}
        />
      </DependentRows>
      {liveness !== 'none' && (
        <ComboKnobRow
          label={t('workbench.editors.request.settings.idleTimeout')}
          value={value.idleTimeoutMs}
          onChange={(idleTimeoutMs) => set({ idleTimeoutMs })}
          info={info('idleTimeout')}
          presets={IDLE_TIMEOUT_PRESETS}
          interpret={interpretDuration}
          format={formatDurationMs}
          placeholder={t(
            liveness === 'socketio'
              ? 'workbench.editors.request.settings.idleTimeoutSocketioPlaceholder'
              : 'workbench.editors.request.settings.idleTimeoutPlaceholder',
          )}
          unsaved={isUnsaved('idleTimeoutMs')}
          testId={`${testIdPrefix}-idle-timeout`}
        />
      )}
      {liveness === 'raw' && (
        <>
          <TextKnobRow
            label={t('workbench.editors.request.settings.heartbeatMessage')}
            value={value.heartbeatMessage}
            onChange={(heartbeatMessage) => set({ heartbeatMessage })}
            info={info('heartbeatMessage')}
            placeholder={t('workbench.editors.request.settings.heartbeatMessagePlaceholder')}
            maxLength={MAX_HEARTBEAT_MESSAGE_LENGTH}
            example={t('workbench.editors.request.settings.heartbeatMessageExample')}
            unsaved={isUnsaved('heartbeatMessage')}
            testId={`${testIdPrefix}-heartbeat-message`}
          />
          <DependentRows>
            <ComboKnobRow
              label={t('workbench.editors.request.settings.heartbeatInterval')}
              value={value.heartbeatIntervalMs}
              onChange={(heartbeatIntervalMs) => set({ heartbeatIntervalMs })}
              info={info('heartbeatInterval')}
              presets={HEARTBEAT_INTERVAL_PRESETS}
              interpret={interpretDuration}
              format={formatDurationMs}
              placeholder={t('workbench.editors.request.settings.heartbeatIntervalPlaceholder')}
              disabled={value.heartbeatMessage === undefined}
              unsaved={isUnsaved('heartbeatIntervalMs')}
              testId={`${testIdPrefix}-heartbeat-interval`}
            />
          </DependentRows>
        </>
      )}
    </GroupSection>
  );
};

export default SessionResilienceGroup;
