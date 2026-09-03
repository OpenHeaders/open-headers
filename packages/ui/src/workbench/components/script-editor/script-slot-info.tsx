/**
 * The rail's `(i)` cards — one per script slot. The HTTP pair leads
 * with the Settings tab's shared example card: the scripts bracket
 * that same send, so the before-request card lights the request line
 * the script may rewrite and the after-response card lights the
 * outcome it tests, both alongside the scripts slot they execute in,
 * with the `oh.*` API glossary beneath (API labels are code, only the
 * descriptions localize). A session slot's card names when its hook
 * runs and what it sees; its glossary lands with the hook's `oh.*`
 * surface. Exhaustive over the vocabulary — a widened kind cannot
 * ship without its card.
 */

import type { ScriptKind, SessionScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { EXAMPLE_CARD_POPOVER_WIDTH, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { settingsExampleCard } from '../request-editor/SettingsRowInfo';

const SESSION_SLOT_INFO: Readonly<Record<SessionScriptKind, { title: MessageKey; summary: MessageKey }>> = {
  'grpc-before-invoke': {
    title: 'workbench.editors.request.scripts.grpcBeforeInvokeInfoTitle',
    summary: 'workbench.editors.request.scripts.grpcBeforeInvokeInfoSummary',
  },
  'grpc-on-message': {
    title: 'workbench.editors.request.scripts.grpcOnMessageInfoTitle',
    summary: 'workbench.editors.request.scripts.grpcOnMessageInfoSummary',
  },
  'grpc-after-response': {
    title: 'workbench.editors.request.scripts.grpcAfterResponseInfoTitle',
    summary: 'workbench.editors.request.scripts.grpcAfterResponseInfoSummary',
  },
  'ws-before-connect': {
    title: 'workbench.editors.request.scripts.wsBeforeConnectInfoTitle',
    summary: 'workbench.editors.request.scripts.wsBeforeConnectInfoSummary',
  },
  'ws-before-send': {
    title: 'workbench.editors.request.scripts.wsBeforeSendInfoTitle',
    summary: 'workbench.editors.request.scripts.wsBeforeSendInfoSummary',
  },
  'ws-on-message': {
    title: 'workbench.editors.request.scripts.wsOnMessageInfoTitle',
    summary: 'workbench.editors.request.scripts.wsOnMessageInfoSummary',
  },
  'ws-after-close': {
    title: 'workbench.editors.request.scripts.wsAfterCloseInfoTitle',
    summary: 'workbench.editors.request.scripts.wsAfterCloseInfoSummary',
  },
  'mqtt-before-connect': {
    title: 'workbench.editors.request.scripts.mqttBeforeConnectInfoTitle',
    summary: 'workbench.editors.request.scripts.mqttBeforeConnectInfoSummary',
  },
  'mqtt-before-publish': {
    title: 'workbench.editors.request.scripts.mqttBeforePublishInfoTitle',
    summary: 'workbench.editors.request.scripts.mqttBeforePublishInfoSummary',
  },
  'mqtt-on-message': {
    title: 'workbench.editors.request.scripts.mqttOnMessageInfoTitle',
    summary: 'workbench.editors.request.scripts.mqttOnMessageInfoSummary',
  },
  'mqtt-after-close': {
    title: 'workbench.editors.request.scripts.mqttAfterCloseInfoTitle',
    summary: 'workbench.editors.request.scripts.mqttAfterCloseInfoSummary',
  },
};

export function scriptSlotInfo(kind: ScriptKind, t: Translate): InfoPopoverContent {
  switch (kind) {
    case 'pre-request':
      return {
        title: t('workbench.editors.request.scripts.preInfoTitle'),
        kicker: t('workbench.editors.request.tab.scripts'),
        diagram: settingsExampleCard(['url', 'scripts']),
        maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
        summary: t('workbench.editors.request.scripts.preInfoSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.scripts.apiHeading'),
            items: [
              { label: 'oh.setHeader(name, value)', desc: t('workbench.editors.request.scripts.apiSetHeader') },
              {
                label: 'oh.setQueryParam(name, value)',
                desc: t('workbench.editors.request.scripts.apiSetQueryParam'),
              },
              { label: 'oh.setUrl(url)', desc: t('workbench.editors.request.scripts.apiSetUrl') },
              { label: 'oh.setBody(body)', desc: t('workbench.editors.request.scripts.apiSetBody') },
              { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
            ],
          },
        ],
      };
    case 'post-response':
      return {
        title: t('workbench.editors.request.scripts.postInfoTitle'),
        kicker: t('workbench.editors.request.tab.scripts'),
        diagram: settingsExampleCard(['chain', 'scripts']),
        maxWidth: EXAMPLE_CARD_POPOVER_WIDTH,
        summary: t('workbench.editors.request.scripts.postInfoSummary'),
        sections: [
          {
            heading: t('workbench.editors.request.scripts.apiHeading'),
            items: [
              { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
              { label: 'oh.require(name)', desc: t('workbench.editors.request.scripts.apiRequire') },
            ],
          },
        ],
      };
    default: {
      const keys = SESSION_SLOT_INFO[kind];
      const glossary = sessionSlotGlossary(kind, t);
      return {
        title: t(keys.title),
        kicker: t('workbench.editors.request.tab.scripts'),
        summary: t(keys.summary),
        ...(glossary.length > 0
          ? { sections: [{ heading: t('workbench.editors.request.scripts.apiHeading'), items: glossary }] }
          : {}),
      };
    }
  }
}

/** A session hook's `oh.*` glossary — lands with the hook's surface;
 *  a kind whose hooks have not landed lists nothing yet. */
function sessionSlotGlossary(kind: SessionScriptKind, t: Translate): Array<{ label: string; desc: string }> {
  const session = { label: 'oh.session', desc: t('workbench.editors.request.scripts.apiSession') };
  switch (kind) {
    case 'grpc-before-invoke':
      return [
        { label: 'oh.invoke', desc: t('workbench.editors.request.scripts.apiInvoke') },
        { label: 'oh.setMetadata(name, value)', desc: t('workbench.editors.request.scripts.apiSetMetadata') },
        { label: 'oh.removeMetadata(name)', desc: t('workbench.editors.request.scripts.apiRemoveMetadata') },
        { label: 'oh.setMessage(text)', desc: t('workbench.editors.request.scripts.apiGrpcSetMessage') },
        session,
      ];
    case 'grpc-on-message':
      return [
        { label: 'oh.message', desc: t('workbench.editors.request.scripts.apiGrpcMessage') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    case 'grpc-after-response':
      return [
        { label: 'oh.response', desc: t('workbench.editors.request.scripts.apiGrpcResponse') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    case 'ws-before-connect':
      return [
        { label: 'oh.connect', desc: t('workbench.editors.request.scripts.apiConnect') },
        { label: 'oh.setUrl(url)', desc: t('workbench.editors.request.scripts.apiSetUrl') },
        { label: 'oh.setHeader(name, value)', desc: t('workbench.editors.request.scripts.apiSetHeader') },
        { label: 'oh.setQueryParam(name, value)', desc: t('workbench.editors.request.scripts.apiSetQueryParam') },
        { label: 'oh.setSubprotocols(list)', desc: t('workbench.editors.request.scripts.apiSetSubprotocols') },
        session,
      ];
    case 'ws-before-send':
      return [
        { label: 'oh.message', desc: t('workbench.editors.request.scripts.apiMessage') },
        { label: 'oh.setMessage(text)', desc: t('workbench.editors.request.scripts.apiSetMessage') },
        { label: 'oh.setEvent(name)', desc: t('workbench.editors.request.scripts.apiSetEvent') },
        { label: 'oh.drop()', desc: t('workbench.editors.request.scripts.apiDrop') },
        session,
      ];
    case 'ws-on-message':
      return [
        { label: 'oh.message', desc: t('workbench.editors.request.scripts.apiMessage') },
        { label: 'oh.send(text)', desc: t('workbench.editors.request.scripts.apiSend') },
        { label: 'oh.sendBinary(base64)', desc: t('workbench.editors.request.scripts.apiSendBinary') },
        { label: 'oh.emit(name, args)', desc: t('workbench.editors.request.scripts.apiEmit') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    case 'ws-after-close':
      return [
        { label: 'oh.close', desc: t('workbench.editors.request.scripts.apiClose') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    case 'mqtt-before-connect':
      return [
        { label: 'oh.connect', desc: t('workbench.editors.request.scripts.apiMqttConnect') },
        { label: 'oh.setClientId(id)', desc: t('workbench.editors.request.scripts.apiSetClientId') },
        { label: 'oh.setUsername(name)', desc: t('workbench.editors.request.scripts.apiSetUsername') },
        { label: 'oh.setPassword(secret)', desc: t('workbench.editors.request.scripts.apiSetPassword') },
        { label: 'oh.setWill(will)', desc: t('workbench.editors.request.scripts.apiSetWill') },
        { label: 'oh.addSubscription(filter, options)', desc: t('workbench.editors.request.scripts.apiAddSubscription') },
        { label: 'oh.setUserProperty(name, value)', desc: t('workbench.editors.request.scripts.apiSetUserProperty') },
        session,
      ];
    case 'mqtt-before-publish':
      return [
        { label: 'oh.message', desc: t('workbench.editors.request.scripts.apiMqttMessage') },
        { label: 'oh.setTopic(topic)', desc: t('workbench.editors.request.scripts.apiSetTopic') },
        { label: 'oh.setPayload(payload, format)', desc: t('workbench.editors.request.scripts.apiSetPayload') },
        { label: 'oh.setQos(qos)', desc: t('workbench.editors.request.scripts.apiSetQos') },
        { label: 'oh.setRetain(retain)', desc: t('workbench.editors.request.scripts.apiSetRetain') },
        { label: 'oh.setUserProperty(name, value)', desc: t('workbench.editors.request.scripts.apiSetUserProperty') },
        { label: 'oh.drop()', desc: t('workbench.editors.request.scripts.apiDrop') },
        session,
      ];
    case 'mqtt-on-message':
      return [
        { label: 'oh.message', desc: t('workbench.editors.request.scripts.apiMqttMessage') },
        { label: 'oh.publish(topic, payload, options)', desc: t('workbench.editors.request.scripts.apiPublish') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    case 'mqtt-after-close':
      return [
        { label: 'oh.close', desc: t('workbench.editors.request.scripts.apiMqttClose') },
        { label: 'oh.test(name, fn)', desc: t('workbench.editors.request.scripts.apiTest') },
        session,
      ];
    default:
      return [];
  }
}
