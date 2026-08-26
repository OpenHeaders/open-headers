/**
 * WsMessageTab — the compose surface. Toolbar row ABOVE the editor
 * (the ScriptsTab discipline): the raw flavor's display-mode toggle,
 * or the Socket.IO event name + ack opt-in that compose the EVENT
 * frame; the "Use example message" picker off the specLink census;
 * Find / Replace / Beautify for JSON. Below, the fill editor — the
 * Socket.IO argument rail beside it when the stored text parses as
 * an array — and the Send control bottom-right, a visible affordance
 * that ENABLES only while the session is open (the compose text is
 * what Send writes, so the control lives on it).
 */

import { SendOutlined } from '@ant-design/icons';
import type { WebSocketMessageFormat } from '@openheaders/core/types';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input, Segmented, Select, Switch, Tooltip, Typography } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { MESSAGE_FORMAT_LANGUAGE, SEND_MESSAGE_SHORTCUT } from './compose';
import type { WebSocketDraft } from './draft';
import type { SocketIoArgs } from './useSocketIoArgs';
import type { WsComposeAids } from './useWsComposeAids';
import WsArgRail from './WsArgRail';

const { Text } = Typography;

interface WsMessageTabProps {
  draft: WebSocketDraft;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  socketioFlavor: boolean;
  sessionOpen: boolean;
  args: SocketIoArgs;
  aids: WsComposeAids;
  onSend: () => void;
}

const WsMessageTab: React.FC<WsMessageTabProps> = ({
  draft,
  setDraft,
  socketioFlavor,
  sessionOpen,
  args,
  aids,
  onSend,
}) => {
  const t = useT();
  const messageActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  // Compose-editor wrap — a per-pane override of the global
  // `editor.wordWrap` setting, ON by default (a message payload is
  // prose-like; horizontal scrolling hides the tail).
  const [wrapMessage, setWrapMessage] = useState(true);
  const { argTexts, activeArg, composeArgs } = args;

  // "Use example message" — the compose aid off the specLink census.
  // A command picker, not a value: picking synthesizes the payload
  // into the editor and resets to the placeholder. Options without a
  // synthesizable payload (no schema, combinators) stay visible but
  // disabled — the census is shown honestly, never filtered silently.
  const exampleSelect =
    aids.exampleMessages.length > 0 ? (
      <Select
        size="small"
        style={{ minWidth: 190 }}
        placeholder={t('workbench.editors.websocket.spec.useExample')}
        value={null}
        options={aids.exampleMessages.map((m) => ({ value: m.key, label: m.label, disabled: m.synth === null }))}
        onChange={(key: string) => aids.applyExampleMessage(key)}
        data-testid="ws-use-example-message"
      />
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {socketioFlavor ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <Input
              size="small"
              style={{ maxWidth: 260, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
              placeholder={t('workbench.editors.websocket.event.namePlaceholder')}
              value={draft.eventName}
              onChange={(e) => setDraft((d) => ({ ...d, eventName: e.target.value }))}
              data-testid="websocket-event-name"
            />
            <Tooltip title={t('workbench.editors.websocket.event.ackHelp')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Switch
                  size="small"
                  checked={draft.ackEnabled}
                  onChange={(ackEnabled) => setDraft((d) => ({ ...d, ackEnabled }))}
                  data-testid="websocket-expect-ack"
                />
                <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {t('workbench.editors.websocket.event.ackLabel')}
                </Text>
              </span>
            </Tooltip>
            {exampleSelect}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Segmented
              size="small"
              value={draft.messageFormat}
              onChange={(messageFormat) =>
                setDraft((d) => ({ ...d, messageFormat: messageFormat as WebSocketMessageFormat }))
              }
              options={[
                { value: 'text', label: t('workbench.editors.websocket.message.formatText') },
                { value: 'json', label: t('workbench.editors.websocket.message.formatJson') },
                { value: 'xml', label: t('workbench.editors.websocket.message.formatXml') },
                { value: 'html', label: t('workbench.editors.websocket.message.formatHtml') },
              ]}
              data-testid="websocket-message-format"
            />
            {exampleSelect}
          </div>
        )}
        {(socketioFlavor || draft.messageFormat === 'json') && (
          <CodeEditorActions
            target={messageActionsRef}
            language="json"
            labels
            findText={t('workbench.editors.scriptEditor.find')}
            replaceText={t('workbench.editors.scriptEditor.replace')}
            formatText={t('workbench.editors.scriptEditor.beautify')}
          />
        )}
        <EditorViewMenu wrap={wrapMessage} onWrapChange={setWrapMessage} data-testid="ws-editor-menu" />
      </div>
      {/* Absolute inset host — a fill editor must not size its own
        flex parent (the BodyTab discipline). */}
      <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {socketioFlavor && argTexts !== null && <WsArgRail args={args} argTexts={argTexts} />}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {socketioFlavor && argTexts !== null ? (
              <CodeEditor
                value={argTexts[activeArg] ?? ''}
                onChange={(text) => {
                  const base = argTexts.length === 0 ? [''] : [...argTexts];
                  base[Math.min(activeArg, base.length - 1)] = text;
                  composeArgs(base);
                }}
                language="json"
                fill
                actions="external"
                actionsRef={messageActionsRef}
                wordWrapOverride={wrapMessage ? 'on' : 'off'}
                placeholder={t('workbench.editors.websocket.event.argPlaceholder')}
              />
            ) : (
              <CodeEditor
                value={draft.message}
                onChange={(message) => setDraft((d) => ({ ...d, message }))}
                language={socketioFlavor ? 'json' : MESSAGE_FORMAT_LANGUAGE[draft.messageFormat]}
                fill
                actions="external"
                actionsRef={messageActionsRef}
                wordWrapOverride={wrapMessage ? 'on' : 'off'}
                placeholder={
                  socketioFlavor
                    ? t('workbench.editors.websocket.event.argsPlaceholder')
                    : t('workbench.editors.websocket.messagePlaceholder')
                }
              />
            )}
          </div>
        </div>
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
              sessionOpen ? (
                <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                  {t('workbench.editors.websocket.session.sendMessage')}
                </ShortcutHintTitle>
              ) : (
                t('workbench.editors.websocket.session.sendIdle')
              )
            }
          >
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              disabled={!sessionOpen}
              onClick={onSend}
              data-testid="websocket-send-message"
            >
              {t('workbench.editors.websocket.session.sendMessage')}
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default WsMessageTab;
