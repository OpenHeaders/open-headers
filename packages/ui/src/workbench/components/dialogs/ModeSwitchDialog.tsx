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

import { Modal, Typography, theme } from 'antd';
import type React from 'react';
import type { DataPresenceSummary } from '@openheaders/core/sync';

export type ModeSwitchChoice = 'coexist' | 'import' | 'discard';

export interface ModeSwitchDialogProps {
  open: boolean;
  /** Display label for the source mode (e.g. "In-Browser"). */
  fromLabel: string;
  /** Display label for the target mode (e.g. "Desktop App"). */
  toLabel: string;
  source: DataPresenceSummary;
  target: DataPresenceSummary;
  onChoose: (choice: ModeSwitchChoice) => void;
  onCancel: () => void;
}

const ACTION_OPTIONS: ReadonlyArray<{
  choice: ModeSwitchChoice;
  title: string;
  helpFrom: (fromLabel: string, toLabel: string) => string;
  recommended?: boolean;
}> = [
  {
    choice: 'coexist',
    title: 'Keep both as separate workspaces',
    helpFrom: (fromLabel, toLabel) =>
      `Your ${fromLabel} data appears on the ${toLabel} side as an additional workspace. The existing ${toLabel} workspaces stay untouched.`,
    recommended: true,
  },
  {
    choice: 'import',
    title: 'Import source data into the target workspace',
    helpFrom: (_fromLabel, toLabel) =>
      `Mutations merge by HLC into the ${toLabel} workspace. Conflicts resolve automatically; you'll see a summary of what landed.`,
  },
  {
    choice: 'discard',
    title: 'Discard source data, use the target',
    helpFrom: (fromLabel) =>
      `${fromLabel} data is exported to a local backup file first so it can be restored from Settings → Data.`,
  },
];

const ModeSwitchDialog: React.FC<ModeSwitchDialogProps> = ({
  open,
  fromLabel,
  toLabel,
  source,
  target,
  onChoose,
  onCancel,
}) => {
  const { token } = theme.useToken();
  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {`Switching from ${fromLabel} to ${toLabel}`}
        </span>
      }
      onCancel={onCancel}
      footer={null}
      width={620}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PresenceColumns
          fromLabel={fromLabel}
          toLabel={toLabel}
          source={source}
          target={target}
          token={token}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACTION_OPTIONS.map((opt) => (
            <ActionCard
              key={opt.choice}
              choice={opt.choice}
              title={opt.title}
              description={opt.helpFrom(fromLabel, toLabel)}
              recommended={opt.recommended === true}
              onChoose={onChoose}
              token={token}
            />
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                fontSize: 12,
                padding: '4px 12px',
                background: 'transparent',
                color: token.colorTextSecondary,
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const PresenceColumns: React.FC<{
  fromLabel: string;
  toLabel: string;
  source: DataPresenceSummary;
  target: DataPresenceSummary;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ fromLabel, toLabel, source, target, token }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    <PresenceColumn label={fromLabel} summary={source} token={token} />
    <PresenceColumn label={toLabel} summary={target} token={token} />
  </div>
);

const PresenceColumn: React.FC<{
  label: string;
  summary: DataPresenceSummary;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ label, summary, token }) => (
  <div
    style={{
      flex: 1,
      padding: 10,
      background: token.colorFillTertiary,
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: 8,
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: token.colorTextSecondary }}>
      {label}
    </div>
    <div style={{ marginTop: 6, fontSize: 12, color: token.colorText }}>
      {summary.workspaceCount === 0 ? (
        <span style={{ color: token.colorTextTertiary }}>No workspaces</span>
      ) : (
        <PresenceBreakdown summary={summary} />
      )}
    </div>
  </div>
);

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
  choice: ModeSwitchChoice;
  title: string;
  description: string;
  recommended: boolean;
  onChoose: (choice: ModeSwitchChoice) => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ choice, title, description, recommended, onChoose, token }) => (
  <button
    type="button"
    onClick={() => onChoose(choice)}
    style={{
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '10px 12px',
      background: recommended ? token.colorPrimaryBg : token.colorBgContainer,
      border: `1px solid ${recommended ? token.colorPrimary : token.colorBorderSecondary}`,
      borderRadius: 8,
      cursor: 'pointer',
      fontFamily: 'inherit',
      color: token.colorText,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography.Text>
      {recommended && (
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
    </div>
    <div style={{ marginTop: 4, fontSize: 12, color: token.colorTextSecondary }}>{description}</div>
  </button>
);

export default ModeSwitchDialog;
