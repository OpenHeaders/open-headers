/**
 * gRPC script plane — the three hooks a call runs through the host's
 * script capability, mounted by the invoke executor beside its wire
 * legs (the WebSocket and MQTT planes' sibling on the one-call plane):
 * Before invoke ONCE before the wire (lenient: a failed level applies
 * nothing and the call composes on what the other levels left; the
 * session credential mints onto the result), On message per captured
 * frame BOTH directions (after the capture, which never waits; the
 * hook observes the message decoded through the linked spec's
 * registry and asserts — the upstream riders have no hook), After
 * response once at settle for a call that produced a response head.
 *
 * The serial queue, the mark cap, the fold → mark projection and the
 * per-event tally are the session plane core's
 * (`request-exec/session-script-plane.ts`); this module owns the gRPC
 * seams, how the invoke mutation lands on the next level's input, and
 * — unlike its siblings — WHERE a mark lands: the capture lives in two
 * wire legs (the buffered unary exchange, the streaming call), so the
 * plane keeps the marks itself, stamps each with the capture position
 * the leg reports, and hands them to the live sink the streaming leg
 * attaches once its emitter exists (the marks recorded before that —
 * Before invoke's — replay first).
 */

import { decodeMessage, type ProtoRegistry } from '@openheaders/core/proto';
import type {
  GrpcFrameSnapshot,
  GrpcInvokeSnapshot,
  GrpcResponseSnapshot,
  GrpcScriptKind,
} from '@openheaders/core/scripts';
import type {
  ExecutedGrpcScriptMark,
  ExecutedGrpcScripts,
  ExecutedScriptFold,
  ScriptEventSummary,
} from '@openheaders/core/types';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import {
  createSessionScriptPlaneCore,
  type SessionScriptChains,
  type SessionScriptPlaneDeps,
} from '../request-exec/session-script-plane';

/** The composed chain per hook — an empty chain means the hook never runs. */
export type GrpcScriptChains = SessionScriptChains<GrpcScriptKind>;

export type GrpcScriptPlaneDeps = Omit<SessionScriptPlaneDeps<GrpcScriptKind>, 'recordMark'>;

export interface GrpcScriptPlane {
  /** Run the Before invoke chain once; the call composes on what it
   *  returns (the input verbatim when no level mutated). */
  beforeInvoke(invoke: GrpcInvokeSnapshot): Promise<GrpcInvokeSnapshot>;
  /** Queue the On message chain for one captured frame — returns at
   *  once; the capture never waits. */
  onMessage(message: GrpcFrameSnapshot): void;
  /** Run the After response chain once — resolves after every queued
   *  hook (an On message still running) and the response hook settled. */
  afterResponse(response: GrpcResponseSnapshot): Promise<void>;
  /** The marks so far, each at the capture position it landed at. */
  readonly marks: readonly ExecutedGrpcScriptMark[];
  /** The capture position marks land at from here on — the wire leg
   *  reports its frame count after every capture. */
  captured(count: number): void;
  /** Attach the live sink — the marks recorded before it replay first,
   *  then every later mark emits as it lands. */
  attach(emit: (mark: ExecutedGrpcScriptMark) => void): void;
  /** The snapshot record; `undefined` when no hook ran. */
  summary(): ExecutedGrpcScripts | undefined;
  /** Release the call's runtime context — after {@link afterResponse}. */
  end(): void;
}

export function createGrpcScriptPlane(deps: GrpcScriptPlaneDeps): GrpcScriptPlane {
  const marks: ExecutedGrpcScriptMark[] = [];
  let position = 0;
  let emit: ((mark: ExecutedGrpcScriptMark) => void) | null = null;
  const core = createSessionScriptPlaneCore<GrpcScriptKind>({
    ...deps,
    recordMark: (mark) => {
      const item: ExecutedGrpcScriptMark = { ...mark, atIndex: position };
      marks.push(item);
      emit?.(item);
    },
  });

  let beforeInvoke: ExecutedScriptFold | undefined;
  let onMessage: ScriptEventSummary | undefined;
  let afterResponse: ExecutedScriptFold | undefined;

  return {
    beforeInvoke(invoke) {
      if (!core.has('grpc-before-invoke')) return Promise.resolve(invoke);
      return core.enqueue(async () => {
        let current = invoke;
        const fold = await core.run(
          'grpc-before-invoke',
          () => ({ kind: 'grpc-before-invoke', invoke: current }),
          (result) => {
            const m = result.sessionMutation;
            if (m === undefined || m.kind !== 'grpc-invoke') return undefined;
            current = {
              ...current,
              metadata: m.metadata ?? current.metadata,
              messageText: m.messageText ?? current.messageText,
            };
            return undefined;
          },
        );
        if (fold !== null) {
          core.record('grpc-before-invoke', fold);
          beforeInvoke = core.foldOf(fold);
        }
        return current;
      });
    },

    onMessage(message) {
      if (!core.has('grpc-on-message')) return;
      void core.enqueue(async () => {
        const fold = await core.run('grpc-on-message', () => ({ kind: 'grpc-on-message', message }));
        if (fold !== null) {
          core.record('grpc-on-message', fold);
          onMessage = core.tally(onMessage, fold);
        }
      });
    },

    afterResponse(response) {
      // Even a call with no After response script waits for its queued
      // hooks — an On message still running must land its mark before
      // the record settles.
      return core.enqueue(async () => {
        if (!core.has('grpc-after-response')) return;
        const fold = await core.run('grpc-after-response', () => ({ kind: 'grpc-after-response', response }));
        if (fold !== null) {
          core.record('grpc-after-response', fold);
          afterResponse = core.foldOf(fold);
        }
      });
    },

    marks,
    captured(count) {
      position = count;
    },
    attach(sink) {
      emit = sink;
      for (const mark of marks) sink(mark);
    },

    summary() {
      if (!core.ran()) return undefined;
      return {
        mode: core.mode,
        ...(beforeInvoke !== undefined ? { beforeInvoke } : {}),
        ...(onMessage !== undefined ? { onMessage } : {}),
        ...(afterResponse !== undefined ? { afterResponse } : {}),
        ...(core.marksCapped() ? { marksCapped: true as const } : {}),
      };
    },

    end: () => core.end(),
  };
}

/**
 * One captured frame as the On message hook sees it — the bytes
 * decoded through the registry as the declared type (`null` when the
 * type resolves to none, the bytes do not decode as it, or the frame
 * is compressed: v1 negotiates no compression). The capture stays
 * authoritative: the snapshot carries the bytes verbatim beside the
 * decode.
 */
export function grpcFrameSnapshot(
  registry: ProtoRegistry,
  frame: { direction: 'up' | 'down'; type: string | null; dataBase64: string; compressed: boolean; index: number },
): GrpcFrameSnapshot {
  let value: unknown = null;
  if (!frame.compressed && frame.type !== null && registry.messages.has(frame.type)) {
    const bytes = decodeBase64Bytes(frame.dataBase64);
    if (bytes !== null) {
      try {
        value = decodeMessage(registry, frame.type, bytes);
      } catch {
        value = null;
      }
    }
  }
  return {
    direction: frame.direction,
    type: frame.type,
    value,
    dataBase64: frame.dataBase64,
    compressed: frame.compressed,
    index: frame.index,
  };
}
