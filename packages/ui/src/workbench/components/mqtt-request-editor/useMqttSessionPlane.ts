/**
 * useMqttSessionPlane — the editor's whole session plane in one hook.
 *
 * Connect opens the live session through the `executeMqttRequest`
 * channel — answered in-process on node hosts (`requestRuntime`), and
 * IN the page realm on surfaces carrying the `mqttPageSession`
 * capability (MQTT-over-WebSocket on the platform socket, so ws(s)://
 * URLs connect; mqtt(s):// tcp schemes gate with the honest named
 * copy — never a silent downgrade to ws — and configured node-only
 * knobs surface in the session pane's Connect-side honesty notice).
 * The hook publishes the page-session resolution factory while a
 * page-capability editor is mounted so the page host resolves {{refs}}
 * from the renderer scopes. In flight Connect MORPHS to Disconnect
 * (the clean DISCONNECT via `closeMqttSession`), Send publishes
 * through `publishMqttMessage`, and the Topics grid's live Subscribe
 * switches ride `setMqttSubscription`, marking each row with its
 * SUBACK grant (QoS downgrades honest): the stored table stays the
 * DRAFT — live toggles never edit the entity (the ratified
 * publication-gate idiom). Save Response freezes a settled session
 * that opened into an MqttResponseExample.
 */

import { hostBridge, type MqttPublishWire } from '@openheaders/core/bridge';
import { getCapability } from '@openheaders/core/capabilities';
import type { ExecutedMqttSnapshot, MqttRequest as MqttRequestEntity, MqttTopicRow } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getMqttResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/mqtt-response-example-sync-mirror';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useVariableResolverInputs } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  applyMqttResponseExampleCreate,
  nextMqttExampleName,
} from '@openheaders/ui/shared/sync/mqtt-response-example-write-client';
import { App } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  capturedMqttRequestFromDraft,
  capturedMqttResponseFromSnapshot,
} from '../mqtt-response-example/mqtt-example-draft';
import { schemeOf } from './compose';
import { buildMqttRequestUpdates, type MqttDraft, trimTopicRows } from './draft';
import { makeMqttPageResolutionFactory, publishMqttPageResolutionFactory } from './mqtt-page-session';
import { type LiveMqttSession, type MqttSessionTiming, useLiveMqttSession } from './useLiveMqttSession';

/** One row's live SUBACK/UNSUBACK truth while the session is open —
 *  the stored table stays the draft; this map marks it. */
export interface LiveSubscriptionMark {
  subscribed: boolean;
  grantCode: number | null;
}

interface UseMqttSessionPlaneInput {
  entity: MqttRequestEntity | null;
  draft: MqttDraft;
  workspaceId: string | null;
  v5: boolean;
  /** "Save Response" landed — open the minted example's viewer tab. */
  onOpenMqttResponseExample?: ((uid: string, name: string, mqttRequestUid: string) => void) | undefined;
}

export interface MqttSessionPlane {
  inFlight: boolean;
  /** True while the session is open (CONNACK accepted, not settled). */
  sessionOpen: boolean;
  snapshot: ExecutedMqttSnapshot | null;
  timing: MqttSessionTiming | null;
  /** The open session's live feed; null outside one. */
  live: LiveMqttSession | null;
  /** Per-knob honesty notice for a page-realm session; null = none. */
  hostNotice: string | null;
  /** Honest gate copy for a disabled Connect; null = enabled. */
  connectDisabledReason: string | null;
  /** Live Subscribe-toggle truth by row uid while the session is open. */
  liveSubs: ReadonlyMap<string, LiveSubscriptionMark>;
  handleConnect: () => Promise<void>;
  handleDisconnect: () => void;
  handlePublish: (message: MqttPublishWire) => Promise<void>;
  handleLiveSubscriptionToggle: (row: MqttTopicRow, subscribe: boolean) => Promise<void>;
  handleClearSession: () => void;
  handleSaveResponse: () => Promise<void>;
  canSaveResponse: boolean;
}

