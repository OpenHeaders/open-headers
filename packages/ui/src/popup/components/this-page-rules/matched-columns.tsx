import { CheckOutlined, CopyTwoTone } from '@ant-design/icons';
import { Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dispatch, SetStateAction } from 'react';
import {
  formatTimestampFull,
  formatTimestampShort,
  renderHighlightedUrl,
  RESOURCE_TYPE_LABEL,
  RESOURCE_TYPE_TOOLTIP,
} from './format';
import type { MatchedRequestRow } from './types';

const { Text } = Typography;

export interface MatchedRequestColumnsOptions {
  copiedRowId: string | number | null;
  setCopiedRowId: Dispatch<SetStateAction<string | number | null>>;
  shadowDetection: boolean;
}

/**
 * Builds the nested matched-requests table columns (Time / Request URL /
 * Type / Delivery / Evidence / Pattern). Rebuilt each render as the inline
 * array was — the copy-state and shadow-detection flag flow in as options
 * so the cell renderers stay current without memoization.
 */
export function buildMatchedRequestColumns({
  copiedRowId,
  setCopiedRowId,
  shadowDetection,
}: MatchedRequestColumnsOptions): ColumnsType<MatchedRequestRow> {
  return [
    {
      title: 'Time',
      dataIndex: 't',
      key: 'timestamp',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.t - b.t,
      defaultSortOrder: 'descend',
      render: (ts: number) => (
        <Tooltip title={formatTimestampFull(ts)}>
          <Text type="secondary" style={{ fontSize: '11px', fontFamily: 'monospace', cursor: 'default' }}>
            {formatTimestampShort(ts)}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Request URL',
      dataIndex: 'url',
      key: 'url',
      width: 380,
      sorter: (a, b) => a.url.localeCompare(b.url),
      render: (url: string, matchRecord: MatchedRequestRow) => {
        const display = url.length > 50 ? `${url.substring(0, 30)}...${url.substring(url.length - 15)}` : url;
        return (
          <div
            className="value-cell"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <Tooltip
              title={
                <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                  <div
                    style={{
                      marginBottom: 6,
                      maxHeight: 80,
                      overflowY: 'auto',
                      wordBreak: 'break-all',
                    }}
                  >
                    {renderHighlightedUrl(matchRecord.url, matchRecord.pattern)}
                  </div>
                  <div
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      paddingTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ opacity: 0.5, fontSize: 11 }}>matched by</span>
                    <span style={{ color: '#69b1ff', fontSize: 11 }}>{matchRecord.pattern}</span>
                  </div>
                </div>
              }
              styles={{ root: { maxWidth: 400 } }}
            >
              <Text
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  cursor: 'default',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {display}
              </Text>
            </Tooltip>
            <span style={{ flex: 1 }} />
            {copiedRowId === matchRecord.key ? (
              <CheckOutlined
                className="value-copy-icon"
                style={{ fontSize: '11px', color: '#52c41a', flexShrink: 0, opacity: 1 }}
              />
            ) : (
              <CopyTwoTone
                className="value-copy-icon"
                style={{ fontSize: '11px', cursor: 'pointer', flexShrink: 0, opacity: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  void navigator.clipboard.writeText(url);
                  setCopiedRowId(matchRecord.key);
                  setTimeout(() => setCopiedRowId(null), 1000);
                }}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Type',
      key: 'type',
      width: 80,
      align: 'center',
      sorter: (a, b) =>
        (RESOURCE_TYPE_LABEL[a.resourceType || 'other'] ?? 'Other').localeCompare(
          RESOURCE_TYPE_LABEL[b.resourceType || 'other'] ?? 'Other',
        ),
      render: (_: unknown, matchRecord: MatchedRequestRow) => {
        const rt = matchRecord.resourceType || (matchRecord.isTabUrl ? 'main_frame' : 'other');
        const label = RESOURCE_TYPE_LABEL[rt] ?? rt;
        const tooltip = RESOURCE_TYPE_TOOLTIP[rt] ?? rt;
        return (
          <Tooltip title={tooltip}>
            <Tag variant="outlined" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
              {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Delivery',
      key: 'delivery',
      width: 90,
      align: 'center',
      sorter: (a, b) => (a.deliveryMode ?? '').localeCompare(b.deliveryMode ?? ''),
      render: (_: unknown, matchRecord: MatchedRequestRow) => {
        switch (matchRecord.deliveryMode) {
          case 'network':
            return (
              <Tooltip title="Request went to the network this session; response was not served from cache.">
                <Tag color="green" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ● live
                </Tag>
              </Tooltip>
            );
          case 'cached':
            return (
              <Tooltip title="Response was served from Chrome's HTTP cache. Your rule applied when this response was originally fetched or on the revalidation round-trip.">
                <Tag style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>● cached</Tag>
              </Tooltip>
            );
          case 'service-worker':
            return (
              <Tooltip title="A service worker intercepted the request. Whether your rule applied depends on what the service worker did next.">
                <Tag color="blue" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ● sw
                </Tag>
              </Tooltip>
            );
          default:
            // Scriptable fire or in-flight — no webRequest completion
            // yet, so delivery mode is unknown. Stay quiet rather
            // than show a misleading tag.
            return null;
        }
      },
    },
    {
      title: 'Evidence',
      key: 'evidence',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.evidence.localeCompare(b.evidence),
      render: (_: unknown, matchRecord: MatchedRequestRow) => {
        // Shadowed rows take precedence visually — that's the
        // reason the user cares about the row at all when the
        // experimental setting is on.
        if (shadowDetection && matchRecord.shadowedBy) {
          return (
            <Tooltip
              title={`This request was terminated by "${matchRecord.shadowedBy.name}" (block rule, higher priority). This rule never ran on it.`}
            >
              <Tag color="warning" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                ⚠ shadowed
              </Tag>
            </Tooltip>
          );
        }
        switch (matchRecord.evidence) {
          case 'confirmed':
            return (
              <Tooltip title="Script confirmed this fire from the in-page injection — ground truth that the rule ran.">
                <Tag color="success" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ✓ confirmed
                </Tag>
              </Tooltip>
            );
          case 'matched-fallback':
            return (
              <Tooltip title="Matched via URL, but the in-page script reporter didn't confirm. Common causes: a strict Content-Security-Policy blocking the MAIN-world injection, or a resource type (stylesheet, image, manifest link) that bypasses fetch/XHR interception.">
                <Tag color="gold" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ~ fallback
                </Tag>
              </Tooltip>
            );
          case 'silent':
            return (
              <Tooltip title="Pattern matched this subresource but the response was served from cache / a service worker / bfcache, so the rule's action could not run. Reload bypassing cache to force a fresh request.">
                <Tag color="gold" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ⊘ silent
                </Tag>
              </Tooltip>
            );
          default:
            return (
              <Tooltip title="URL matched this rule's conditions. Chrome's declarativeNetRequest doesn't report which rule wins arbitration — we observe URL matches, not execution.">
                <Tag color="blue" style={{ margin: 0, fontSize: '11px', cursor: 'help' }}>
                  ~ matched
                </Tag>
              </Tooltip>
            );
        }
      },
    },
    {
      title: 'Pattern',
      dataIndex: 'pattern',
      key: 'pattern',
      width: 140,
      sorter: (a, b) => a.pattern.localeCompare(b.pattern),
      render: (pattern: string) => (
        <Tooltip title={pattern}>
          <Tag variant="outlined" style={{ margin: 0, fontSize: '11px' }}>
            {pattern.length > 18 ? `${pattern.substring(0, 10)}...${pattern.substring(pattern.length - 5)}` : pattern}
          </Tag>
        </Tooltip>
      ),
    },
  ];
}
