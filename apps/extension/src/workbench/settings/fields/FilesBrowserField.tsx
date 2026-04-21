/**
 * FilesBrowserField — Phase 12.4b inline file browser.
 *
 * Lists every blob in the active workspace with filename / size /
 * mime / short hash + per-row download and delete buttons. Uses the
 * shared `useFiles` hook so inserts / deletes from any surface
 * (Upload File action, multipart editor's inline Upload button,
 * sibling tabs) show up live without reload.
 *
 * Downloads fetch bytes through the `getFile` bridge RPC (base64
 * transport → Blob reconstruction in the hook). Deletes route through
 * the SW `deleteFile` RPC so the lock discipline is honoured.
 */

import { DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import { useFiles } from '@hooks/useFiles';
import { Button, Empty, Popconfirm, Space, Table, Tooltip, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type React from 'react';
import { useMemo } from 'react';
import type { SettingDef } from '../types';
import FieldRow from './FieldRow';

const { Text } = Typography;

interface FilesBrowserFieldProps {
  def: SettingDef;
}

interface Row {
  key: string;
  fileId: string;
  filename: string;
  size: number;
  mimeType?: string;
  hash: string;
}

const FilesBrowserField: React.FC<FilesBrowserFieldProps> = ({ def }) => {
  const { token } = theme.useToken();
  const { files, isReady, deleteFile, readFile } = useFiles();

  const rows = useMemo<Row[]>(
    () =>
      files.map((f) => ({
        key: f.fileId,
        fileId: f.fileId,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        hash: f.hash,
      })),
    [files],
  );

  const handleDownload = async (row: Row) => {
    const result = await readFile(row.fileId);
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = row.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnsType<Row> = [
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename',
      render: (name: string) => (
        <span>
          <FileOutlined /> <code style={{ fontSize: 12 }}>{name}</code>
        </span>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 110,
      render: (n: number) => <Text type="secondary">{formatBytes(n)}</Text>,
    },
    {
      title: 'MIME',
      dataIndex: 'mimeType',
      key: 'mimeType',
      width: 160,
      render: (m: string | undefined) =>
        m ? <code style={{ fontSize: 11 }}>{m}</code> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Hash',
      dataIndex: 'hash',
      key: 'hash',
      width: 140,
      render: (hash: string) => (
        <Tooltip title={hash}>
          <code style={{ fontSize: 11 }}>{hash.slice(0, 22)}…</code>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_: unknown, row: Row) => (
        <Space size={4}>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => void handleDownload(row)}>
            Download
          </Button>
          <Popconfirm
            title={`Delete ${row.filename}?`}
            description="Multipart parts referencing this file will error on send."
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              void deleteFile(row.fileId);
            }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <FieldRow
      settingKey={def.key}
      label={def.label}
      description={def.description}
      experimental={def.experimental}
      requiresConnection={def.requiresConnection}
      resettable={false}
    >
      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: 6,
          background: token.colorBgContainer,
        }}
      >
        {rows.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              !isReady ? (
                <Text type="secondary">Loading files…</Text>
              ) : (
                <Text type="secondary">No files yet — use the Upload File action above.</Text>
              )
            }
          />
        ) : (
          <Table<Row> size="small" pagination={false} columns={columns} dataSource={rows} scroll={{ y: 360 }} />
        )}
      </div>
    </FieldRow>
  );
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default FilesBrowserField;
