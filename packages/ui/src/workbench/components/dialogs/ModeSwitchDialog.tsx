/**
 * Mode-switch dialog — Phase C M2.
 *
 * Fires when the user changes `backend.mode` and both the source and
 * target hosts have user-authored content. Renders the four-option
 * resolution per `docs/DATA_PLANE_TOPOLOGIES.md` §11.2:
 *
 *   - Coexist  (recommended, non-destructive): keep both as separate workspaces.
 *   - Import   (HLC-merged): fold source data into the target.
 *   - Discard  (destructive, always-backup): drop the source after a snapshot.
 *   - Cancel   (no-op).
 *
 * Pure presentational. The caller (BackendPane in M2c) owns the open
 * flag and the post-choice commit; this component just surfaces the
 * decision. Action execution (Coexist namespacing, Import merge,
 * Discard backup) lands in M3-M5 — for now `onChoose` is a typed
 * callback the caller plugs into the eventual handlers.
 */

import { ArrowRightOutlined, DeleteOutlined, ForkOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { Alert, Checkbox, Modal, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import type { DataPresenceSummary, NameCollision } from '@openheaders/core/sync';
import { BackendIcon, type BackendIconKey } from '../../settings/components/backend-icons';

export type ModeSwitchChoice = 'coexist' | 'import' | 'discard';

/**
 * Optional per-choice payload surfaced alongside the user's primary
 * action. M4b uses {@link ModeSwitchChooseOptions.workspaceIdRemap} to
 * thread the dialog's name-collision resolution to the Import executor;
 * Coexist + Discard ignore it for now (Coexist always mints fresh ids,
 * Discard is local-only).
 */
export interface ModeSwitchChooseOptions {
  readonly workspaceIdRemap?: Readonly<Record<string, string>>;
}

export interface ModeSwitchDialogProps {
  open: boolean;
  /** Display label for the source mode (e.g. "In-Browser"). */
  fromLabel: string;
  /** Display label for the target mode (e.g. "Desktop App"). */
  toLabel: string;
  /** Icon glyphs for the source / target panels. Drives the visual
   *  identity of each side so users see at a glance what they're
   *  switching FROM vs TO instead of parsing labels. */
  fromIcon?: BackendIconKey;
  toIcon?: BackendIconKey;
  source: DataPresenceSummary;
  target: DataPresenceSummary;
  /**
   * Source ↔ target workspace pairs whose names collapse to the same
   * canonical form (post-NFC + case-fold). When non-empty the dialog
   * renders a banner ABOVE the action cards with a "Treat these as the
   * same workspace and merge by id" checkbox (default ON). On Import
   * with the checkbox ON, the dialog forwards a `workspaceIdRemap` so
   * the target applier retargets each source's snapshot at the matching
   * target workspace id rather than dropping it as ignored.
   */
  nameCollisions?: readonly NameCollision[];
  onChoose: (choice: ModeSwitchChoice, options?: ModeSwitchChooseOptions) => void;
  onCancel: () => void;
}

interface ActionOption {
  choice: ModeSwitchChoice;
  title: string;
  icon: React.ReactNode;
  helpFrom: (fromLabel: string, toLabel: string) => string;
  recommended?: boolean;
  danger?: boolean;
}

const ACTION_OPTIONS: readonly ActionOption[] = [
  {
    choice: 'coexist',
    title: 'Keep both as separate workspaces',
    icon: <ForkOutlined />,
    helpFrom: (fromLabel, toLabel) =>
      `Your ${fromLabel} data appears on the ${toLabel} side as an additional workspace. The existing ${toLabel} workspaces stay untouched.`,
    recommended: true,
  },
  {
    choice: 'import',
    title: 'Import source data into the target workspace',
    icon: <MergeCellsOutlined />,
    helpFrom: (_fromLabel, toLabel) =>
      `Mutations merge by HLC into the ${toLabel} workspace. Conflicts resolve automatically; you'll see a summary of what landed.`,
  },
  {
    choice: 'discard',
    title: 'Discard source data, use the target',
    icon: <DeleteOutlined />,
    helpFrom: (fromLabel) =>
      `${fromLabel} data is exported to a local backup file first so it can be restored from Settings → Data.`,
    danger: true,
  },
];

const ModeSwitchDialog: React.FC<ModeSwitchDialogProps> = ({
  open,
  fromLabel,
  toLabel,
  fromIcon,
  toIcon,
  source,
  target,
  nameCollisions,
  onChoose,
  onCancel,
}) => {
  const { token } = theme.useToken();
  const collisions = nameCollisions ?? [];
  const [mergeCollisions, setMergeCollisions] = useState<boolean>(true);
  // Default to the recommended action so the user has a sensible
  // commit-on-Enter target. Cards are selectable; nothing applies
  // until the explicit Apply button below.
  const [selected, setSelected] = useState<ModeSwitchChoice>(
    ACTION_OPTIONS.find((o) => o.recommended)?.choice ?? ACTION_OPTIONS[0].choice,
  );

  const handleApply = (): void => {
    if (selected === 'import' && collisions.length > 0 && mergeCollisions) {
      const remap: Record<string, string> = {};
      for (const c of collisions) {
        remap[c.sourceWorkspaceId] = c.targetWorkspaceId;
      }
      onChoose(selected, { workspaceIdRemap: remap });
      return;
    }
    onChoose(selected);
  };

  const selectedOption = ACTION_OPTIONS.find((o) => o.choice === selected) ?? ACTION_OPTIONS[0];
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
      onOk={handleApply}
      okText={applyDanger ? 'Apply (with backup)' : 'Apply'}
      okButtonProps={{ danger: applyDanger }}
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
        {collisions.length > 0 && (
          <NameCollisionBanner
            collisions={collisions}
            fromLabel={fromLabel}
            toLabel={toLabel}
            mergeCollisions={mergeCollisions}
            onToggleMerge={setMergeCollisions}
          />
        )}
        <div
          role="radiogroup"
          aria-label="Mode-switch action"
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {ACTION_OPTIONS.map((opt) => (
            <ActionCard
              key={opt.choice}
              option={opt}
              description={opt.helpFrom(fromLabel, toLabel)}
              selected={selected === opt.choice}
              onSelect={() => setSelected(opt.choice)}
              token={token}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

/**
 * Inline banner that lists each source/target workspace pair whose
 * names match after Unicode canonicalization. Surfaces a checkbox that
 * controls whether Import treats the pairs as the same workspace
 * (M4b cross-id merge) — default ON so users opt OUT of the merge
 * rather than opting in to a destructive cross-id rewrite. When OFF,
 * Import behaves as v1 (same-id only) and the unmatched sources land
 * in the result's `ignored` list.
 */
const NameCollisionBanner: React.FC<{
  collisions: readonly NameCollision[];
  fromLabel: string;
  toLabel: string;
  mergeCollisions: boolean;
  onToggleMerge: (next: boolean) => void;
}> = ({ collisions, fromLabel, toLabel, mergeCollisions, onToggleMerge }) => {
  const headline =
    collisions.length === 1
      ? '1 workspace looks like the same one on both sides.'
      : `${collisions.length} workspaces look like the same ones on both sides.`;
  return (
    <Alert
      type="info"
      showIcon
      message={<span style={{ fontSize: 12, fontWeight: 600 }}>{headline}</span>}
      description={
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {collisions.map((c) => (
              <li key={`${c.sourceWorkspaceId}→${c.targetWorkspaceId}`}>
                <Typography.Text strong>{c.sourceWorkspaceName}</Typography.Text>
                {` (${fromLabel}) ↔ `}
                <Typography.Text strong>{c.targetWorkspaceName}</Typography.Text>
                {` (${toLabel})`}
              </li>
            ))}
          </ul>
          <Checkbox
            checked={mergeCollisions}
            onChange={(e) => onToggleMerge(e.target.checked)}
            style={{ fontSize: 12 }}
          >
            Treat them as the same workspace and merge by edit history when I choose Import
          </Checkbox>
        </div>
      }
    />
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
  onSelect: () => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ option, description, selected, onSelect, token }) => {
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
        cursor: 'pointer',
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
          {option.recommended && (
            <span
              style={{
                padding: '0 6px',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                borderRadius: 999,
                background: token.colorPrimary,
                color: token.colorTextLightSolid,
                lineHeight: '14px',
              }}
            >
              Recommended
            </span>
          )}
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
