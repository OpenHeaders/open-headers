/**
 * ReimportDiffPanel — renders a `diffImportReports(prev, next)`
 * result as an Ant `Alert` with per-partition detail lists. Used by
 * every importer modal (curl, HAR, Postman, future) so the diff UX
 * stays uniform.
 *
 * Surfaces:
 *   • Progress — "X drops resolved since last import."
 *   • Regression — "Y new drops since last import."
 *   • Persistent — folded away under a detail dropdown so the user
 *     can audit but doesn't drown in repeats.
 *
 * Design: unlike the live preview in the curl/HAR modals (which
 * shows the current parse's full drop list), this panel only surfaces
 * entries that CHANGED vs the previous report. If nothing changed,
 * `diff.hasChanges === false` → caller should skip rendering entirely.
 */

import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { ImportReportDiff } from '@openheaders/core/import';
import { Alert, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';

const { Text } = Typography;

interface ReimportDiffPanelProps {
  diff: ImportReportDiff;
}

function relativeAge(previousIso: string): string {
  const then = Date.parse(previousIso);
  if (Number.isNaN(then)) return 'previously';
  const delta = Date.now() - then;
  if (delta < 0) return 'just now';
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

const ReimportDiffPanel: React.FC<ReimportDiffPanelProps> = ({ diff }) => {
  const { token } = theme.useToken();
  const age = relativeAge(diff.previousImportedAt);

  // Decide headline tone. Regression wins over progress — the user
  // needs to see new drops most urgently.
  const added = diff.drops.added.length + diff.transforms.added.length;
  const resolved = diff.drops.resolved.length + diff.transforms.resolved.length;
  const summaryChanged =
    diff.summaryDelta.imported !== 0 || diff.summaryDelta.dropped !== 0 || diff.summaryDelta.transformed !== 0;

  const headline =
    added > 0
      ? `${added} new issue${added === 1 ? '' : 's'} since last import`
      : resolved > 0
        ? `${resolved} previously-unsupported entr${resolved === 1 ? 'y is' : 'ies are'} now handled`
        : summaryChanged
          ? 'Counts changed since last import'
          : 'Minor changes vs last import';

  const tone: 'warning' | 'success' | 'info' = added > 0 ? 'warning' : resolved > 0 ? 'success' : 'info';
  const Icon = added > 0 ? WarningOutlined : resolved > 0 ? CheckCircleOutlined : ArrowUpOutlined;

  return (
    <Alert
      type={tone}
      showIcon
      icon={<Icon />}
      style={{ marginBottom: 12 }}
      message={
        <Space size={8} wrap>
          <Text strong style={{ fontSize: 12 }}>
            {headline}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            (previously imported {age})
          </Text>
        </Space>
      }
      description={
        <div style={{ fontSize: 12 }}>
          <SummaryDeltaRow diff={diff} />
          {diff.drops.added.length > 0 && (
            <DetailList
              heading={`New drops (${diff.drops.added.length})`}
              tone="regression"
              items={diff.drops.added.map((d) => ({ path: d.path, detail: d.reason }))}
              token={token}
            />
          )}
          {diff.drops.resolved.length > 0 && (
            <DetailList
              heading={`Drops resolved (${diff.drops.resolved.length})`}
              tone="progress"
              items={diff.drops.resolved.map((d) => ({ path: d.path, detail: d.reason }))}
              token={token}
            />
          )}
          {diff.transforms.added.length > 0 && (
            <DetailList
              heading={`New transforms (${diff.transforms.added.length})`}
              tone="neutral"
              items={diff.transforms.added.map((t) => ({
                path: t.path,
                detail: `${t.from} → ${t.to}: ${t.reason}`,
              }))}
              token={token}
            />
          )}
          {diff.transforms.resolved.length > 0 && (
            <DetailList
              heading={`Transforms no longer needed (${diff.transforms.resolved.length})`}
              tone="progress"
              items={diff.transforms.resolved.map((t) => ({
                path: t.path,
                detail: `${t.from} → ${t.to}: ${t.reason}`,
              }))}
              token={token}
            />
          )}
        </div>
      }
    />
  );
};

// ── Summary delta row ──────────────────────────────────────────────

const SummaryDeltaRow: React.FC<{ diff: ImportReportDiff }> = ({ diff }) => {
  const parts: Array<{ label: string; delta: number }> = [
    { label: 'imported', delta: diff.summaryDelta.imported },
    { label: 'dropped', delta: diff.summaryDelta.dropped },
    { label: 'transformed', delta: diff.summaryDelta.transformed },
  ].filter((p) => p.delta !== 0);
  if (parts.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
      {parts.map((p) => (
        <Tag key={p.label}>
          {p.label}: {p.delta > 0 ? '+' : ''}
          {p.delta}{' '}
          {p.delta > 0 ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
        </Tag>
      ))}
    </div>
  );
};

// ── Detail list ────────────────────────────────────────────────────

interface DetailListProps {
  heading: string;
  tone: 'regression' | 'progress' | 'neutral';
  items: Array<{ path: string; detail: string }>;
  token: ReturnType<typeof theme.useToken>['token'];
}

const DetailList: React.FC<DetailListProps> = ({ heading, tone, items, token }) => {
  const color =
    tone === 'regression' ? token.colorWarning : tone === 'progress' ? token.colorSuccess : token.colorPrimary;
  return (
    <div style={{ marginTop: 4 }}>
      <Text strong style={{ color, fontSize: 11, letterSpacing: 0.3 }}>
        {heading.toUpperCase()}
      </Text>
      <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
        {items.map((it, i) => (
          <li key={i}>
            <strong>{it.path}:</strong>{' '}
            <span style={{ color: token.colorTextSecondary, fontSize: 11 }}>{it.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReimportDiffPanel;
