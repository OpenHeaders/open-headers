/**
 * The engine-readiness gate — the one answer to "can main serve the
 * renderer yet?".
 *
 * The window is created before the engine boots and mounts in parallel
 * with it, so a renderer can speak before anything is there to answer.
 * It is also never destroyed: what it says during boot is said once.
 * Both renderer-facing doors — `oh:rpc` (`rpc-queue.ts`) and the
 * lifeline wire (`install-lifeline-server.ts`) — hold what arrives early
 * on this gate and release it when the boot settles.
 *
 * One promise on purpose: its continuations run in the order they were
 * registered, so everything held — calls and port opens alike — is
 * released in the order the renderer said it.
 *
 * The boot SETTLING is the signal, success or failure: a failed boot
 * releases the held traffic to whatever was wired rather than hanging
 * the renderer on it.
 */

export interface EngineReadiness {
  /** True once the engine boot has settled. */
  isReady(): boolean;
  /** Resolves when the engine boot settles — at once if it already has. */
  whenReady(): Promise<void>;
  /** Mark the boot settled and release everything held. Idempotent. */
  signalReady(): void;
}

export function createEngineReadiness(): EngineReadiness {
  let ready = false;
  let release!: () => void;
  const settled = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    isReady: () => ready,
    whenReady: () => settled,
    signalReady() {
      ready = true;
      release();
    },
  };
}