export function useMqttSessionPlane({
  entity,
  draft,
  workspaceId,
  v5,
  onOpenMqttResponseExample,
}: UseMqttSessionPlaneInput): MqttSessionPlane {
  const { message: toast } = App.useApp();
  const t = useT();
  const { executeMqtt } = useRequests();

  const requestRuntimeKind = getCapability('requestRuntime')?.() ?? 'browser';
  const nodeHost = requestRuntimeKind === 'node';
  const pageSession = !nodeHost && (getCapability('mqttPageSession')?.() ?? false);
  const [inFlight, setInFlight] = useState(false);
  const [snapshot, setSnapshot] = useState<ExecutedMqttSnapshot | null>(null);
  const [timing, setTiming] = useState<MqttSessionTiming | null>(null);
  const [hostNotice, setHostNotice] = useState<string | null>(null);
  const activeSendIdRef = useRef<string | null>(null);
  const liveSession = useLiveMqttSession();

  // Page-session resolution publisher — the host executing in this
  // page realm injects the CURRENT factory into the executor at
  // Connect, so republish on every renderer-scope change while an
  // MQTT editor is mounted (nothing can Connect without one).
  const resolverInputs = useVariableResolverInputs();
  useEffect(() => {
    if (!pageSession) return;
    publishMqttPageResolutionFactory(makeMqttPageResolutionFactory(resolverInputs));
  }, [pageSession, resolverInputs]);

  // Live Subscribe-toggle truth while the session is open — keyed by
  // row uid; seeded from the open-time SUBACK items (grants positional
  // over the enabled rows, in the executor's packet order), updated by
  // each rider's own grant. The stored table stays the DRAFT.
  const [liveSubs, setLiveSubs] = useState<ReadonlyMap<string, LiveSubscriptionMark>>(new Map());
  /** The open-time SUBSCRIBE groups' row uids, in the executor's
   *  packet order: rows without a Subscription Identifier ride one
   *  packet, each identified row its own. */
  const openSubGroupsRef = useRef<string[][]>([]);
  const consumedSubGroupsRef = useRef(0);

  useEffect(() => {
    const live = liveSession.live;
    if (live === null) return;
    const groups = openSubGroupsRef.current;
    let consumed = consumedSubGroupsRef.current;
    if (consumed >= groups.length) return;
    let seen = 0;
    const marks = new Map<string, LiveSubscriptionMark>();
    for (let i = 0; i < live.count && consumed < groups.length; i++) {
      const item = live.items[i];
      if (item.kind !== 'subscribed') continue;
      if (seen < consumedSubGroupsRef.current) {
        seen++;
        continue;
      }
      const uids = groups[consumed];
      item.grants.forEach((grant, index) => {
        const uid = uids[index];
        if (uid !== undefined) marks.set(uid, { subscribed: grant.reasonCode <= 2, grantCode: grant.reasonCode });
      });
      consumed++;
      seen++;
    }
    if (marks.size === 0) return;
    consumedSubGroupsRef.current = consumed;
    setLiveSubs((prev) => {
      const next = new Map(prev);
      for (const [uid, mark] of marks) next.set(uid, mark);
      return next;
    });
  }, [liveSession.live]);

  const handleConnect = useCallback(async () => {
    if (!entity || inFlight) return;
    // The CURRENT compose state connects — saved or not (the HTTP
    // editor's draft-send law); identity fields ride along verbatim.
    const draftEntity: MqttRequestEntity = {
      schemaVersion: 5,
      uid: entity.uid,
      path: entity.path,
      name: entity.name,
      ...buildMqttRequestUpdates(draft),
    };
    // The open-time SUBSCRIBE grouping mirrors the executor's: one
    // packet for the plain rows, one per Subscription Identifier —
    // grants map back onto rows positionally within each group.
    const enabledRows = trimTopicRows(draft.topics).filter((row) => row.subscribe !== false);
    const plainUids = enabledRows.filter((row) => row.subscriptionId === undefined || !v5).map((row) => row.uid);
    const idUids = v5
      ? enabledRows.filter((row) => row.subscriptionId !== undefined).map((row) => [row.uid])
      : [];
    openSubGroupsRef.current = [...(plainUids.length > 0 ? [plainUids] : []), ...idUids];
    consumedSubGroupsRef.current = 0;
    setLiveSubs(new Map());
    // Per-knob honesty on the page-session path: the platform socket
    // cannot skip TLS verification — a CONFIGURED knob is named for
    // the session's whole life instead of silently dropping (the
    // connect deadline DOES apply here).
    const inapplicableKnobs: string[] = [];
    if (pageSession && !draft.sslVerification) {
      inapplicableKnobs.push(t('workbench.editors.mqtt.session.knobSslVerify'));
    }
    setHostNotice(
      inapplicableKnobs.length > 0
        ? t('workbench.editors.mqtt.session.hostNotice', { knobs: inapplicableKnobs.join(', ') })
        : null,
    );
    const sendId = crypto.randomUUID();
    activeSendIdRef.current = sendId;
    setInFlight(true);
    setSnapshot(null);
    setTiming(null);
    liveSession.beginSession(sendId);
    const settled = await executeMqtt({ draft: draftEntity, sendId });
    const session = liveSession.takeSession();
    setTiming(session === null ? null : { ...session, endedAt: Date.now() });
    liveSession.endSession();
    activeSendIdRef.current = null;
    setInFlight(false);
    setLiveSubs(new Map());
    if (settled === null) {
      toast.error(t('workbench.editors.mqtt.session.connectFailed'));
      return;
    }
    setSnapshot(settled);
  }, [entity, inFlight, draft, v5, pageSession, executeMqtt, liveSession, toast, t]);

  // Disconnect morphs from Connect while the session is open — the
  // clean DISCONNECT; the pending RPC above resolves with the
  // whole-session snapshot once the connection closes.
  const handleDisconnect = useCallback(() => {
    const sendId = activeSendIdRef.current;
    if (!sendId) return;
    hostBridge.call('closeMqttSession', { sendId }).catch(() => {});
  }, []);

  // Publish one compose block — the executor resolves {{refs}} through
  // the resolver it built at Connect and decodes the payload per its
  // ENCODING; a failure reports here without touching the open session.
  const handlePublish = useCallback(
    async (message: MqttPublishWire) => {
      const sendId = activeSendIdRef.current;
      if (!sendId) return;
      const result = await hostBridge.call('publishMqttMessage', { sendId, message }).catch(() => null);
      if (result === null || !result.success) {
        toast.error(result?.error ?? t('workbench.editors.mqtt.session.sendFailed'));
      }
    },
    [toast, t],
  );

  // Live Subscribe toggle — rides the rider and marks the row; the
  // stored table (the draft) is never edited while the session is open.
  const handleLiveSubscriptionToggle = useCallback(
    async (row: MqttTopicRow, subscribe: boolean) => {
      const sendId = activeSendIdRef.current;
      if (!sendId) return;
      setLiveSubs((prev) => new Map(prev).set(row.uid, { subscribed: subscribe, grantCode: null }));
      const result = await hostBridge
        .call('setMqttSubscription', {
          sendId,
          subscription: {
            topicFilter: row.topicFilter,
            subscribe,
            ...(row.qos !== undefined ? { qos: row.qos } : {}),
            ...(v5 && row.noLocal !== undefined ? { noLocal: row.noLocal } : {}),
            ...(v5 && row.retainAsPublished !== undefined ? { retainAsPublished: row.retainAsPublished } : {}),
            ...(v5 && row.retainHandling !== undefined ? { retainHandling: row.retainHandling } : {}),
            ...(v5 && row.subscriptionId !== undefined ? { subscriptionId: row.subscriptionId } : {}),
          },
        })
        .catch(() => null);
      if (result === null || !result.success) {
        toast.error(result?.error ?? t('workbench.editors.mqtt.session.subscribeFailed'));
        setLiveSubs((prev) => new Map(prev).set(row.uid, { subscribed: !subscribe, grantCode: null }));
        return;
      }
      const grantCode = result.grantCode ?? null;
      setLiveSubs((prev) =>
        new Map(prev).set(row.uid, {
          subscribed: subscribe && (grantCode === null || grantCode <= 2),
          grantCode,
        }),
      );
    },
    [v5, toast, t],
  );

  const handleClearSession = useCallback(() => {
    setSnapshot(null);
    setTiming(null);
    setHostNotice(null);
  }, []);

  // Save Response — freeze the settled session as an example under
  // this request. Captures the AUTHORED compose state (draft fields as
  // edited, variable refs unresolved) plus the settled snapshot's
  // facts; only a session that opened can be captured (the gRPC
  // example's law).
  const handleSaveResponse = useCallback(async () => {
    if (!entity || !workspaceId || !snapshot || snapshot.outcome.kind !== 'connected') return;
    const response = capturedMqttResponseFromSnapshot(snapshot);
    if (response === null) return;
    const mirror = getMqttResponseExampleSyncMirrorForWorkspace(workspaceId);
    await mirror.hydrated;
    const name = nextMqttExampleName(mirror, entity.uid, entity.name);
    const result = await applyMqttResponseExampleCreate(
      {
        mqttRequestPath: entity.path,
        example: {
          mqttRequestUid: entity.uid,
          name,
          capturedAt: new Date().toISOString(),
          request: capturedMqttRequestFromDraft(draft),
          response,
        },
      },
      { workspaceId, surfaceId: 'workbench' },
    );
    if (result.ok) {
      toast.success(t('workbench.editors.mqtt.toast.savedExample', { name }));
      onOpenMqttResponseExample?.(result.mqttResponseExample.uid, name, entity.uid);
    } else {
      toast.error(
        'message' in result && result.message
          ? t('workbench.editors.mqtt.toast.saveExampleFailedDetail', { message: result.message })
          : t('workbench.editors.mqtt.toast.saveExampleFailed'),
      );
    }
  }, [entity, workspaceId, snapshot, draft, toast, onOpenMqttResponseExample, t]);

  const canSaveResponse = workspaceId !== null && snapshot !== null && snapshot.outcome.kind === 'connected';

  const sessionOpen = inFlight && liveSession.live !== null && liveSession.live.open !== null;

  // Connect gate: node hosts run every scheme; a page-session surface
  // runs ws(s):// natively and names the tcp-scheme limit honestly
  // (mqtt/mqtts dial a raw TCP socket no browser page can open — the
  // scheme is named, never silently downgraded to ws); a browser
  // surface without the capability keeps the honest disabled posture.
  const connectDisabledReason =
    !nodeHost && !pageSession
      ? t('workbench.editors.mqtt.connect.browserHost')
      : draft.url.trim() === ''
        ? t('workbench.editors.mqtt.connect.needsUrl')
        : pageSession && /^mqtts?:\/\//i.test(draft.url.trim())
          ? t('workbench.editors.mqtt.connect.tcpSchemeBrowser', { scheme: schemeOf(draft.url.trim()) })
          : null;

  return {
    inFlight,
    sessionOpen,
    snapshot,
    timing,
    live: liveSession.live,
    hostNotice,
    connectDisabledReason,
    liveSubs,
    handleConnect,
    handleDisconnect,
    handlePublish,
    handleLiveSubscriptionToggle,
    handleClearSession,
    handleSaveResponse,
    canSaveResponse,
  };
}
