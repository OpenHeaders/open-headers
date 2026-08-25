/**
 * GrpcMessageTab — the compose surface: JSON message editor with the
 * labelled Find / Replace / Beautify cluster in the toolbar row above
 * it (the ScriptsTab discipline), "Use example message" floating
 * bottom-left INSIDE the editor surface, and the client/bidi upstream
 * controls (Send message + End streaming) bottom-right of the same
 * surface — visible for every client/bidi method (the CTA-scaffold
 * posture) and enabled only while a stream is open.
 */

import { SendOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { ExampleChip } from '../shared/ExampleChip';

const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';
const END_STREAMING_SHORTCUT = isMac ? '⇧⌘E' : 'Ctrl+Shift+E';

interface GrpcMessageTabProps {
  message: string;
  onMessageChange: (message: string) => void;
  /** Synthesized example for the selected method; null gates the CTA
   *  with the honest needs-a-method tooltip. */
  exampleText: string | null;
  onUseExample: () => void;
  /** The method is client/bidi — the upstream controls SHOW … */
  clientStreamShape: boolean;
  /** … and ENABLE only while its stream is open. */
  clientStreamActive: boolean;
  onSendStreamMessage: () => void;
  onEndStreaming: () => void;
}

const GrpcMessageTab: React.FC<GrpcMessageTabProps> = ({
  message,
  onMessageChange,
  exampleText,
  onUseExample,
  clientStreamShape,
  clientStreamActive,
  onSendStreamMessage,
  onEndStreaming,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  // Compose-editor wrap — a per-pane override of the global
  // `editor.wordWrap` setting, ON by default (a request message is
  // prose-like JSON; horizontal scrolling hides the tail).
  const [wrapMessage, setWrapMessage] = useState(true);
  // Imperative surface of the mounted message editor — drives the
  // labelled Find / Replace / Beautify cluster in the toolbar row
  // above it (the ScriptsTab discipline).
  const messageActionsRef = useRef<CodeEditorActionsTarget | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      {/* Toolbar row ABOVE the editor (the ScriptsTab discipline): the
        labelled Find / Replace / Beautify cluster — out of the buffer
        so it never covers long first lines. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <CodeEditorActions
          target={messageActionsRef}
          language="json"
          labels
          findText={t('workbench.editors.scriptEditor.find')}
          replaceText={t('workbench.editors.scriptEditor.replace')}
          formatText={t('workbench.editors.scriptEditor.beautify')}
        />
        <EditorViewMenu wrap={wrapMessage} onWrapChange={setWrapMessage} data-testid="grpc-editor-menu" />
      </div>
      {/* Absolute inset host — a fill editor must not size its own
        flex parent (the BodyTab discipline). */}
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <CodeEditor
            value={message}
            onChange={onMessageChange}
            language="json"
            fill
            actions="external"
            actionsRef={messageActionsRef}
            wordWrapOverride={wrapMessage ? 'on' : 'off'}
            placeholder={t('workbench.editors.grpc.messagePlaceholder')}
          />
        </div>
        {/* Floating action pill INSIDE the editor surface,
          bottom-left — the ScriptsTab's Packages/Snippets bar mirrored
          to the opposite corner. */}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 26,
            zIndex: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '2px 4px',
            background: token.colorBgElevated,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            boxShadow: token.boxShadowTertiary,
          }}
        >
          <Tooltip title={exampleText === null ? t('workbench.editors.grpc.example.needsMethod') : undefined}>
            <Button
              size="small"
              type="text"
              icon={<ExampleChip />}
              disabled={exampleText === null}
              onClick={onUseExample}
              data-testid="grpc-use-example"
            >
              {t('workbench.editors.grpc.example.label')}
            </Button>
          </Tooltip>
        </div>
        {/* Stream controls, bottom-RIGHT of the same surface: Send
          message + End streaming for every client/bidi method, enabled
          only while the stream is open — the compose text is what Send
          writes upstream, so the controls live on it. Bare buttons, no
          pill chrome — they carry their own fills. */}
        {clientStreamShape && (
          <div
            style={{
              position: 'absolute',
              bottom: 22,
              right: 26,
              zIndex: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Tooltip
              title={
                clientStreamActive ? (
                  <ShortcutHintTitle label={END_STREAMING_SHORTCUT}>
                    {t('workbench.editors.grpc.stream.endStreaming')}
                  </ShortcutHintTitle>
                ) : (
                  t('workbench.editors.grpc.stream.controlsIdle')
                )
              }
            >
              <Button size="small" disabled={!clientStreamActive} onClick={onEndStreaming} data-testid="grpc-stream-end">
                {t('workbench.editors.grpc.stream.endStreaming')}
              </Button>
            </Tooltip>
            <Tooltip
              title={
                clientStreamActive ? (
                  <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                    {t('workbench.editors.grpc.stream.sendMessage')}
                  </ShortcutHintTitle>
                ) : (
                  t('workbench.editors.grpc.stream.controlsIdle')
                )
              }
            >
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                disabled={!clientStreamActive}
                onClick={onSendStreamMessage}
                data-testid="grpc-stream-send"
              >
                {t('workbench.editors.grpc.stream.sendMessage')}
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrpcMessageTab;
