/**
 * useExecutionPlace — the live wrapper over {@link resolveExecutionPlace}:
 * `useExecutionPlaceFacts` reads the capability markers once per render,
 * the desktop app's companion state through the ONE shared derivation
 * (`useDesktopCompanion` — the status row's) and the workspace's server
 * through `useWorkspaceServer`; the pure reader over those facts
 * (`execution-place-facts.ts`) takes the per-editor transport facts and
 * the resolved preference (the per-send pick today; the settings layers
 * fold in beneath it) and names the send's TARGET beside the resolution.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { desktopAppRecord, useBackends } from '@openheaders/ui/shared/backend';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { useDesktopCompanion } from '@openheaders/ui/shared/status';
import { useSettingValue } from '@openheaders/ui/workbench/settings/hooks';
import { useMemo } from 'react';
import {
  type ExecutionPlaceFacts,
  type ExecutionPlaceRequest,
  type ResolvedExecutionPlace,
  resolveExecutionPlaceFromFacts,
} from './execution-place-facts';
import type { ExecutionPlaceMarkers } from './resolve-execution-place';
import { useWorkspaceServer } from './useWorkspaceServer';

export type UseExecutionPlaceInput = ExecutionPlaceRequest;
export type UseExecutionPlaceResult = ResolvedExecutionPlace;

function readMarkers(): ExecutionPlaceMarkers {
  return {
    requestRuntime: getCapability('requestRuntime')?.() ?? 'browser',
    remoteRequestDispatch: getCapability('remoteRequestDispatch')?.() ?? null,
    wsPageSession: getCapability('wsPageSession')?.() ?? false,
    mqttPageSession: getCapability('mqttPageSession')?.() ?? false,
    delegatedRequestDispatch: getCapability('delegatedRequestDispatch')?.() ?? false,
    delegatedSessionDispatch: getCapability('delegatedSessionDispatch')?.() ?? false,
    delegatedGrpcDispatch: getCapability('delegatedGrpcDispatch')?.() ?? false,
  };
}

/** The device's place facts, live — one identity until a fact changes. */
export function useExecutionPlaceFacts(): ExecutionPlaceFacts {
  const { state: desktopApp, launchable } = useDesktopCompanion();
  const backends = useBackends();
  const desktopAppBackendId = desktopAppRecord(getCurrentHost(), backends)?.id ?? null;
  const server = useWorkspaceServer();
  // This device's own consent for a server place — the one switch
  // under Settings › API Requests; false withholds the server leg
  // from every send on this device.
  const serverAllowed = useSettingValue('requests.allowServerExecution');
  const {
    requestRuntime,
    remoteRequestDispatch,
    wsPageSession,
    mqttPageSession,
    delegatedRequestDispatch,
    delegatedSessionDispatch,
    delegatedGrpcDispatch,
  } = readMarkers();
  return useMemo(
    () => ({
      markers: {
        requestRuntime,
        remoteRequestDispatch,
        wsPageSession,
        mqttPageSession,
        delegatedRequestDispatch,
        delegatedSessionDispatch,
        delegatedGrpcDispatch,
      },
      desktopApp,
      desktopAppLaunchable: launchable,
      desktopAppBackendId,
      server,
      serverAllowed,
    }),
    [
      requestRuntime,
      remoteRequestDispatch,
      wsPageSession,
      mqttPageSession,
      delegatedRequestDispatch,
      delegatedSessionDispatch,
      delegatedGrpcDispatch,
      desktopApp,
      launchable,
      desktopAppBackendId,
      server,
      serverAllowed,
    ],
  );
}

export function useExecutionPlace({
  kind,
  mqttTransport,
  inapplicableKnobs,
  preference,
  delegationKnobs,
  secretManagerReferences,
}: UseExecutionPlaceInput): UseExecutionPlaceResult {
  const facts = useExecutionPlaceFacts();
  return useMemo(
    () =>
      resolveExecutionPlaceFromFacts(facts, {
        kind,
        ...(mqttTransport !== undefined ? { mqttTransport } : {}),
        ...(inapplicableKnobs !== undefined ? { inapplicableKnobs } : {}),
        ...(preference !== undefined ? { preference } : {}),
        ...(delegationKnobs !== undefined ? { delegationKnobs } : {}),
        ...(secretManagerReferences !== undefined ? { secretManagerReferences } : {}),
      }),
    [facts, kind, mqttTransport, inapplicableKnobs, preference, delegationKnobs, secretManagerReferences],
  );
}
