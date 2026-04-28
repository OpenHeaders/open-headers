/**
 * Drop-zone modal that precedes the import-preview. Replaces the bare
 * native file picker with a proper UX: a drag-and-drop target plus a
 * "Browse files…" button.
 *
 * Triggered by the workspace's "Import from file…" menu entry AND by
 * the `open-import-picker` workspace-intent dispatched from popup /
 * sidepanel surfaces. On a successful pick / drop the modal hands the
 * file to `onFileChosen` (same handler the bare native picker fed) and
 * closes; the existing pipeline (parse → preview modal) takes over.
 *
 * The drop zone accepts any single file — `parseWorkspaceExport` is
 * the source of truth for "is this a valid envelope?", so we don't
 * pre-filter by extension. Multi-file drop falls through to the
 * caller's existing multi-file queue (App.tsx) by dispatching the
 * first file here and letting the queue mechanism handle the rest.
 */

import { CloseOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';

const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
  /** Hand-off to the existing `App.tsx` import pipeline. */
  onFileChosen: (file: File) => void;
  /** When true, the drop zone is replaced with a skeleton + "Reading
   *  file…" line. The host flips this on right after `onFileChosen`
   *  fires and clears it (or closes the modal) once the preview modal
   *  is ready, so the user sees one continuous loading affordance
   *  instead of a 1 s frozen-button gap before the preview opens. */
  loading?: boolean;
}

const ImportSourceModal: React.FC<Props> = ({ open, onCancel, onFileChosen, loading = false }) => {
  const { token } = theme.useToken();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const pickFile = useCallback(() => inputRef.current?.click(), []);

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      // Forward all files. App.tsx already maintains a multi-file queue
      // that opens the preview modal once per file in sequence.
      for (const f of list) onFileChosen(f);
    },
    [onFileChosen],
  );

  return (
    <Modal
      open={open}
      title={null}
      footer={null}
      closable={false}
      onCancel={onCancel}
      width={520}
      centered
      destroyOnHidden
      styles={{
        container: { padding: 0, overflow: 'hidden' },
        body: { padding: 0, background: token.colorBgLayout },
      }}
    >
      {/* Header strip — matches the import-preview's gray topbar so the
          two modals feel like the same family. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          height: 44,
          padding: '0 12px',
          background: token.colorBgLayout,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>IMPORT WORKSPACE EXPORT</span>
        <div style={{ flex: 1 }} />
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onCancel} aria-label="Close import" />
      </div>

      {/* Drop zone OR loading skeleton — same outer card so the
          transition is visually a content swap, not a layout shift.
          When the host flips `loading` (right after onFileChosen
          fires), we replace the drop zone with a shimmer + reading
          line; the host then closes this modal as soon as the preview
          modal becomes ready. */}
      <div style={{ padding: '6px 6px 12px 6px' }}>
        {loading ? (
          <div
            style={{
              background: token.colorBgContainer,
              borderRadius: 6,
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 12,
              minHeight: 220,
            }}
            aria-busy
            aria-live="polite"
          >
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              Reading file…
            </Text>
            <Skeleton active title={false} paragraph={{ rows: 5, width: ['72%', '54%', '68%', '60%', '78%'] }} />
          </div>
        ) : (
          <div
            // The drop zone is also clickable as a `Browse…` shortcut.
            // Marking it `role="button"` quiets a11y lint without
            // changing behaviour — the visible <Button> below stays the
            // primary affordance; this just makes the whole zone
            // discoverable to keyboard / screen-reader users.
            role="button"
            tabIndex={0}
            aria-label="Drop a workspace export file here, or activate to browse"
            onClick={pickFile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pickFile();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
            style={{
              background: dragActive ? token.colorPrimaryBg : token.colorBgContainer,
              borderRadius: 6,
              border: `2px dashed ${dragActive ? token.colorPrimary : token.colorBorder}`,
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              transition: 'border-color 120ms ease, background 120ms ease',
            }}
          >
            <InboxOutlined style={{ fontSize: 40, color: dragActive ? token.colorPrimary : token.colorTextTertiary }} />
            <Text strong style={{ fontSize: 14 }}>
              Drop a workspace export here
            </Text>
            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
              Any <code>.openheaders.yaml</code> file your team or playground generated. Drag it onto this area, or pick
              it from your computer.
            </Text>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              // Stop propagation: the parent zone div is also `role="button"`
              // wired to `pickFile`, so without this the Button's click
              // bubbles up and the OS file picker opens twice.
              onClick={(e) => {
                e.stopPropagation();
                pickFile();
              }}
              style={{ marginTop: 4 }}
            >
              Browse files…
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".yaml,.yml,application/yaml,text/yaml,text/plain"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                handleFiles(e.target.files);
                if (inputRef.current) inputRef.current.value = '';
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ImportSourceModal;
