/**
 * Mode-switch dialog — Phase U5.5 (posture-aware redesign).
 *
 * Fires when the user changes `backend.mode` and both the source and
 * target hosts have user-authored content. The dialog presents exactly
 * TWO outcome-named cards, selected by the target backend's connection
 * posture (`docs/UNIFIED_ORACLE_MODEL.md` §6 / `UNIFIED_ORACLE_STATUS.md`
 * Phase U5):
 *
 *   - **Trust-by-process** (loopback backend): "Combine" — re-home this
 *     device's workspaces into the target `Org` so they sync both ways
 *     — and "Use the target's data only".
 *   - **Authenticated** (LAN / WAN backend): "Keep my data on this
 *     device" — the join consumes the target's data, nothing of the
 *     joiner's is pushed up — and "Use the target's data only".
 *
 * Cards are outcome-named, never mechanism-named. Pushing data up to an
 * authenticated backend is never a join-time side effect — that is the
 * explicit per-workspace Publish action (U5.6).
 *
 * Pure presentational. The caller (`useBackendModeSwitch`) owns the
 * open flag, the post-choice commit, and the executors; this component
 * just surfaces the decision.
 */

import { ArrowRightOutlined, DeleteOutlined, HddOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { Alert, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { DataPresenceSummary } from '@openheaders/core/sync';
import { BackendIcon, type BackendIconKey } from '../../settings/components/backend-icons';

/** The three outcomes the dialog can resolve to (Phase U5.5). */
export type ModeSwitchChoice = 'combine' | 'keep-local' | 'use-target';

/**
 * Connection posture of the target backend. `trust-by-process` is a
 * loopback backend (same machine, no auth — the desktop app or a
 * loopback daemon); `authenticated` is a token-gated LAN / WAN backend.
 * Drives which two cards the dialog shows.
 */
export type ConnectionPosture = 'trust-by-process' | 'authenticated';

export interface ModeSwitchDialogProps {
  open: boolean;
  /** Display label for the source mode (e.g. "Browser Extension"). */
  fromLabel: string;
  /** Display label for the target mode (e.g. "Desktop Application"). */
  toLabel: string;
  /** Icon glyphs for the source / target panels. */
  fromIcon?: BackendIconKey;
  toIcon?: BackendIconKey;
  source: DataPresenceSummary;
  target: DataPresenceSummary;
  /** Target backend posture — selects the two cards shown. */
  posture: ConnectionPosture;
  /**
   * Whether the target backend reported a home `Org` on its handshake
   * (Phase U5.2). When `false`, the outcomes that re-home into / retire
   * against that `Org` (Combine, Use-Target) can't run — they render
   * disabled and "Keep my data on this device" is offered as the
   * always-safe fallback.
   */
  targetOrgKnown: boolean;
  onChoose: (choice: ModeSwitchChoice) => void;
  onCancel: () => void;
}

interface ActionOption {
  choice: ModeSwitchChoice;
  title: string;
  icon: React.ReactNode;
  /** Builds the card body copy from the host labels. */
  describe: (fromLabel: string, toLabel: string) => string;
  /** True for outcomes that need the target backend's `Org` to run. */
  needsTargetOrg: boolean;
  danger?: boolean;
}

const COMBINE_OPTION: ActionOption = {
  choice: 'combine',
  title: 'Combine into one workspace set',
  icon: <MergeCellsOutlined />,
  describe: (fromLabel, toLabel) =>
    `Your ${fromLabel} workspaces move into ${toLabel} and sync both ways. Nothing is lost.`,
  needsTargetOrg: true,
};

const KEEP_LOCAL_OPTION: ActionOption = {
  choice: 'keep-local',
  title: 'Keep my data on this device',
  icon: <HddOutlined />,
  describe: (fromLabel, toLabel) =>
    `Your ${fromLabel} workspaces stay private to this device. ${toLabel}'s workspaces sync down to you; yours are never pushed up.`,
  needsTargetOrg: false,
};

const USE_TARGET_OPTION: ActionOption = {
  choice: 'use-target',
  title: 'Use the target backend’s data only',
  icon: <DeleteOutlined />,
  describe: (fromLabel, toLabel) =>
    `Your ${fromLabel} workspaces are exported to a local backup file, then removed. You'll work only with ${toLabel}'s data.`,
  needsTargetOrg: true,
  danger: true,
};

/**
 * The two outcome cards for a posture. Trust-by-process offers Combine;
 * authenticated offers Keep-my-data-here. Both offer Use-Target.
 */
function optionsForPosture(posture: ConnectionPosture): readonly ActionOption[] {
  return posture === 'trust-by-process'
    ? [COMBINE_OPTION, USE_TARGET_OPTION]
    : [KEEP_LOCAL_OPTION, USE_TARGET_OPTION];
}

const ModeSwitchDialog: React.FC<ModeSwitchDialogProps> = ({
  open,
  fromLabel,
  toLabel,
  fromIcon,
  toIcon,
  source,
  target,
  posture,
  targetOrgKnown,
  onChoose,
  onCancel,
}) => {
  const { token } = theme.useToken();

  // The two posture cards, plus Keep-my-data-here as an always-safe
  // fallback when the target `Org` is unknown and would otherwise leave
  // no runnable outcome.
  const postureOptions = optionsForPosture(posture);
  const needsFallback = !targetOrgKnown && postureOptions.every((o) => o.needsTargetOrg);
  const options: readonly ActionOption[] = needsFallback
    ? [KEEP_LOCAL_OPTION, ...postureOptions]
    : postureOptions;

  const isDisabled = (opt: ActionOption): boolean => opt.needsTargetOrg && !targetOrgKnown;
  const firstEnabled = options.find((o) => !isDisabled(o)) ?? options[0];

  const [selected, setSelected] = useState<ModeSwitchChoice>(firstEnabled.choice);

  const selectedOption = options.find((o) => o.choice === selected) ?? firstEnabled;
  const applyDisabled = isDisabled(selectedOption);
  const applyDanger = selectedOption.danger === true;

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {`Switching from ${fromLabel} to ${toLabel}`}
        </span>
      }
      onCancel={onCancel}
      onOk={() => onChoose(selected)}
      okText={applyDanger ? 'Apply (with backup)' : 'Apply'}
      okButtonProps={{ danger: applyDanger, disabled: applyDisabled }}
      cancelText="Cancel"
      width={680}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PresenceFlow
          fromLabel={fromLabel}
          toLabel={toLabel}
          fromIcon={fromIcon}
          toIcon={toIcon}
          source={source}
          target={target}
          token={token}
        />
        {!targetOrgKnown && (
          <Alert
            type="warning"
            showIcon
            message={
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {`${toLabel} didn't report a workspace identity.`}
              </span>
            }
            description={
              <span style={{ fontSize: 12 }}>
                Combining or retiring your workspaces needs one. Keep your data on this device for now;
                you can move it later once the backend is online.
              </span>
            }
          />
        )}
        <div
          role="radiogroup"
          aria-label="Mode-switch action"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {options.map((opt) => (
            <ActionCard
              key={opt.choice}
              option={opt}
              description={opt.describe(fromLabel, toLabel)}
              selected={selected === opt.choice}
              disabled={isDisabled(opt)}
              onSelect={() => setSelected(opt.choice)}
              token={token}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

const PresenceFlow: React.FC<{
  fromLabel: string;
  toLabel: string;
  fromIcon?: BackendIconKey;
  toIcon?: BackendIconKey;
  source: DataPresenceSummary;
  target: DataPresenceSummary;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ fromLabel, toLabel, fromIcon, toIcon, source, target, token }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
    <PresenceCard role="source" label={fromLabel} icon={fromIcon} summary={source} token={token} />
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        color: token.colorTextTertiary,
      }}
      aria-hidden="true"
    >
      <ArrowRightOutlined style={{ fontSize: 18 }} />
    </div>
    <PresenceCard role="target" label={toLabel} icon={toIcon} summary={target} token={token} />
  </div>
);

const PresenceCard: React.FC<{
  role: 'source' | 'target';
  label: string;
  icon?: BackendIconKey;
  summary: DataPresenceSummary;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ role, label, icon, summary, token }) => {
  const isSource = role === 'source';
  const accent = isSource ? token.colorWarning : token.colorSuccess;
  const accentBg = isSource ? token.colorWarningBg : token.colorSuccessBg;
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          alignSelf: 'flex-start',
          padding: '1px 8px',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          borderRadius: 999,
          background: accentBg,
          color: accent,
          lineHeight: '14px',
        }}
      >
        {isSource ? 'Source · from' : 'Target · to'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            flex: 'none',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon ? (
            <BackendIcon kind={icon} size={32} />
          ) : (
            <span
              style={{
                width: 32,
                height: 32,
                display: 'block',
                borderRadius: 8,
                background: token.colorFillSecondary,
              }}
              aria-hidden="true"
            />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: token.colorText,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: token.colorText }}>
        {summary.workspaceCount === 0 ? (
          <span style={{ color: token.colorTextTertiary }}>No workspaces</span>
        ) : (
          <PresenceBreakdown summary={summary} />
        )}
      </div>
    </div>
  );
};

