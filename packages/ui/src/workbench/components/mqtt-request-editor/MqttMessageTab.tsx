/**
 * MqttMessageTab — the publish compose surface: payload editor with
 * the spec's example picker and the Find / Replace / Beautify cluster
 * in the toolbar row above it (Find/Replace ride every encoding; the
 * cluster keeps Beautify to formattable languages), the compose bar
 * BELOW the editor (ENCODING dropdown left; properties, Retain, the
 * compact QoS — integer, the menu explains the levels only when
 * opened — the narrow topic input and Send on the right; base64/hex
 * author BINARY payloads, so invalid input gates Send honestly), and
 * the collapsible Saved-messages rail.
 */

import { SendOutlined } from '@ant-design/icons';
import type { MqttPublishWire } from '@openheaders/core/bridge';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { isMac } from '@openheaders/ui/shared/platform';
import { Allotment } from 'allotment';
import { Button, Checkbox, Select, Tooltip } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useRef, useState } from 'react';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { composePublishWire, PAYLOAD_FORMAT_LANGUAGE } from './compose';
import { CompactQosSelect, EncodingErrorLine, EncodingSelect, payloadPlaceholder, TopicField } from './compose-parts';
import type { MqttDraft } from './draft';
import MessagePropertiesPopover from './MessagePropertiesPopover';
import MqttSavedMessagesRail, { MqttSavedMessagesStrip } from './MqttSavedMessagesRail';
import type { MqttComposeAids } from './useMqttComposeAids';

const SEND_MESSAGE_SHORTCUT = isMac ? '⇧⌘↵' : 'Ctrl+Shift+Enter';

interface MqttMessageTabProps {
  draft: MqttDraft;
  setDraft: Dispatch<SetStateAction<MqttDraft>>;
  v5: boolean;
  sessionOpen: boolean;
  /** Which encoding gate bites, or null when the payload is valid. */
  encodingError: 'base64' | 'hex' | null;
  /** Saved-row the compose is bound to (the rail's selection plane). */
  selectedSavedUid: string | null;
  onSelectSavedMessage: (uid: string | null) => void;
  aids: MqttComposeAids;
  onPublish: (message: MqttPublishWire) => void;
}

