/**
 * useExecutionPlace — the live wrapper over {@link resolveExecutionPlace}:
 * reads the capability markers once per render, the desktop app's
 * companion state through the ONE shared derivation
 * (`useDesktopCompanion` — the status row's), and hands the pure reader
 * the per-editor transport facts. The preference is Auto until Phase C
 * lands the settings layers.
 */

import { getCapability } from '@openheaders/core/capabilities';
import { useDesktopCompanion } from '@openheaders/ui/shared/status';
import { useMemo } from 'react';
import {
  type ExecutionPlaceMarkers,
  type ExecutionPlaceResolution,
  type ExecutionRequestKind,
  type MqttTransport,
  type PageSessionKnob,
  resolveExecutionPlace,
} from './resolve-execution-place';

export interface UseExecutionPlaceInput {
  kind: ExecutionRequestKind;
  mqttTransport?: MqttTransport;
  /** Memoized by the caller — identity drives the resolution memo. */
  inapplicableKnobs?: readonly PageSessionKnob[];
}

function readMarkers(): ExecutionPlaceMarkers {
  return {
    requestRuntime: getCapability('requestRuntime')?.() ?? 'browser',
    remoteRequestDispatch: getCapability('remoteRequestDispatch')?.() ?? null,
    grpcCompanionInvoke: getCapability('grpcCompanionInvoke')?.() ?? false,
    wsPageSession: getCapability('wsPageSession')?.() ?? false,
    mqttPageSession: getCapability('mqttPageSession')?.() ?? false,
  };
}

export function useExecutionPlace({
  kind,
  mqttTransport,
  inapplicableKnobs,
}: UseExecutionPlaceInput): ExecutionPlaceResolution {
  const { state: desktopApp, launchable } = useDesktopCompanion();
  const markers = readMarkers();
  const { requestRuntime, remoteRequestDispatch, grpcCompanionInvoke, wsPageSession, mqttPageSession } = markers;
  return useMemo(
    () =>
      resolveExecutionPlace({
        kind,
        markers: { requestRuntime, remoteRequestDispatch, grpcCompanionInvoke, wsPageSession, mqttPageSession },
        ...(mqttTransport !== undefined ? { mqttTransport } : {}),
        desktopApp,
        desktopAppLaunchable: launchable,
        ...(inapplicableKnobs !== undefined ? { inapplicableKnobs } : {}),
      }),
    [
      kind,
      requestRuntime,
      remoteRequestDispatch,
      grpcCompanionInvoke,
      wsPageSession,
      mqttPageSession,
      mqttTransport,
      desktopApp,
      launchable,
      inapplicableKnobs,
    ],
  );
}