const PresenceBreakdown: React.FC<{ summary: DataPresenceSummary }> = ({ summary }) => {
  const totals: Record<string, number> = {};
  for (const ws of summary.workspaces) {
    for (const [type, count] of Object.entries(ws.entityCounts)) {
      totals[type] = (totals[type] ?? 0) + count;
    }
  }
  const parts: string[] = [];
  parts.push(`${summary.workspaceCount} workspace${summary.workspaceCount === 1 ? '' : 's'}`);
  for (const [type, count] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    parts.push(`${count} ${pluralize(type, count)}`);
  }
  return <span>{parts.join(' · ')}</span>;
};

function pluralize(entityType: string, count: number): string {
  if (count === 1) return entityType;
  if (entityType.endsWith('y') && !entityType.endsWith('ay') && !entityType.endsWith('ey')) {
    return `${entityType.slice(0, -1)}ies`;
  }
  if (entityType.endsWith('s')) return entityType;
  return `${entityType}s`;
}

const ActionCard: React.FC<{
  option: ActionOption;
  description: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ option, description, selected, disabled, onSelect, token }) => {
  const borderColor = selected
    ? option.danger
      ? token.colorError
      : token.colorPrimary
    : token.colorBorderSecondary;
  const background = selected
    ? option.danger
      ? token.colorErrorBg
      : token.colorPrimaryBg
    : token.colorBgContainer;
  const iconColor = option.danger ? token.colorError : token.colorPrimary;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        color: token.colorText,
        transition: 'border-color 120ms, background 120ms',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: 'none',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background: selected ? 'transparent' : token.colorFillTertiary,
          color: selected ? iconColor : token.colorTextSecondary,
          fontSize: 16,
          transition: 'color 120ms, background 120ms',
        }}
      >
        {option.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>{option.title}</Typography.Text>
          {option.danger && (
            <span
              style={{
                padding: '0 6px',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                borderRadius: 999,
                background: token.colorErrorBg,
                color: token.colorError,
                lineHeight: '14px',
              }}
            >
              Destructive
            </span>
          )}
        </span>
        <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: token.colorTextSecondary }}>
          {description}
        </span>
      </span>
    </button>
  );
};

export default ModeSwitchDialog;