const MqttMessageTab: React.FC<MqttMessageTabProps> = ({
  draft,
  setDraft,
  v5,
  sessionOpen,
  encodingError,
  selectedSavedUid,
  onSelectSavedMessage,
  aids,
  onPublish,
}) => {
  const t = useT();
  // Compose-editor wrap — a per-pane override of the global setting,
  // ON by default (payloads are prose-like; scrolling hides the tail).
  const [wrapPayload, setWrapPayload] = useState(true);
  const payloadActionsRef = useRef<CodeEditorActionsTarget | null>(null);
  // Saved-messages rail collapse — editor-local display state,
  // COLLAPSED by default (the compose editor gets the full width; the
  // strip is the affordance in). The rail is a hidden Allotment pane
  // while collapsed, the strip flush beside the editor.
  const [railCollapsed, setRailCollapsed] = useState(true);
  const editorPlaceholder = payloadPlaceholder(t, draft.payloadFormat, t('workbench.editors.mqtt.payloadPlaceholder'));

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
        placeholder={t('workbench.editors.mqtt.spec.useExample')}
        value={null}
        options={aids.exampleMessages.map((m) => ({ value: m.key, label: m.label, disabled: m.synth === null }))}
        onChange={(key: string) => aids.applyExampleMessage(key)}
        data-testid="mqtt-use-example-message"
      />
    ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
      {/* Toolbar row ABOVE the editor (the ScriptsTab discipline): the
        spec's example picker on the left; Find / Replace / Beautify
        cluster on the right. The ENCODING choice lives on the compose
        bar BELOW the editor. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{exampleSelect}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Find/Replace ride every encoding; the cluster itself keeps
            Beautify to formattable languages (json here —
            text/base64/hex are plaintext). */}
          <CodeEditorActions
            target={payloadActionsRef}
            language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
            labels
            findText={t('workbench.editors.scriptEditor.find')}
            replaceText={t('workbench.editors.scriptEditor.replace')}
            formatText={t('workbench.editors.scriptEditor.beautify')}
          />
          <EditorViewMenu wrap={wrapPayload} onWrapChange={setWrapPayload} data-testid="mqtt-editor-menu" />
        </div>
      </div>
      {/* Editor beside the Saved-messages rail — ONE tree in every
        state so the editor never remounts on a toggle (a fresh Monaco
        flickers). The rail is an Allotment pane that HIDES when
        collapsed (its sash goes with it), and the vertical strip sits
        flush beside the Allotment then. Expanded, the rail resizes
        within min/max; the sash is the ONLY divider. */}
      {/* Expanded, the row bleeds into the tab body's right padding so
        the rail's scrollbar sits at the content edge, clear of the
        rows — the rail insets its rows back to the column. */}
      <div style={{ flex: 1, minHeight: 100, display: 'flex', marginRight: railCollapsed ? 0 : -12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Allotment proportionalLayout={false} separator>
            <Allotment.Pane minSize={280}>
              {/* Absolute inset host — a fill editor must not size its
                own flex parent (the BodyTab discipline). */}
              <div style={{ height: '100%', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                  <CodeEditor
                    value={draft.payload}
                    onChange={(payload) => setDraft((d) => ({ ...d, payload }))}
                    language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
                    fill
                    actions="external"
                    actionsRef={payloadActionsRef}
                    wordWrapOverride={wrapPayload ? 'on' : 'off'}
                    placeholder={editorPlaceholder}
                  />
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={160} maxSize={420} preferredSize={208} visible={!railCollapsed}>
              <MqttSavedMessagesRail
                draft={draft}
                setDraft={setDraft}
                sessionOpen={sessionOpen}
                selectedUid={selectedSavedUid}
                onSelect={onSelectSavedMessage}
                onPublish={onPublish}
                onHide={() => setRailCollapsed(true)}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
        {railCollapsed && <MqttSavedMessagesStrip onExpand={() => setRailCollapsed(false)} />}
      </div>
      {/* Compose bar BELOW the editor+rail row, full width (the
        message panel's own bottom band): ENCODING dropdown left;
        publish controls right — properties, Retain, the compact QoS
        (integer; the menu explains the levels only when opened), the
        narrow topic input, Send (disabled scaffold — enables with the
        session plane; invalid base64/hex is the other honest gate). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <EncodingSelect
          value={draft.payloadFormat}
          onChange={(payloadFormat) => setDraft((d) => ({ ...d, payloadFormat }))}
          testId="mqtt-payload-format"
        />
        <span style={{ flex: 1 }} />
        <MessagePropertiesPopover
          value={draft.publishProperties}
          onChange={(publishProperties) => setDraft((d) => ({ ...d, publishProperties }))}
          v5={v5}
          testId="mqtt-publish-props"
        />
        <Checkbox
          checked={draft.retain}
          onChange={(e) => setDraft((d) => ({ ...d, retain: e.target.checked }))}
          data-testid="mqtt-retain"
        >
          {t('workbench.editors.mqtt.retainLabel')}
        </Checkbox>
        <CompactQosSelect
          value={draft.qos}
          onChange={(qos) => setDraft((d) => ({ ...d, qos }))}
          testId="mqtt-qos-select"
        />
        <TopicField
          value={draft.topic}
          onChange={(topic) => setDraft((d) => ({ ...d, topic }))}
          placeholder={t('workbench.editors.mqtt.topicPlaceholder')}
          example={t('workbench.editors.mqtt.topicExample')}
          testId="mqtt-topic-input"
        />
        <Tooltip
          title={
            encodingError !== null
              ? t('workbench.editors.mqtt.payload.invalidGate')
              : sessionOpen ? (
                  <ShortcutHintTitle label={SEND_MESSAGE_SHORTCUT}>
                    {t('workbench.editors.mqtt.sendLabel')}
                  </ShortcutHintTitle>
                ) : (
                  t('workbench.editors.mqtt.session.sendIdle')
                )
          }
        >
          <span style={{ display: 'inline-flex' }}>
            <Button
              size="small"
              type="primary"
              icon={<SendOutlined />}
              disabled={!sessionOpen || encodingError !== null}
              onClick={() => onPublish(composePublishWire(draft))}
              data-testid="mqtt-send-message"
            >
              {t('workbench.editors.mqtt.sendLabel')}
            </Button>
          </span>
        </Tooltip>
      </div>
      <EncodingErrorLine error={encodingError} testId="mqtt-encoding-error" />
    </div>
  );
};

export default MqttMessageTab;
