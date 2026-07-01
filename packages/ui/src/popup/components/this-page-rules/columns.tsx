import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { getCapability } from '@openheaders/core/capabilities';
import { type PauseMarkers, resolvePauseState } from '@openheaders/core/utils';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { VERDICT_COLOR, VERDICT_LABEL, VERDICT_TOOLTIP } from '@openheaders/ui/shared/verdict';
import type { WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { App, Button, Popconfirm, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type { Dispatch, SetStateAction } from 'react';
import {
  renderActionDetails,
  renderTagOverflow,
  type TagDescriptor,
  truncateValue,
} from '../columns/sharedColumnRenderers';
import { RESOURCE_TYPE_LABEL, RESOURCE_TYPE_TOOLTIP, RULE_TYPE_DESCRIPTION, RULE_TYPE_LABEL } from './format';
import type { ActiveRule, TableRecord } from './types';

const { Text } = Typography;

/** Antd `message` API handed down from the popup's `App.useApp()` context. */
type ThisPageMessageApi = ReturnType<typeof App.useApp>['message'];

export interface ThisPageRulesColumnsOptions {
  sortedInfo: SorterResult<TableRecord>;
  filteredInfo: Record<string, FilterValue | null>;
  dataSource: TableRecord[];
  pauseMarkers: PauseMarkers;
  shadowDetection: boolean;
  ruleMutator: UseRuleMutatorApi;
  message: ThisPageMessageApi;
  setActiveRules: Dispatch<SetStateAction<ActiveRule[]>>;
  openRulesIntent: (intent: WorkspaceIntent) => void;
}

/**
 * Builds the This Page rules table columns. Rebuilt every render (as the
 * inline array was) so sort/filter state and the mutation handlers stay
 * current — no memoization is required because no cell renderer closes
 * over a value that must be referentially stable.
 */
export function buildThisPageRulesColumns({
  sortedInfo,
  filteredInfo,
  dataSource,
  pauseMarkers,
  shadowDetection,
  ruleMutator,
  message,
  setActiveRules,
  openRulesIntent,
}: ThisPageRulesColumnsOptions): ColumnsType<TableRecord> {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 170,
      fixed: 'left',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      filters: [...new Set(dataSource.map((item) => item.name))].map((name) => ({ text: name, value: name })),
      filteredValue: filteredInfo.name || null,
      filterSearch: true,
      onFilter: (value, record) => record.name === value,
      render: (text: string, record: TableRecord) => {
        const displayName = truncateValue(text, 20);
        const count = record.fireCount;
        const isEnabled = record.isEnabled !== false;
        const groupPaused = resolvePauseState(record.path ?? '', pauseMarkers);
        const outOfPlay = !isEnabled || groupPaused;
        const shadowed = shadowDetection && record.shadowedCount > 0;

        // Tag states:
        //   disabled/paused       → gray "–"       rule is not in play
        //   count === 0           → gray "0"       no activity yet
        //   shadow flag on + hit  → amber "⚠ N"   higher-priority rule wins
        //   otherwise             → blue filled N  rule has fired on this page
        //
        // The evidence tier (confirmed vs matched vs matched-fallback) is
        // intentionally not encoded as a separate glyph here — most users
        // don't want to reason about Chrome's DNR vs in-page injection.
        // The distinction lives in the tooltip and in the Evidence column
        // of the expand panel.
        const countTooltip = (() => {
          if (outOfPlay) {
            return !isEnabled ? 'Rule is disabled' : 'Rule is paused by its collection or folder';
          }
          if (count === 0) {
            // Zero only happens for `page` / `related` verdicts — `firing`
            // and `silent` always have records. Explain precisely why
            // there's nothing to show so users aren't told "reload the
            // page" when the page isn't the problem.
            const verdict = record.verdict ?? 'page';
            if (verdict === 'related') {
              return 'Rule targets a related domain — no requests to that domain have been observed yet. It will fire if the page makes one.';
            }
            return 'Pattern matches this page but no matching requests have been observed yet. Interact with the page or reload to trigger them.';
          }
          if (shadowed && record.dominantShadow) {
            const allShadowed = record.shadowedCount === record.records.length;
            const prefix = allShadowed
              ? `All ${record.shadowedCount} matched request${record.shadowedCount !== 1 ? 's' : ''}`
              : `${record.shadowedCount} of ${record.records.length} matched requests`;
            return `${prefix} are terminated by "${record.dominantShadow.name}" (higher-priority block rule) — so this rule has no visible effect on them. Experimental: shadow detection may over- or under-report. Disable in settings to hide.`;
          }
          switch (record.dominantEvidence) {
            case 'confirmed':
              return `Script confirmed ${count} fire${count !== 1 ? 's' : ''} on this page (ground truth from in-page injection).`;
            case 'matched-fallback':
              return `Matched ${count} request${count !== 1 ? 's' : ''} via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the injection, or the resource type (stylesheet, image, manifest link) bypassing fetch/XHR interception.`;
            case 'silent':
              return `Pattern matched ${count} cached subresource${count !== 1 ? 's' : ''} — the action couldn't run because the response bypassed the network. Reload bypassing cache to force a fresh request.`;
            default:
              return `Matched ${count} request${count !== 1 ? 's' : ''} on this page. Chrome's declarativeNetRequest doesn't report which rule wins when several match — we observe URL matches, not arbitration outcomes.`;
          }
        })();
        // When the rule has only silent matches (cached subresources),
        // render the count in gold instead of blue to keep the "no
        // action ran" semantic visible at a glance. The verdict chip
        // beside it already says "SILENT," but the count color
        // reinforces it without requiring the user to read the chip.
        const silentOnly = record.dominantEvidence === 'silent';
        const tagLabel = outOfPlay ? '–' : shadowed ? `⚠ ${count}` : String(count);
        const tagColor = outOfPlay
          ? 'default'
          : shadowed
            ? 'warning'
            : count > 0
              ? silentOnly
                ? 'gold'
                : 'blue'
              : 'default';
        const tagVariant = !outOfPlay && count > 0 ? 'filled' : 'outlined';
        // Verdict chip — rendered only when the rule is not firing and
        // not out-of-play. "Firing" is already conveyed by the blue
        // count tag below; layering a second "Firing" chip would be noise.
        const verdict = record.verdict ?? 'page';
        const showVerdictChip = !outOfPlay && verdict !== 'firing';
        const verdictTooltip = record.verdictReason || VERDICT_TOOLTIP[verdict];
        return (
          <Space size={4} align="center">
            <Tooltip title={text.length > 20 ? text : undefined}>
              <Text strong style={{ fontSize: '13px' }}>
                {displayName}
              </Text>
            </Tooltip>
            <Tooltip title={countTooltip}>
              <Tag
                variant={tagVariant}
                color={tagColor}
                style={{
                  margin: 0,
                  fontSize: 10,
                  padding: '0 6px',
                  lineHeight: '16px',
                  minWidth: 20,
                  textAlign: 'center',
                  opacity: outOfPlay || count === 0 ? 0.5 : 1,
                }}
              >
                {tagLabel}
              </Tag>
            </Tooltip>
            {showVerdictChip && (
              <Tooltip title={verdictTooltip}>
                <Tag
                  color={VERDICT_COLOR[verdict]}
                  style={{
                    margin: 0,
                    fontSize: 9,
                    padding: '0 5px',
                    lineHeight: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                  }}
                >
                  {VERDICT_LABEL[verdict]}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Details',
      key: 'details',
      width: 240,
      render: (_: unknown, record: TableRecord) =>
        renderActionDetails(
          {
            ruleType: record.ruleType,
            direction: record.actionDirection as 'request' | 'response' | undefined,
            operation: record.actionOperation,
            label: record.actionLabel || '',
            value: record.actionValue || '',
            tooltip: record.actionTooltip || record.summary,
            items: record.actionItems,
          },
          1,
          24,
          record.isEnabled !== false,
        ),
    },
    {
      title: 'Match',
      key: 'match',
      width: 110,
      align: 'center',
      sorter: (a, b) => {
        // Sort by rule type label — the Match column's dominant tag. Two rules
        // of the same type with different resource-type histories end up
        // adjacent, which matches how users scan for "all my header rules".
        const labelA = RULE_TYPE_LABEL[a.ruleType] ?? a.ruleType;
        const labelB = RULE_TYPE_LABEL[b.ruleType] ?? b.ruleType;
        return labelA.localeCompare(labelB);
      },
      sortOrder: sortedInfo.columnKey === 'match' ? sortedInfo.order : null,
      filters: [
        ...new Set([
          'Paused',
          ...Object.values(RESOURCE_TYPE_LABEL),
          ...dataSource.map((item) => RULE_TYPE_LABEL[item.ruleType] ?? item.ruleType),
        ]),
      ].map((label) => ({ text: label, value: label })),
      filteredValue: filteredInfo.match || null,
      filterSearch: true,
      onFilter: (value, record) => {
        const resourceLabels = [
          ...new Set(record.records.map((m) => RESOURCE_TYPE_LABEL[m.resourceType || 'other'] ?? 'Other')),
        ];
        const labels = [
          ...resourceLabels,
          ...(resolvePauseState(record.path ?? '', pauseMarkers) ? ['Paused'] : []),
          RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
        ];
        return labels.includes(value as string);
      },
      render: (_: unknown, record: TableRecord) => {
        const allTags: TagDescriptor[] = [];
        if (resolvePauseState(record.path ?? '', pauseMarkers)) {
          allTags.push({
            label: 'Paused',
            color: 'default',
            tooltip: 'Collection or folder is paused — rule not applied',
          });
        }
        // Derive unique resource type tags from telemetry records.
        const seenTypes = new Set<string>();
        for (const m of record.records) {
          seenTypes.add(m.resourceType || 'other');
        }
        const typeOrder = [
          'main_frame',
          'sub_frame',
          'xmlhttprequest',
          'script',
          'stylesheet',
          'image',
          'font',
          'media',
          'websocket',
          'ping',
          'other',
        ];
        for (const rt of typeOrder) {
          if (seenTypes.has(rt)) {
            allTags.push({
              label: RESOURCE_TYPE_LABEL[rt] ?? rt,
              tooltip: RESOURCE_TYPE_TOOLTIP[rt] ?? rt,
            });
          }
        }
        allTags.push({
          label: RULE_TYPE_LABEL[record.ruleType] ?? record.ruleType,
          tooltip: RULE_TYPE_DESCRIPTION[record.ruleType] ?? record.ruleType,
        });
        const resourceLabelValues = new Set(Object.values(RESOURCE_TYPE_LABEL));
        const hasStatusTag = allTags[0]?.label === 'Paused' || resourceLabelValues.has(allTags[0]?.label);
        return renderTagOverflow(allTags, hasStatusTag ? 1 : 2);
      },
    },
    {
      title: '',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 50,
      align: 'center',
      fixed: 'right',
      sorter: (a, b) => Number(b.isEnabled !== false) - Number(a.isEnabled !== false),
      sortOrder: sortedInfo.columnKey === 'isEnabled' ? sortedInfo.order : null,
      render: (enabled: unknown, record: TableRecord) => {
        const isEnabled = enabled !== false;
        return (
          <Switch
            checked={isEnabled}
            onChange={() => {
              setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
              void ruleMutator.toggleRule(record.id, !isEnabled).then((resp) => {
                if (resp.ok) {
                  void getCapability('notifyRulesChanged')?.().catch(() => undefined);
                } else {
                  setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
                  void message.error('Failed to toggle rule');
                }
              });
            }}
            size="small"
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'center',
      fixed: 'right',
      render: (_: unknown, record: TableRecord) => {
        return (
          <Space size={2}>
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => openRulesIntent({ kind: 'edit-rule', uid: record.id })}
            />
            <Popconfirm
              title="Delete rule"
              description={`Delete "${record.name}"?`}
              onConfirm={() => {
                setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
                void ruleMutator.deleteRule(record.id).then((resp) => {
                  if (resp.ok) {
                    void message.success('Rule deleted');
                  } else {
                    void message.error('Failed to delete rule');
                  }
                });
              }}
              okText="Delete"
              okType="danger"
              cancelText="Cancel"
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];
}
