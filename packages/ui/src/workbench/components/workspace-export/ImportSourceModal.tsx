/**
 * Import hub modal — the single "Import…" entry point (IMPORT_PLAN.md
 * §2.1). One surface accepts anything importable and routes by content,
 * never by asking the user for a format:
 *
 *   • Paste field (autofocused): a pasted curl command / bare URL /
 *     HAR / Postman / workspace-export text is classified by
 *     `detectImportSource` and handed off via `onTextDetected` — on
 *     paste the hand-off is automatic (the host closes this modal and
 *     opens the matching stage-2 modal pre-filled); typed input goes
 *     through the same detection behind an explicit Continue button so
 *     half-typed commands don't get yanked away mid-keystroke.
 *   • Drop zone / file picker: files are handed to `onFileChosen`; the
 *     host reads the text and routes by the same detection.
 *   • Folder picker / directory drag: a picked folder (Bruno
 *     collection) hands its files to `onFolderChosen` — consent-shaped,
 *     the user chooses the folder; nothing is scanned beyond it.
 *
 * Unknown input renders an inline hint — the hub never dead-ends.
 */

import { ArrowRightOutlined, CloseOutlined, FolderOpenOutlined, InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { detectImportSource } from '@openheaders/core/import';
import { Button, Input, Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { BrunoGlyph, InsomniaGlyph, PostmanGlyph } from '../import/migrate/vendor-icons';
import { type PickedFile, pickedFromEntries, pickedFromInput } from './picked-files';

const { Text } = Typography;

interface Props {
  open: boolean;
  onCancel: () => void;
  /**
   * A pasted/typed source was recognized. `detected.kind` is never
   * `'unknown'` — unrecognized text stays in the hub with a hint.
   */
  onTextDetected: (detected: ReturnType<typeof detectImportSource>, text: string) => void;
  /** Hand-off for picked/dropped files; the host routes by content. */
  onFileChosen: (file: File) => void;
  /** Hand-off for a picked/dropped folder (Bruno collection); the host
   *  filters to importable paths, reads them, and routes. */
  onFolderChosen: (files: PickedFile[]) => void;
  /** When true, the drop zone is replaced with a skeleton + "Reading
   *  file…" line. The host flips this on right after `onFileChosen`
   *  fires and clears it (or closes the modal) once the next modal
   *  is ready, so the user sees one continuous loading affordance
   *  instead of a 1 s frozen-button gap. */
  loading?: boolean;
  /** Opens the migration surface — the permanent "Migrate from another
   *  tool" hub entry. Absent on hosts without the migration ladder. */
  onMigrate?: () => void;
  /** When the hub closes as a hand-off to a successor modal, the host
   *  passes false so the close-time focus restore doesn't steal focus
   *  from the successor's autofocused field. Defaults to antd's true
   *  (plain cancel restores focus to the trigger). */
  focusTriggerAfterClose?: boolean;
}

const ImportSourceModal: React.FC<Props> = ({
  open,
  onCancel,
  onTextDetected,
  onFileChosen,
  onFolderChosen,
  loading = false,
  onMigrate,
  focusTriggerAfterClose = true,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const pasteJustHappened = useRef(false);

  const detected = useMemo(() => detectImportSource(pasteText), [pasteText]);
  const recognized = detected.kind !== 'unknown';

  const pickFile = useCallback(() => inputRef.current?.click(), []);
  const pickFolder = useCallback(() => folderInputRef.current?.click(), []);

  const handleFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      // Forward all files. The host maintains a multi-file queue that
      // routes / previews once per file in sequence.
      for (const f of Array.from(files)) onFileChosen(f);
    },
    [onFileChosen],
  );

  const submitText = useCallback(() => {
    const d = detectImportSource(pasteText);
    if (d.kind === 'unknown') return;
    setPasteText('');
    onTextDetected(d, pasteText);
  }, [pasteText, onTextDetected]);

  return (
    <Modal
      open={open}
      title={null}
      footer={null}
      closable={false}
      onCancel={onCancel}
      width={520}
      centered
      maskClosable={false}
      destroyOnHidden
      focusTriggerAfterClose={focusTriggerAfterClose}
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
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.importExport.hub.title')}
        </span>
        <div style={{ flex: 1 }} />
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onCancel}
          aria-label={t('workbench.importExport.hub.closeAria')}
        />
      </div>

      <div style={{ padding: '6px 6px 12px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              {t('workbench.importExport.hub.readingFile')}
            </Text>
            <Skeleton active title={false} paragraph={{ rows: 5, width: ['72%', '54%', '68%', '60%', '78%'] }} />
          </div>
        ) : (
          <>
            {/* Paste field — pasting a recognized source hands off
                immediately; typed input confirms via Enter / the
                arrow button. */}
            <div style={{ background: token.colorBgContainer, borderRadius: 6, padding: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Input.TextArea
                  autoFocus
                  value={pasteText}
                  placeholder={t('workbench.importExport.hub.pastePlaceholder')}
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  style={{ fontFamily: 'var(--ant-font-family-code)', fontSize: 12 }}
                  onPaste={() => {
                    pasteJustHappened.current = true;
                  }}
                  onChange={(e) => {
                    const text = e.target.value;
                    setPasteText(text);
                    if (pasteJustHappened.current) {
                      pasteJustHappened.current = false;
                      const d = detectImportSource(text);
                      if (d.kind !== 'unknown') {
                        setPasteText('');
                        onTextDetected(d, text);
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submitText();
                    }
                  }}
                />
                {recognized && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<ArrowRightOutlined />}
                    onClick={submitText}
                    aria-label={t('workbench.importExport.hub.continueAria')}
                    style={{ marginTop: 2 }}
                  />
                )}
              </div>
              {pasteText.trim().length > 0 && !recognized && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  {t('workbench.importExport.hub.notRecognized')}
                </Text>
              )}
            </div>

            <div
              // Drop target only — the OS pickers open exclusively from
              // the explicit Browse buttons.
              aria-label={t('workbench.importExport.hub.dropAria')}
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
                // Entries must be grabbed synchronously — the
                // DataTransfer is only readable during the event.
                const entries = Array.from(e.dataTransfer.items ?? []).map(
                  (item) => item.webkitGetAsEntry?.() ?? null,
                );
                if (entries.some((entry) => entry?.isDirectory)) {
                  void pickedFromEntries(entries).then(onFolderChosen);
                  return;
                }
                handleFiles(e.dataTransfer.files);
              }}
              style={{
                background: dragActive ? token.colorPrimaryBg : token.colorBgContainer,
                borderRadius: 6,
                border: `2px dashed ${dragActive ? token.colorPrimary : token.colorBorder}`,
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                transition: 'border-color 120ms ease, background 120ms ease',
              }}
            >
              <InboxOutlined
                style={{ fontSize: 40, color: dragActive ? token.colorPrimary : token.colorTextTertiary }}
              />
              <Text strong style={{ fontSize: 14 }}>
                {t('workbench.importExport.hub.dropTitle')}
              </Text>
              <ul
                style={{
                  fontSize: 12,
                  color: token.colorTextSecondary,
                  margin: 0,
                  paddingLeft: 18,
                  textAlign: 'left',
                }}
              >
                <li>{t('workbench.importExport.hub.kindHar')}</li>
                <li>{t('workbench.importExport.hub.kindPostman')}</li>
                <li>{t('workbench.importExport.hub.kindInsomnia')}</li>
                <li>
                  Bruno <code>.bru</code> {t('workbench.importExport.hub.kindBrunoSuffix')}
                </li>
                <li>{t('workbench.importExport.hub.kindOpenapi')}</li>
                <li>
                  <code>.openheaders.yaml</code> {t('workbench.importExport.hub.kindWorkspaceSuffix')}
                </li>
              </ul>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('workbench.importExport.hub.autoDetected')}
              </Text>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Button type="primary" icon={<UploadOutlined />} onClick={pickFile}>
                  {t('workbench.importExport.hub.browseFiles')}
                </Button>
                <Button icon={<FolderOpenOutlined />} onClick={pickFolder}>
                  {t('workbench.importExport.hub.browseFolder')}
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".har,.json,.yaml,.yml,.bru,application/json,application/yaml,text/yaml,text/plain"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              />
              <input
                // React's typings carry no `webkitdirectory`; it must
                // land as a real DOM attribute to switch the native
                // dialog into folder mode (Chromium and Firefox).
                ref={(el) => {
                  folderInputRef.current = el;
                  el?.setAttribute('webkitdirectory', '');
                }}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  onFolderChosen(pickedFromInput(e.target.files));
                  if (folderInputRef.current) folderInputRef.current.value = '';
                }}
              />
            </div>

            {onMigrate && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
                  {t('workbench.importExport.hub.switchingFrom')}{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <PostmanGlyph style={{ fontSize: 13, verticalAlign: '-0.125em' }} /> Postman,
                  </span>{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <InsomniaGlyph style={{ fontSize: 13, verticalAlign: '-0.125em' }} /> Insomnia,
                  </span>{' '}
                  {t('workbench.importExport.hub.switchingOr')}{' '}
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <BrunoGlyph style={{ fontSize: 13, verticalAlign: '-0.125em' }} /> Bruno?
                  </span>
                </Text>
                <Button
                  size="small"
                  style={{ fontSize: 12 }}
                  onClick={onMigrate}
                  icon={
                    <img
                      src={hostAssets.resolveUrl('images/logo-pixel.svg')}
                      alt=""
                      style={{ width: 14, height: 14, display: 'block' }}
                    />
                  }
                >
                  {t('workbench.importExport.hub.migrateCta')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ImportSourceModal;
