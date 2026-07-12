import { CheckOutlined } from '@ant-design/icons';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { type MenuProps, Typography } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import type { SortMode, TableRecord } from './types';

const { Text } = Typography;

export interface SortOrderMenuOptions {
  sortMode: SortMode;
  sortedInfo: SorterResult<TableRecord>;
  onSortModeChange: (mode: SortMode) => void;
  t: Translate;
}

/**
 * Builds the sort-order dropdown items for the This Page toolbar. Rebuilt
 * every render (as the inline array was) so the active-mode checkmarks track
 * `sortMode` / `sortedInfo` — no memoization is required because no item
 * closes over a value that must be referentially stable.
 */
export function buildSortOrderMenuItems({
  sortMode,
  sortedInfo,
  onSortModeChange,
  t,
}: SortOrderMenuOptions): MenuProps['items'] {
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 220,
          }}
        >
          <div>
            <div>{t('popup.table.sortByStatus')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortByStatusHintThisPage')}
            </Text>
          </div>
          {sortMode === 'status' && !sortedInfo.order && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => onSortModeChange('status'),
    },
    {
      key: 'priority',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 220,
          }}
        >
          <div>
            <div>{t('popup.table.sortByPriority')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortByPriorityHint')}
            </Text>
          </div>
          {sortMode === 'priority' && !sortedInfo.order && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => onSortModeChange('priority'),
    },
    {
      key: 'manual',
      label: (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: 220,
          }}
        >
          <div>
            <div>{t('popup.table.sortWorkspaceOrder')}</div>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {t('popup.table.sortWorkspaceOrderHint')}
            </Text>
          </div>
          {sortMode === 'manual' && !sortedInfo.order && <CheckOutlined style={{ color: '#1677ff' }} />}
        </div>
      ),
      onClick: () => onSortModeChange('manual'),
    },
    ...(sortedInfo.order
      ? [
          { type: 'divider' as const, key: 'div' },
          {
            key: 'column-sort',
            label: (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minWidth: 220,
                }}
              >
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
