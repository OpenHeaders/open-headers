import { CheckOutlined } from '@ant-design/icons';
import type { SortMode } from '@openheaders/ui/shared/table-shared';
import { Typography } from 'antd';
import type { MenuProps } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { TableRecord } from './rules-table-records';

const { Text } = Typography;

export interface RulesTableSortMenuOptions {
  sortMode: SortMode;
  sortedInfo: SorterResult<TableRecord>;
  handleSortModeChange: (mode: SortMode) => void;
}

/**
 * Builds the sort-order dropdown items. Rebuilt every render (as the
 * inline array was) so the active-mode checkmarks track state — no
 * referential stability is required.
 */
export function buildRulesTableSortMenu({
  sortMode,
  sortedInfo,
  handleSortModeChange,
}: RulesTableSortMenuOptions): MenuProps['items'] {
  const hasColumnSort = !!sortedInfo.order;
  return [
    {
      key: 'label',
      label: (
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
          SORT ORDER
        </Text>
      ),
      disabled: true,
    },
    {
      key: 'status',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>By status</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Active → Paused → Disabled → Draft · priority within each
            </Text>
          </div>
          {sortMode === 'status' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('status'),
    },
    {
      key: 'priority',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>By priority</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Block → Redirect → Query → Header → Inject · A-Z within each
            </Text>
          </div>
          {sortMode === 'priority' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('priority'),
    },
    {
      key: 'manual',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>Workspace order</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Matches the workspace sidebar tree order
            </Text>
          </div>
          {sortMode === 'manual' && !hasColumnSort && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => handleSortModeChange('manual'),
    },
    ...(hasColumnSort
      ? [
          { type: 'divider' as const, key: 'div' },
          {
            key: 'column-sort',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
                <div>
                  <div>By column</div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Sorted by {String(sortedInfo.columnKey)} — click an option above to reset
                  </Text>
                </div>
                <CheckOutlined style={{ color: '#1677ff' }} />
              </div>
            ),
            disabled: true,
          },
        ]
      : []),
  ];
}
