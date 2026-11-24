/**
 * Surface viewers — which renderer surfaces have someone looking.
 *
 * The primary window is tray-resident: closing it hides it, and its
 * renderer stays mounted with every panel it had open. A window closed
 * to the tray is not a viewer — nothing it would paint is seen — so the
 * lifeline door (`port-registry.ts`) keeps its view channels shut until
 * it is opened again.
 *
 * The answer is the owner's word, not a reading of the screen: the
 * window manager says "open" where it shows the window and "closed"
 * where it hides it, so the rule is the same on every platform. A
 * minimized or covered window is still open. A surface no owner ever
 * spoke for (a child window, a helper) is always a viewer.
 */

export interface SurfaceViewers {
  /** Is someone looking at this surface? True for one nobody spoke for. */
  isViewer(wcId: number): boolean;
  /** Resolves once the surface is a viewer — at once if it is one. */
  whenViewer(wcId: number): Promise<void>;
  /** The surface's owner states whether its window is open. Idempotent. */
  set(wcId: number, viewer: boolean): void;
  /** The surface is gone: whatever waits on it is let go. */
  forget(wcId: number): void;
  /** Called when a surface stops being a viewer. Returns the unsubscribe. */
  onLeft(handler: (wcId: number) => void): () => void;
}

interface ClosedSurface {
  readonly reopened: Promise<void>;
  readonly release: () => void;
}

const ALREADY: Promise<void> = Promise.resolve();

export function createSurfaceViewers(): SurfaceViewers {
  // Only the closed surfaces are kept: one promise per closing, so
  // everything that waits on a surface is let through in the order it
  // started waiting.
  const closed = new Map<number, ClosedSurface>();
  const leftHandlers = new Set<(wcId: number) => void>();

  function reopen(wcId: number): void {
    const entry = closed.get(wcId);
    if (entry === undefined) return;
    closed.delete(wcId);
    entry.release();
  }

  return {
    isViewer: (wcId) => !closed.has(wcId),
    whenViewer: (wcId) => closed.get(wcId)?.reopened ?? ALREADY,
    set(wcId, viewer) {
      if (viewer) {
        reopen(wcId);
        return;
      }
      if (closed.has(wcId)) return;
      let release!: () => void;
      const reopened = new Promise<void>((resolve) => {
        release = resolve;
      });
      closed.set(wcId, { reopened, release });
      for (const handler of leftHandlers) handler(wcId);
    },
    forget: reopen,
    onLeft(handler) {
      leftHandlers.add(handler);
      return () => {
        leftHandlers.delete(handler);
      };
    },
  };
}

/** The process's one answer — the window manager writes it, the door reads it. */
export const surfaceViewers: SurfaceViewers = createSurfaceViewers();
