/**
 * The helper client — the node side of the framed stdio protocol
 * (the request-engine H3-protocol design). ONE long-lived helper per
 * host process, spawned lazily on the first `'3'` send; frames carry a
 * request id and concurrent sends multiplex over one stdio pair.
 * Sends queue until the helper's HELLO arrives (protocol-int mismatch
 * kills it and fails them all); a crash / EOF rejects every in-flight
 * send and the NEXT send respawns; the helper's own idle-exit (a clean
 * exit code with nothing in flight) resets quietly. A send racing the
 * idle-exit window — clean exit code, its frames never read, no
 * RESPONSE_HEAD back — is replayed ONCE on a fresh helper (the helper
 * provably never dialed for it: had it started the request, its idle
 * check would not have fired); a send already past its response head
 * cannot be replayed and fails as a crash. Frames for an id the client
 * no longer tracks (canceled, already failed) are dropped — the
 * protocol's cancel race contract.
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

/** One in-flight send's client-side state. The wire inputs stay held
 *  until the response head arrives so an idle-exit race can replay the
 *  send on a fresh helper; the body reference releases at the head
 *  (past the replay boundary there is nothing to replay). */
interface PendingEntry {
  handlers: H3ResponseHandlers;
  /** RESPONSE_HEAD crossed — the exchange is past the replay boundary. */
  headSeen: boolean;
  /** Replayed once after an idle-exit race — never a second time. */
  replayed: boolean;
  head: H3RequestHead & { bodyBytes: number };
  body: Buffer | null;
}

export function createH3HelperClient(options: H3HelperClientOptions): H3HelperClient {
  const helloTimeoutMs = options.helloTimeoutMs ?? DEFAULT_HELLO_TIMEOUT_MS;
  let proc: HelperProcess | null = null;
  let helloSeen = false;
  let helloTimer: NodeJS.Timeout | null = null;
  let decoder = new H3FrameDecoder();
  let nextId = 1;
  const pending = new Map<number, PendingEntry>();
  // Frames buffered between spawn and HELLO — the helper only speaks
  // after its HELLO, so nothing is lost by holding ours too.
  let preHello: Buffer[] = [];

  const failAll = (err: H3HelperFailure): void => {
    const entries = [...pending.values()];
    pending.clear();
    preHello = [];
    for (const entry of entries) entry.handlers.onError(err);
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
    // write()'s backpressure answer is deliberately unread: request
    // bodies are already whole in memory (every pipeline buffers
    // them), so the stream buffer transiently holds at most one
    // body's bytes while the pipe drains.
    proc.stdin.write(frame);
  };

  /** Write one send's frames — the head, then the body chunked with a
   *  closing REQUEST_END when one is announced. Also the replay path:
   *  re-encoding from the entry's held inputs keeps replay identical
   *  to the first dispatch. */
  const sendFrames = (id: number, entry: PendingEntry): void => {
    write(encodeH3Frame(H3_FRAME.REQUEST, id, Buffer.from(JSON.stringify(entry.head), 'utf8')));
    const body = entry.body;
    if (body !== null && body.length > 0) {
      for (let offset = 0; offset < body.length; offset += BODY_CHUNK_BYTES) {
        write(encodeH3Frame(H3_FRAME.REQUEST_BODY, id, body.subarray(offset, offset + BODY_CHUNK_BYTES)));
      }
      write(encodeH3Frame(H3_FRAME.REQUEST_END, id));
    }
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
    const entry = pending.get(frame.id);
    if (entry === undefined) return;
    switch (frame.type) {
      case H3_FRAME.RESPONSE_HEAD:
        // Past the replay boundary — release the held body bytes; the
        // head object itself is small and the entry dies at END/ERROR.
        entry.headSeen = true;
        entry.body = null;
        entry.handlers.onHead(JSON.parse(frame.payload.toString('utf8')));
        return;
      case H3_FRAME.RESPONSE_BODY:
        // The decoder's payload views its shared buffer — copy so the
        // chunk survives the next push's reassembly.
        entry.handlers.onBody(Buffer.from(frame.payload));
        return;
      case H3_FRAME.RESPONSE_TRAILERS:
        entry.handlers.onTrailers(JSON.parse(frame.payload.toString('utf8')));
        return;
      case H3_FRAME.RESPONSE_END:
        pending.delete(frame.id);
        entry.handlers.onEnd();
        return;
      case H3_FRAME.ERROR: {
        pending.delete(frame.id);
        const error: H3ErrorFrame = JSON.parse(frame.payload.toString('utf8'));
        entry.handlers.onError(new H3HelperFailure(error.code, error.message));
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
      if (exitCode === 0) {
        // The helper's idle-exit: a clean exit is the lifecycle
        // working, not a crash — quiet reset, the next send respawns.
        proc = null;
        helloSeen = false;
        preHello = [];
        if (helloTimer !== null) {
          clearTimeout(helloTimer);
          helloTimer = null;
        }
        // A send past its response head cannot be replayed (the wire
        // answered once already), nor can one that already rode a
        // replay: those fail as a crash. A send whose frames the
        // exiting helper never read (no head back, never replayed) is
        // replayed ONCE on a fresh helper — safe, because a helper
        // with a request underway never idle-exits, so no dial ever
        // happened for it.
        const crashed = new H3HelperFailure(
          'helper-crashed',
          'The HTTP/3 helper exited mid-send — the send failed; the next send restarts it.',
        );
        for (const [id, entry] of [...pending]) {
          if (entry.headSeen || entry.replayed) {
            pending.delete(id);
            entry.handlers.onError(crashed);
          }
        }
        if (pending.size === 0) return;
        try {
          ensureProcess();
        } catch (err) {
          failAll(err instanceof H3HelperFailure ? err : new H3HelperFailure('helper-spawn-failed', String(err)));
          return;
        }
        for (const [id, entry] of pending) {
          entry.replayed = true;
          sendFrames(id, entry);
        }
        return;
      }
      teardown(
        new H3HelperFailure(
          'helper-crashed',
          `The HTTP/3 helper exited unexpectedly${exitCode !== null ? ` (code ${exitCode})` : ''} — in-flight HTTP/3 sends failed; the next send restarts it.`,
        ),
      );
    });
    spawned.stdout.on('data', (chunk: Buffer) => {
      if (proc !== spawned) return;
      // The guard covers frame REASSEMBLY and frame CONSUMPTION alike:
      // a payload that should be JSON but isn't (a corrupt or
      // mismatched binary) must tear the session down as a corrupt
      // stream, never escape a 'data' listener as an uncaught
      // exception that kills the host process.
      try {
        for (const frame of decoder.push(chunk)) onFrame(frame);
      } catch (err) {
        teardown(new H3HelperFailure('helper-corrupt-stream', err instanceof Error ? err.message : String(err)));
      }
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
      const bodyBytes = body?.length ?? 0;
      const entry: PendingEntry = {
        handlers,
        headSeen: false,
        replayed: false,
        head: { ...head, bodyBytes },
        body: body !== undefined && bodyBytes > 0 ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : null,
      };
      pending.set(id, entry);
      sendFrames(id, entry);
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
