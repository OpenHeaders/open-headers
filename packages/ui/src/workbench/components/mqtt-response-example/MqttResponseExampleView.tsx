/**
 * MqttResponseExampleView — editor tab for a saved MQTT response
 * example, the `WsResponseExampleView` sibling for the MqttRequest
 * family. The captured request half stays editable (an example doubles
 * as an authored record): version chip + URL in the header (the
 * version knob is the capture's fact — a static chip, never a select),
 * Message / Topics compose tabs below — the Message tab on the
 * request editor's own compose anatomy (actions cluster, compose bar,
 * message options) minus Send and the saved-messages rail. The captured session half
 * renders read-only through `MqttExampleResultPane` in the
 * compose/result Allotment split.
 *
 * "Open in Request" hands the current captured request shape to the
 * parent MQTT editor as unsaved draft edits via the prefill bus — the
 * gRPC example's flow applied to the fourth family.
 *
 * Editor mechanics follow the house recipe: draft state, structural
 * dirty via `useReprime` (collapsed-capture fingerprints), Save through
 * the MQTT response-example write client (the captured block patches
 * as one LWW value), shell wiring via `useEditorShell`.
 */

import { ExportOutlined, LoadingOutlined } from '@ant-design/icons';
import { MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { MqttRequestQos, MqttResponseExample, MqttTopicRow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Allotment } from 'allotment';
import { App, Button, Checkbox, Input, Select, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EntityScopeProvider } from '@openheaders/ui/shared/awareness';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useMqttResponseExample } from '@openheaders/ui/shared/hooks/readers/useMqttResponseExamples';
import { applyMqttResponseExampleUpdate } from '@openheaders/ui/shared/sync/mqtt-response-example-write-client';
import EditorHeader from '../shell/EditorHeader';
import CodeEditor from '../shared/CodeEditor';
import CodeEditorActions, { type CodeEditorActionsTarget } from '../shared/CodeEditorActions';
import EditorViewMenu from '../shared/EditorViewMenu';
import { EditableGridTable } from '../request-editor/EditableGridTable';
import type { EditableRowAdapter } from '../request-editor/editable-grid-types';
import { PAYLOAD_FORMAT_LANGUAGE } from '../mqtt-request-editor/compose';
import {
  CompactQosSelect,
  EncodingErrorLine,
  EncodingSelect,
  payloadPlaceholder,
  TopicField,
} from '../mqtt-request-editor/compose-parts';
import { payloadEncodingError } from '../mqtt-request-editor/draft';
import MessagePropertiesPopover from '../mqtt-request-editor/MessagePropertiesPopover';
import { publishMqttPrefill } from '../mqtt-request-editor/mqtt-prefill-bus';
import MqttExampleResultPane from './MqttExampleResultPane';
import {
  capturedMqttRequestFromDraft,
  type MqttExampleDraft,
  mqttExampleDraftFingerprint,
  mqttExampleSignature,
  mqttExampleToDraft,
} from './mqtt-example-draft';

const { Text } = Typography;

/** Topics-grid row adapter — the topic filter rides the key track;
 *  QoS + Subscribe live in the value cell (the capture keeps the 5.0
 *  per-row options verbatim without a popover of their own). */
const TOPIC_ROW_ADAPTER: EditableRowAdapter<MqttTopicRow> = {
  getId: (r) => r.uid,
  getEnabled: () => true,
  setEnabled: (r) => r,
  getKey: (r) => r.topicFilter,
  setKey: (r, v) => ({ ...r, topicFilter: v }),
  getDescription: (r) => r.description ?? '',
  setDescription: (r, v) => ({ ...r, description: v }),
  makeEmpty: () => ({ uid: generateUid(), topicFilter: '' }),
  isEmpty: (r) => !r.topicFilter && !r.description,
};

