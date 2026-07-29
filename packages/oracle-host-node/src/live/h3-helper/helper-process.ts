/**
 * The helper client — the node side of the framed stdio protocol
 * (`docs/REQUEST_ENGINE_H3_PROTOCOL.md`). ONE long-lived helper per
 * host process, spawned lazily on the first `'3'` send; frames carry a
 * request id and concurrent sends multiplex over one stdio pair.
 * Sends queue until the helper's HELLO arrives (protocol-int mismatch
 * kills it and fails them all); a crash / EOF rejects every in-flight
 * send and the NEXT send respawns. Frames for an id the client no
 * longer tracks (canceled, already failed) are dropped — the protocol's
 * cancel race contract.
 */

import { type ChildProcessByStdio, spawn } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { encodeH3Frame, H3FrameDecoder } from './framing';
import {
  H3_FRAME,
  H3_PROTOCOL_VERSION,
  type H3ErrorFrame,
  type H3HeaderPair,
  type H3Hello,
  type H3RequestHead,
  type H3ResponseHead,
} from './protocol';

/** A terminal failure the helper reported (a protocol ERROR frame) or
 *  the client minted (crash, handshake, spawn). `code` is the frame's
 *  closed-set code, or a client-minted `helper-*` code. */
export class H3HelperFailure extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'H3HelperFailure';
    this.code = code;
  }
}

export interface H3ResponseHandlers {
  onHead(head: H3ResponseHead): void;
  onBody(chunk: Buffer): void;
  onTrailers(trailers: H3HeaderPair[]): void;
  onEnd(): void;
  onError(err: H3HelperFailure): void;
}

export interface H3HelperClient {
  /** Dispatch one hop. `body` rides as REQUEST_BODY frames after the
   *  head (the head's `bodyBytes` is stamped here). Exactly one of
   *  `onEnd` / `onError` terminates the exchange; `cancel()` forgets
   *  the id immediately and tells the helper to reset the stream. */
  request(head: H3RequestHead, body: Uint8Array | undefined, handlers: H3ResponseHandlers): { cancel(): void };
  /** Graceful shutdown: closes the helper's stdin (its drain-and-exit
   *  signal) and fails anything still in flight. */
  dispose(): void;
}

export interface H3HelperClientOptions {
  binaryPath: string;
  /** Extra argv — the test seam (`process.execPath` + a script). */
  args?: string[];
  helloTimeoutMs?: number;
}

const DEFAULT_HELLO_TIMEOUT_MS = 5000;
const BODY_CHUNK_BYTES = 64 * 1024;

type HelperProcess = ChildProcessByStdio<Writable, Readable, null>;

