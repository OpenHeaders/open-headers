import { CheckOutlined, CopyTwoTone } from '@ant-design/icons';
import { Badge, Table, Tooltip, Typography } from 'antd';
import type React from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { RESOURCE_TYPE_LABEL } from './format';
import { buildMatchedRequestColumns } from './matched-columns';
import type { CurrentTabInfo, MatchedRequestRow, TableRecord } from './types';

const { Text } = Typography;

/** Imperative handle exposed by the nested virtual table for keyboard scroll. */
type NestedTableRef = {
  nativeElement: HTMLDivElement;
  scrollTo: (config: { index?: number; key?: React.Key; top?: number }) => void;
};

interface MatchedRequestsPanelProps {
  record: TableRecord;
  expandedRowKey: string | number | null;
  searchText: string;
  urlMatchCountMap: Map<string, number>;
  currentTab: CurrentTabInfo | null;
  setNestedRowCount: (count: number) => void;
  copiedRowId: string | number | null;
  setCopiedRowId: Dispatch<SetStateAction<string | number | null>>;
  shadowDetection: boolean;
  expandCountRef: RefObject<number>;
  nestedTableRef: RefObject<NestedTableRef | null>;
  nestedFocusIndex: number;
  setNestedFocusIndex: (index: number | ((prev: number) => number)) => void;
}

/**
 * The nested matched-requests panel rendered inside each expanded This Page
 * rule row. Reads the rule's merged fire/silent records off `record`, applies
 * the active search filter, and renders them in a virtual sub-table with the
 * keyboard-nav row wiring. Pure presentation glue — every input arrives as a
 * prop so the parent stays the single owner of tab telemetry, copy state, and
 * keyboard focus.
 */
const MatchedRequestsPanel: React.FC<MatchedRequestsPanelProps> = ({
  record,
  expandedRowKey,
  searchText,
  urlMatchCountMap,
  currentTab,
  setNestedRowCount,
  copiedRowId,
  setCopiedRowId,
  shadowDetection,
  expandCountRef,
  nestedTableRef,
  nestedFocusIndex,
  setNestedFocusIndex,
}) => {
  // Only render content for the active expanded row — destroys stale virtual tables
  if (record.key !== expandedRowKey) return null;
  // `record.records` is already newest-first (reversed in dataSource build).
  const allMatches = record.records;
  // If this rule has URL matches for the search, filter to those URLs.
  // If the rule matched only by properties (name/value/domain/tag), show all URLs.
  const hasUrlMatches = searchText && record.id ? urlMatchCountMap.has(record.id) : false;
  const matches = hasUrlMatches
    ? allMatches.filter((m) => m.url.toLowerCase().includes(searchText.toLowerCase()))
    : allMatches;

  // Report nested row count to keyboard nav when this is the keyboard-expanded row
  if (record.key === expandedRowKey) {
    queueMicrotask(() => setNestedRowCount(matches.length));
  }

  if (matches.length === 0) {
    // Empty-state copy tailored to WHY the record list is
    // empty. Two paths land here:
    //   (a) searchText narrowed to zero matches — tell the
    //       user to clear / widen the search
    //   (b) the rule has no fires and no silent matches — in
    //       which case the verdict tells us what would help
    const emptyHint = searchText
      ? `No matched requests contain "${searchText}". Clear or widen the search to see all matches.`
      : record.verdict === 'related'
        ? 'Rule targets a related domain — matches will appear if the page makes requests to that domain.'
        : record.verdict === 'page'
          ? 'Pattern matches this page. Matches will appear as the page issues requests that fit the pattern — interact with the page or reload to trigger them.'
          : 'No matched requests yet — reload the page to capture.';
    return (
      <Text type="secondary" style={{ fontSize: '12px', fontStyle: 'italic' }}>
        {emptyHint}
      </Text>
    );
  }

  const matchedData: MatchedRequestRow[] = matches.map((m, i) => ({
    ...m,
    key: `${record.id}-match-${i}`,
    isTabUrl: m.url === currentTab?.url,
  }));

  const matchedColumns = buildMatchedRequestColumns({ copiedRowId, setCopiedRowId, shadowDetection });

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };

  const copyAllRequests = () => {
    const header = 'Time\tRequest URL\tType\tPattern';
    const rows = matchedData.map((m) => {
      const rt = m.resourceType || (m.isTabUrl ? 'main_frame' : 'other');
      return `${formatTimestamp(m.t)}\t${m.url}\t${RESOURCE_TYPE_LABEL[rt] ?? rt}\t${m.pattern}`;
    });
    void navigator.clipboard.writeText(`${header}\n${rows.join('\n')}`);
    setCopiedRowId('__all_requests__');
    setTimeout(() => setCopiedRowId(null), 1000);
  };

  return (
    <div>
      <div className="value-cell" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {hasUrlMatches
            ? `${matches.length} of ${allMatches.length} request${allMatches.length !== 1 ? 's' : ''} matching "${searchText}"`
            : `${matches.length} request${matches.length !== 1 ? 's' : ''} matched`}
        </Text>
        <Badge status="processing" />
        {copiedRowId === '__all_requests__' ? (
          <CheckOutlined style={{ fontSize: '11px', color: '#52c41a', cursor: 'default' }} />
        ) : (
          <Tooltip title="Copy requests as TSV">
            <CopyTwoTone
              className="value-copy-icon"
              style={{ fontSize: '11px', cursor: 'pointer' }}
              onClick={copyAllRequests}
            />
          </Tooltip>
        )}
      </div>
      <Table<MatchedRequestRow>
        key={`${record.key}-${expandCountRef.current}`}
        ref={nestedTableRef}
        columns={matchedColumns}
        dataSource={matchedData}
        pagination={false}
        size="small"
        virtual
        scroll={matches.length > 3 ? { y: 120 } : undefined}
        showHeader={matches.length > 1}
        rowClassName={(_record, index) => (index === nestedFocusIndex ? 'keyboard-focused-nested-row' : '')}
        onRow={(_record, index) => ({
          onClick: () => {
            if (index !== undefined) {
              setNestedFocusIndex(index);
            }
          },
        })}
      />
    </div>
  );
};

export default MatchedRequestsPanel;