interface MqttResponseExampleViewProps {
  exampleUid: string;
  workspaceId: string | null;
  /** "Open in Request" — open the parent MQTT request's edit tab; the
   *  captured shape rides the prefill bus into its draft. */
  onOpenMqttRequest: (uid: string, name: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const MqttResponseExampleView: React.FC<MqttResponseExampleViewProps> = ({
  exampleUid,
  workspaceId,
  onOpenMqttRequest,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { example, hydrated } = useMqttResponseExample(workspaceId, exampleUid);
  const { mqttRequests } = useRequests();

  const parentRequest = useMemo(
    () => (example ? (mqttRequests.find((r) => r.uid === example.mqttRequestUid) ?? null) : null),
    [mqttRequests, example],
  );

  const [draft, setDraft] = useState<MqttExampleDraft | null>(null);
  const [activeTab, setActiveTab] = useState('message');
  // Compose-editor wrap — the Message tab's default carries over (ON;
  // payloads are prose-like, scrolling hides the tail).
  const [wrapPayload, setWrapPayload] = useState(true);
  const payloadActionsRef = useRef<CodeEditorActionsTarget | null>(null);

  const reprime = useReprime<MqttResponseExample>({
    liveEntity: example,
    scope: { entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: exampleUid },
    enabled: hydrated,
    formFingerprint: draft ? mqttExampleDraftFingerprint(draft) : '',
    signature: mqttExampleSignature,
    populate: (e) => setDraft(mqttExampleToDraft(e)),
  });
  const isDirty = reprime.isDirty;

  const handleSave = useCallback(async () => {
    if (!draft || !example || !workspaceId || !isDirty) return;
    const result = await applyMqttResponseExampleUpdate(
      exampleUid,
      { request: capturedMqttRequestFromDraft(draft) },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (!result.ok) {
      if (result.reason === 'not-found') message.error(t('workbench.editors.mqttExample.toast.deletedOtherTab'));
      else if ('message' in result && result.message)
        message.error(t('workbench.editors.mqttExample.toast.saveFailedDetail', { message: result.message }));
      else message.error(t('workbench.editors.mqttExample.toast.saveFailed'));
    }
  }, [draft, example, workspaceId, isDirty, exampleUid, message, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
    entityId: example?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const handleOpenInRequest = useCallback(() => {
    if (!draft || !example || !parentRequest) return;
    publishMqttPrefill(parentRequest.uid, capturedMqttRequestFromDraft(draft));
    onOpenMqttRequest(parentRequest.uid, parentRequest.name);
  }, [draft, example, parentRequest, onOpenMqttRequest]);

  if (!hydrated || (example && !draft)) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">
          <LoadingOutlined style={{ marginRight: 6 }} />
          {t('workbench.editors.mqttExample.loading')}
        </Text>
      </div>
    );
  }

  if (!example || !draft) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.editors.mqttExample.notFound')}</Text>
      </div>
    );
  }

  // No Send gates the example, so the encoding gate surfaces inline only.
  const encodingError = payloadEncodingError(draft.payload, draft.payloadFormat);
  const editorPlaceholder = payloadPlaceholder(t, draft.payloadFormat, t('workbench.editors.mqtt.payloadPlaceholder'));

  const headerTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
      {/* The version knob is the capture's fact — a static chip. */}
      <Tag style={{ marginInlineEnd: 0, flexShrink: 0, fontSize: 10 }}>
        {draft.protocolVersion === '3.1.1'
          ? t('workbench.editors.mqtt.version.v311')
          : t('workbench.editors.mqtt.version.v5')}
      </Tag>
      <Input
        style={{ flex: 1, minWidth: 0, fontFamily: "'SF Mono', monospace", fontSize: 12 }}
        placeholder={t('workbench.editors.mqtt.urlPlaceholder')}
        value={draft.url}
        onChange={(e) => setDraft((d) => (d ? { ...d, url: e.target.value } : d))}
        data-testid="mqtt-example-url-input"
      />
    </div>
  );

  const openDisabled = parentRequest === null;
  const headerActions = (
    <Tooltip
      title={
        openDisabled ? t('workbench.editors.mqtt.notFound') : t('workbench.editors.mqttExample.openInRequestTooltip')
      }
      placement="bottom"
    >
      <span style={{ display: 'inline-flex', cursor: openDisabled ? 'not-allowed' : undefined }}>
        <Button
          size="small"
          type="primary"
          icon={<ExportOutlined />}
          disabled={openDisabled}
          onClick={handleOpenInRequest}
          data-testid="mqtt-example-open-in-request"
        >
          {t('workbench.editors.mqttExample.openInRequest')}
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: token.colorBgContainer,
          height: '100%',
        }}
      >
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <div style={{ flex: 1, minHeight: 0 }}>
          <Allotment vertical proportionalLayout separator>
            <Allotment.Pane minSize={180} preferredSize="45%">
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                <div style={{ padding: '0 12px' }}>
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="small"
                    tabBarStyle={{ marginBottom: 0 }}
                    items={[
                      { key: 'message', label: t('workbench.editors.mqtt.tab.message') },
                      { key: 'topics', label: t('workbench.editors.mqtt.tab.topics') },
                    ]}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    overscrollBehavior: 'none',
                    padding: '0 12px',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '10px 0', flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'message' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
                        {/* The Message-tab anatomy minus what an
                          example has no use for — no saved-messages
                          rail, no Send: the actions cluster above the
                          editor, the compose bar below it. */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                          <CodeEditorActions
                            target={payloadActionsRef}
                            language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
                            labels
                            findText={t('workbench.editors.scriptEditor.find')}
                            replaceText={t('workbench.editors.scriptEditor.replace')}
                            formatText={t('workbench.editors.scriptEditor.beautify')}
                          />
                          <EditorViewMenu
                            wrap={wrapPayload}
                            onWrapChange={setWrapPayload}
                            data-testid="mqtt-example-editor-menu"
                          />
                        </div>
                        <div style={{ flex: 1, minHeight: 100, position: 'relative' }}>
                          {/* Column direction — a fill editor sizes to
                            content as a row-flex child (the sliver
                            trap). */}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
                            <CodeEditor
                              value={draft.payload}
                              onChange={(payload) => setDraft((d) => (d ? { ...d, payload } : d))}
                              language={PAYLOAD_FORMAT_LANGUAGE[draft.payloadFormat]}
                              fill
                              actions="external"
                              actionsRef={payloadActionsRef}
                              wordWrapOverride={wrapPayload ? 'on' : 'off'}
                              placeholder={editorPlaceholder}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <EncodingSelect
                            value={draft.payloadFormat}
                            onChange={(payloadFormat) => setDraft((d) => (d ? { ...d, payloadFormat } : d))}
                            testId="mqtt-example-payload-format"
                          />
                          <span style={{ flex: 1 }} />
                          <MessagePropertiesPopover
                            value={draft.publishProperties}
                            onChange={(publishProperties) => setDraft((d) => (d ? { ...d, publishProperties } : d))}
                            v5={draft.protocolVersion === '5.0'}
                            testId="mqtt-example-props"
                          />
                          <Checkbox
                            checked={draft.retain}
                            onChange={(e) => setDraft((d) => (d ? { ...d, retain: e.target.checked } : d))}
                            data-testid="mqtt-example-retain"
                          >
                            {t('workbench.editors.mqtt.retainLabel')}
                          </Checkbox>
                          <CompactQosSelect
                            value={draft.qos}
                            onChange={(qos) => setDraft((d) => (d ? { ...d, qos } : d))}
                            testId="mqtt-example-qos"
                          />
                          <TopicField
                            value={draft.topic}
                            onChange={(topic) => setDraft((d) => (d ? { ...d, topic } : d))}
                            placeholder={t('workbench.editors.mqtt.topicPlaceholder')}
                            example={t('workbench.editors.mqtt.topicExample')}
                            testId="mqtt-example-topic"
                          />
                        </div>
                        <EncodingErrorLine error={encodingError} testId="mqtt-example-encoding-error" />
                      </div>
                    )}
                    {activeTab === 'topics' && (
                      <EditableGridTable<MqttTopicRow>
                        rows={draft.topics}
                        onChange={(topics) => setDraft((d) => (d ? { ...d, topics } : d))}
                        adapter={TOPIC_ROW_ADAPTER}
                        keyPlaceholder={t('workbench.editors.mqtt.topics.filterPlaceholder')}
                        headerLabels={{
                          key: t('workbench.editors.mqtt.topics.filterLabel'),
                          value: t('workbench.editors.mqtt.topics.qosColLabel'),
                        }}
                        hideEnabled
                        columnWidths={{ value: '64px' }}
                        renderValueCell={(row, update, ctx) => (
                          // The compact QoS knob (the Topics tab's
                          // idiom): bare integer, the menu explains.
                          <Select
                            size="small"
                            style={{ width: 46, marginLeft: 6 }}
                            suffixIcon={null}
                            popupMatchSelectWidth={false}
                            disabled={ctx.isPlaceholder}
                            value={row.qos ?? 0}
                            options={[
                              { value: 0, label: '0', meaning: t('workbench.editors.mqtt.qos.meaning0') },
                              { value: 1, label: '1', meaning: t('workbench.editors.mqtt.qos.meaning1') },
                              { value: 2, label: '2', meaning: t('workbench.editors.mqtt.qos.meaning2') },
                            ]}
                            optionRender={(option) => (
                              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 16 }}>
                                <span>{option.data.label}</span>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {option.data.meaning}
                                </Text>
                              </span>
                            )}
                            onChange={(qos: MqttRequestQos) => update({ ...row, qos })}
                          />
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Allotment.Pane>
            <Allotment.Pane minSize={140}>
              <MqttExampleResultPane
                response={example.response}
                protocolVersion={example.request.protocolVersion}
                capturedAt={example.capturedAt}
              />
            </Allotment.Pane>
          </Allotment>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default MqttResponseExampleView;