export function createH3HelperClient(options: H3HelperClientOptions): H3HelperClient {
  const helloTimeoutMs = options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS;
  let proc: HelperProcess | null = null;
  let helloSeen = false;
  let helloTimer: NodeJS.Timeout | null = null;
  let decoder = new H3FrameDecoder();
  let nextId = 1;
  const pending = new Map<number, H3ResponseHandlers>();
  // Frames buffered between spawn and HELLO — the helper only speaks
  // after its HELLO, so nothing is lost by holding ours too.
  let preHello: Buffer[] = [];

  const failAll = (err: H3HelperFailure): void => {
    const handlers = [...pending.values()];
    pending.clear();
    preHello = [];
    for (const h of handlers) h.onError(err);
  };

  const teardown = (err: H3HelperFailure): void => {
    if (helloTimer !== null) {
      clearTimeout(helloTimer);
      helloTimer = null;
    }
    const dead = proc;
    proc = null;
    helloSeen = false;
    dead?.kill();
    failAll(err);
  };

  const write = (frame: Buffer): void => {
    if (proc === null) return;
    if (!helloSeen) {
      preHello.push(frame);
      return;
    }
    proc.stdin.write(frame);
  };

  const onFrame = (frame: { type: number; id: number; payload: Buffer }): void => {
    if (frame.type === H3_FRAME.HELLO) {
      const hello: H3Hello = JSON.parse(frame.payload.toString('utf8'));
      if (hello.protocol !== H3_PROTOCOL_VERSION) {
        teardown(
          new H3HelperFailure(
            'helper-protocol-mismatch',
            `The HTTP/3 helper speaks protocol ${hello.protocol}, this app expects ${H3_PROTOCOL_VERSION} — the helper binary and the app are out of step.`,
          ),
        );
        return;
      }
      helloSeen = true;
      if (helloTimer !== null) {
        clearTimeout(helloTimer);
        helloTimer = null;
      }
      const buffered = preHello;
      preHello = [];
      for (const bufferedFrame of buffered) proc?.stdin.write(bufferedFrame);
      return;
    }
    if (frame.type === H3_FRAME.ERROR && frame.id === 0) {
      const error: H3ErrorFrame = JSON.parse(frame.payload.toString('utf8'));
      teardown(new H3HelperFailure(error.code, error.message));
      return;
    }
    const handlers = pending.get(frame.id);
    if (handlers === undefined) return;
    switch (frame.type) {
      case H3_FRAME.RESPONSE_HEAD:
        handlers.onHead(JSON.parse(frame.payload.toString('utf8')));
        return;
      case H3_FRAME.RESPONSE_BODY:
        // The decoder's payload views its shared buffer — copy so the
        // chunk survives the next push's reassembly.
        handlers.onBody(Buffer.from(frame.payload));
        return;
      case H3_FRAME.RESPONSE_TRAILERS:
        handlers.onTrailers(JSON.parse(frame.payload.toString('utf8')));
        return;
      case H3_FRAME.RESPONSE_END:
        pending.delete(frame.id);
        handlers.onEnd();
        return;
      case H3_FRAME.ERROR: {
        pending.delete(frame.id);
        const error: H3ErrorFrame = JSON.parse(frame.payload.toString('utf8'));
        handlers.onError(new H3HelperFailure(error.code, error.message));
        return;
      }
      default:
        return;
    }
  };

  const ensureProcess = (): void => {
    if (proc !== null) return;
    decoder = new H3FrameDecoder();
    helloSeen = false;
    preHello = [];
    let spawned: HelperProcess;
    try {
      spawned = spawn(options.binaryPath, options.args ?? [], { stdio: ['pipe', 'pipe', 'inherit'] });
    } catch (err) {
      throw new H3HelperFailure(
        'helper-spawn-failed',
        `Could not start the HTTP/3 helper at ${options.binaryPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    proc = spawned;
    spawned.on('error', (err) => {
      if (proc !== spawned) return;
      teardown(new H3HelperFailure('helper-spawn-failed', `The HTTP/3 helper failed to start: ${err.message}`));
    });
    spawned.on('exit', (exitCode) => {
      if (proc !== spawned) return;
      teardown(
        new H3HelperFailure(
          'helper-crashed',
          `The HTTP/3 helper exited unexpectedly${exitCode !== null ? ` (code ${exitCode})` : ''} — in-flight HTTP/3 sends failed; the next send restarts it.`,
        ),
      );
    });
    spawned.stdout.on('data', (chunk: Buffer) => {
      if (proc !== spawned) return;
      let frames: ReturnType<H3FrameDecoder['push']>;
      try {
        frames = decoder.push(chunk);
      } catch (err) {
        teardown(new H3HelperFailure('helper-corrupt-stream', err instanceof Error ? err.message : String(err)));
        return;
      }
      for (const frame of frames) onFrame(frame);
    });
    spawned.stdin.on('error', () => {
      // A write racing the helper's death (EPIPE) — the exit handler
      // owns the teardown; swallowing keeps the race from crashing the
      // host process.
    });
    helloTimer = setTimeout(() => {
      if (proc === spawned && !helloSeen) {
        teardown(
          new H3HelperFailure('helper-no-hello', 'The HTTP/3 helper started but never completed its handshake.'),
        );
      }
    }, helloTimeoutMs);
    helloTimer.unref?.();
  };

  return {
    request(head, body, handlers) {
      const id = nextId++;
      try {
        ensureProcess();
      } catch (err) {
        queueMicrotask(() =>
          handlers.onError(
            err instanceof H3HelperFailure ? err : new H3HelperFailure('helper-spawn-failed', String(err)),
          ),
        );
        return { cancel: () => {} };
      }
      pending.set(id, handlers);
      const bodyBytes = body?.length ?? 0;
      write(encodeH3Frame(H3_FRAME.REQUEST, id, Buffer.from(JSON.stringify({ ...head, bodyBytes }), 'utf8')));
      if (body !== undefined && bodyBytes > 0) {
        const buffer = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
        for (let offset = 0; offset < buffer.length; offset += BODY_CHUNK_BYTES) {
          write(encodeH3Frame(H3_FRAME.REQUEST_BODY, id, buffer.subarray(offset, offset + BODY_CHUNK_BYTES)));
        }
        write(encodeH3Frame(H3_FRAME.REQUEST_END, id));
      }
      return {
        cancel: () => {
          if (!pending.delete(id)) return;
          write(encodeH3Frame(H3_FRAME.CANCEL, id));
        },
      };
    },
    dispose() {
      const dead = proc;
      proc = null;
      helloSeen = false;
      if (helloTimer !== null) {
        clearTimeout(helloTimer);
        helloTimer = null;
      }
      dead?.stdin.end();
      failAll(new H3HelperFailure('helper-disposed', 'The HTTP/3 helper is shutting down.'));
    },
  };
}

/** The host-process-wide shared client (the one-helper discipline).
 *  Re-created if the resolved binary path changes (a dev override
 *  swap); the transport's injectable `h3Client` option bypasses it. */
let shared: { path: string; client: H3HelperClient } | null = null;

export function sharedH3HelperClient(binaryPath: string): H3HelperClient {
  if (shared !== null && shared.path === binaryPath) return shared.client;
  shared?.client.dispose();
  shared = { path: binaryPath, client: createH3HelperClient({ binaryPath }) };
  return shared.client;
}
