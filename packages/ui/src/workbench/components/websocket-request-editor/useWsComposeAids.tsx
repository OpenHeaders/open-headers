/**
 * useWsComposeAids — the AsyncAPI spec binding and its compose aids:
 * the linked spec's census derived live (ids-only link, nothing
 * cached), "Use example message" options with pre-computed synthesis
 * over the ratified subset (unsupported payloads render disabled,
 * never silently filtered), the apply gesture (pretty JSON into the
 * message editor; the socketio flavor maps it to the single-element
 * arguments array and prefills the event name, the raw flavor flips
 * the display mode to JSON), and the AsyncAPI tab's channel-browser
 * tree.
 */

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import {
  AsyncApiParseError,
  parseAsyncApi,
  synthesizeExamplePayload,
  type AsyncApiCensus,
  type AsyncApiMessage,
} from '@openheaders/core/asyncapi';
import type { WebSocketSpecLink } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import type { TreeDataNode } from 'antd';
import type React from 'react';
import { type Dispatch, type SetStateAction, useCallback, useMemo } from 'react';
import type { WebSocketDraft } from './draft';

export interface WsExampleMessageOption {
  key: string;
  label: string;
  message: AsyncApiMessage;
  synth: { value: unknown } | null;
}

export interface WsComposeAids {
  asyncapiSpecs: ReturnType<typeof useSpecs>;
  linkedSpec: ReturnType<typeof useSpecs>[number] | null;
  census: { census: AsyncApiCensus | null; parseError: string | null };
  exampleMessages: WsExampleMessageOption[];
  applyExampleMessage: (key: string) => void;
  browserTree: TreeDataNode[];
  handleBrowserSelect: (keys: React.Key[]) => void;
}

interface UseWsComposeAidsInput {
  specLink: WebSocketSpecLink | undefined;
  workspaceId: string | null;
  socketioFlavor: boolean;
  setDraft: Dispatch<SetStateAction<WebSocketDraft>>;
  /** An example landed on the compose surface — switch to Message. */
  onApplied: () => void;
}

export function useWsComposeAids({
  specLink,
  workspaceId,
  socketioFlavor,
  setDraft,
  onApplied,
}: UseWsComposeAidsInput): WsComposeAids {
  const t = useT();
  const specs = useSpecs(workspaceId);
  const asyncapiSpecs = useMemo(() => specs.filter((s) => s.format === 'asyncapi'), [specs]);
  const linkedSpec = useMemo(
    () => (specLink ? (asyncapiSpecs.find((s) => s.uid === specLink.specUid) ?? null) : null),
    [asyncapiSpecs, specLink],
  );

  // Census derived live from the linked spec's root file — issues
  // reported, parse failure surfaced, nothing cached (ids-only link).
  const census = useMemo((): { census: AsyncApiCensus | null; parseError: string | null } => {
    if (!linkedSpec) return { census: null, parseError: null };
    const root = linkedSpec.files.find((f) => f.uid === linkedSpec.rootFileUid);
    if (!root) return { census: null, parseError: null };
    try {
      return { census: parseAsyncApi(root.content), parseError: null };
    } catch (err) {
      return { census: null, parseError: err instanceof AsyncApiParseError ? err.message : String(err) };
    }
  }, [linkedSpec]);

  // Channel messages first (channel-local keys — the vendor outline
  // shape), then reusable component messages not shadowed by a channel
  // entry. Each option pre-computes its synthesis over the ratified
  // subset so unsupported payloads (no schema, combinators) render
  // disabled instead of failing on pick.
  const exampleMessages = useMemo(() => {
    const c = census.census;
    if (!c) return [];
    const seen = new Set<string>();
    const out: WsExampleMessageOption[] = [];
    const add = (scope: string, message: AsyncApiMessage) => {
      const key = `${scope}:${message.name}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        key,
        label: message.name,
        message,
        synth: synthesizeExamplePayload(message.payload, c.componentSchemas),
      });
    };
    for (const channel of c.channels) for (const message of channel.messages) add(channel.name, message);
    for (const message of c.componentMessages) add('components', message);
    return out;
  }, [census]);

  // Apply one censused message to the compose surface: the synthesized
  // payload lands in the message editor (pretty JSON); the socketio
  // flavor maps it to the single-element arguments array and prefills
  // the event name with the message key; the raw flavor flips the
  // display mode to JSON.
  const applyExampleMessage = useCallback(
    (key: string) => {
      const option = exampleMessages.find((m) => m.key === key);
      if (!option || option.synth === null) return;
      const text = JSON.stringify(socketioFlavor ? [option.synth.value] : option.synth.value, null, 2);
      setDraft((d) => ({
        ...d,
        message: text,
        ...(socketioFlavor ? { eventName: option.message.name } : { messageFormat: 'json' as const }),
      }));
      onApplied();
    },
    [exampleMessages, socketioFlavor, setDraft, onApplied],
  );

  // Channel browser (AsyncAPI tab) — the census rendered for
  // pick-and-prefill: channels nest their messages (channel-local
  // keys), operations carry direction glyphs, components list the
  // reusable messages. Message rows are the only selectable nodes —
  // selecting one applies its example to the compose surface (the
  // Message-tab picker's twin gesture).
  const browserTree = useMemo((): TreeDataNode[] => {
    const c = census.census;
    if (!c) return [];
    const nodes: TreeDataNode[] = [];
    if (c.servers.length > 0) {
      nodes.push({
        key: 'g:servers',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.servers'),
        children: c.servers.map((s) => ({
          key: `srv:${s.name}`,
          selectable: false,
          title: [s.name, s.protocol, s.host].filter((part) => part !== null && part !== undefined).join(' · '),
        })),
      });
    }
    if (c.channels.length > 0) {
      nodes.push({
        key: 'g:channels',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.channels'),
        children: c.channels.map((channel) => ({
          key: `ch:${channel.name}`,
          selectable: false,
          title: channel.address !== null && channel.address !== channel.name
            ? `${channel.name} · ${channel.address}`
            : channel.name,
          children: channel.messages.map((message) => ({
            key: `msg:${channel.name}:${message.name}`,
            title: message.name,
          })),
        })),
      });
    }
    if (c.operations.length > 0) {
      nodes.push({
        key: 'g:operations',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.operations'),
        children: c.operations.map((op) => ({
          key: `op:${op.name}`,
          selectable: false,
          icon: op.action === 'send' ? <ArrowUpOutlined /> : <ArrowDownOutlined />,
          title: op.channelName !== null ? `${op.name} · ${op.channelName}` : op.name,
        })),
      });
    }
    if (c.componentMessages.length > 0) {
      nodes.push({
        key: 'g:components',
        selectable: false,
        title: t('workbench.editors.websocket.spec.browser.components'),
        children: c.componentMessages.map((message) => ({
          key: `msg:components:${message.name}`,
          title: message.name,
        })),
      });
    }
    return nodes;
  }, [census, t]);

  const handleBrowserSelect = useCallback(
    (keys: React.Key[]) => {
      const key = keys[0];
      if (typeof key !== 'string' || !key.startsWith('msg:')) return;
      applyExampleMessage(key.slice('msg:'.length));
    },
    [applyExampleMessage],
  );

  return { asyncapiSpecs, linkedSpec, census, exampleMessages, applyExampleMessage, browserTree, handleBrowserSelect };
}
