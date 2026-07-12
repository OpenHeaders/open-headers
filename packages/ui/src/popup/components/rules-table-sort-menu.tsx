import { CheckOutlined } from '@ant-design/icons';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
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
  t: Translate;
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
  t,
}: RulesTableSortMenuOptions): MenuProps['items'] {
  const hasColumnSort = !!sortedInfo.order;
  return [
    {
      key: 'label',
      label: (
        <Text type="secondary" style={{ fontSize: '11px', fontWeight: 600 }}>
          {t('popup.table.sortOrderHeading')}
        </Text>
      ),
      disabled: true,
    },
    {
      key: 'status',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 220 }}>
          <div>
            <div>{t('popup.table.sortByStatus')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortByStatusHintAll')}
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
            <div>{t('popup.table.sortByPriority')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortByPriorityHint')}
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
            <div>{t('popup.table.sortWorkspaceOrder')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortWorkspaceOrderHint')}
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
                  <div>{t('popup.table.sortByColumn')}</div>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {t('popup.table.sortByColumnHint', { column: String(sortedInfo.columnKey) })}
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
