/**
 * The rail's `(i)` cards — one per script slot: kicker · title · the
 * kind's lifecycle card · one sentence · the `oh.*` API glossary (API
 * labels are code, only the descriptions localize).
 *
 * The lifecycle card is the shared `ExampleCard` over the kind's hooks
 * in wire order — one line per hook, opened by the hook's own label,
 * the wire moment with one concrete value first, then the fields of
 * that hook's `oh` view — with the row's own line lit. Reading down
 * the rail walks the lifecycle; the other lines stay quiet. The card
 * is the kind's, not the level's: the container mount shows the same
 * card, so the WebSocket card carries its Socket.IO facts as `S.IO`
 * tokens. Tokens ride raw (the card idiom); the caption is the
 * group's. `LIFECYCLE_LINE` is exhaustive over `ScriptKind` — a
 * widened kind cannot ship without its line, nor without its card.
 */

import type { ScriptKind, SessionScriptKind } from '@openheaders/core/scripts';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  EXAMPLE_CARD_POPOVER_WIDTH,
  ExampleCard,
  type ExampleCardLine,
  type InfoPopoverContent,
} from '@openheaders/ui/shared/info-popover';
import { type ScriptSlotGroup, scriptSlotGroupOf } from './script-slots';

interface LifecycleLine {
  /** The wire moment the hook sits at, with one concrete value. */
  wire: string;
  /** The fields of the hook's `oh` view — what it sees there. */
  facts: readonly string[];
}

const LIFECYCLE_LINE: Readonly<Record<ScriptKind, LifecycleLine>> = {
  'pre-request': { wire: 'POST https://api.openheaders.com/v1/users', facts: ['headers', 'params', 'body'] },
  'post-response': { wire: '200', facts: ['143 ms', 'headers', 'body'] },
  'grpc-before-invoke': { wire: 'CALL books.v1.Library/WatchBooks', facts: ['metadata', 'message'] },
  'grpc-on-message': { wire: 'FRAME ↑ ↓', facts: ['type', 'decoded value', 'index'] },
  'grpc-after-response': {
    wire: 'TRAILERS status 0 OK',
    facts: ['headers', 'trailers', 'sent', 'received', 'duration'],
  },
  'ws-before-connect': {
    wire: 'CONNECT wss://api.openheaders.com/v1/stream',
    facts: ['headers', 'params', 'subprotocols', 'attempt'],
  },
  'ws-before-send': { wire: 'SEND ↑ {"type":"subscribe"}', facts: ['text', 'binary', 'S.IO event', 'S.IO ack'] },
  'ws-on-message': { wire: 'MESSAGE ↓ {"type":"tick"}', facts: ['text', 'bytes', 'index'] },
  'ws-after-close': { wire: 'CLOSE 1000', facts: ['reason', 'clean', 'messages', 'dropped', 'duration'] },
  'mqtt-before-connect': {
    wire: 'CONNECT mqtts://broker.openheaders.com:8883',
    facts: ['client id', 'credentials', 'will', 'subscriptions', 'user properties'],
  },
  'mqtt-before-publish': { wire: 'PUBLISH ↑ sensors/1/temp', facts: ['payload', 'QoS', 'retain', 'properties'] },
  'mqtt-on-message': { wire: 'PUBLISH ↓ sensors/2/temp', facts: ['payload', 'QoS', 'retain', 'dup', 'properties'] },
  'mqtt-after-close': {
    wire: 'DISCONNECT',
    facts: ['end', 'CONNACK', 'published', 'received', 'dropped', 'duration'],
  },
};

/** The token ids of one hook's line — its opener, its wire moment, its
 *  facts — so the row lights the whole line. */
function lineIds(kind: ScriptKind): string[] {
  return [kind, `${kind}:wire`, ...LIFECYCLE_LINE[kind].facts.map((_, i) => `${kind}:${i}`)];
}

// Module-scope so the diagram's component type keeps its identity
// across the rail's renders (the rows' own rule).
const ScriptLifecycleCard: React.FC<{ group: ScriptSlotGroup; kind: ScriptKind }> = ({ group, kind }) => {
  const t = useT();
  const lines: ExampleCardLine<string>[] = group.slots.map((slot) => {
    const [opener, wire, ...facts] = lineIds(slot.kind);
    const line = LIFECYCLE_LINE[slot.kind];
    return {
      opener: { id: opener, text: t(slot.labelKey) },
      tokens: [{ id: wire, text: line.wire }, ...facts.map((id, i) => ({ id, text: line.facts[i] }))],
    };
  });
  return <ExampleCard caption={t(group.captionKey)} lines={lines} lit={new Set(lineIds(kind))} />;
};

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
  const group = scriptSlotGroupOf(kind);
  const card =
    group !== undefined
      ? { diagram: <ScriptLifecycleCard group={group} kind={kind} />, maxWidth: EXAMPLE_CARD_POPOVER_WIDTH }
      : {};
  const kicker = t('workbench.editors.request.tab.scripts');
  const heading = t('workbench.editors.request.scripts.apiHeading');
  switch (kind) {
    case 'pre-request':
      return {
        title: t('workbench.editors.request.scripts.preInfoTitle'),
        kicker,
        ...card,
        summary: t('workbench.editors.request.scripts.preInfoSummary'),
        sections: [
          {
            heading,
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
        kicker,
        ...card,
        summary: t('workbench.editors.request.scripts.postInfoSummary'),
        sections: [
          {
            heading,
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
        kicker,
        ...card,
        summary: t(keys.summary),
        ...(glossary.length > 0 ? { sections: [{ heading, items: glossary }] } : {}),
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
