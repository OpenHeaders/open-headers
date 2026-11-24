/**
 * Held opens — the lifeline door's waiting room.
 *
 * A port the renderer opens before the engine is ready has no acceptor
 * to go to yet: every acceptor registers inside the engine boot. The
 * open waits here, together with the frames the surface posts to it
 * (its `bind` / `subscribe` handshake), and is admitted with those
 * frames, in order, once the boot settles.
 *
 * A view channel opened by a window that is closed to the tray waits
 * here the same way, for as long as the window stays closed.
 *
 * A port the surface closes while it waits — or whose surface goes away
 * — is marked canceled and never reaches an acceptor.
 */

export interface HeldOpen {
  readonly wcId: number;
  readonly portId: string;
  /** Frames the surface posted while the open waited, in arrival order. */
  readonly frames: unknown[];
  /** The surface closed the port, or went away, before it was admitted. */
  canceled: boolean;
}

export interface HeldOpens {
  has(portId: string): boolean;
  /** Start holding one open. */
  hold(wcId: number, portId: string): HeldOpen;
  /** Stop holding — the caller admits the open or drops it. */
  release(held: HeldOpen): void;
  /** Keep a frame for a held port. False when this surface holds no such port. */
  keepFrame(wcId: number, portId: string, frame: unknown): boolean;
  /** The surface closed a held port. False when this surface holds no such port. */
  cancel(wcId: number, portId: string): boolean;
  /** The surface went away: cancel everything it holds. */
  cancelSurface(wcId: number): void;
}

export function createHeldOpens(): HeldOpens {
  // Keyed by the renderer-minted portId; every read is also scoped to
  // the owning surface so one renderer cannot address another's port.
  const held = new Map<string, HeldOpen>();

  function ownedBy(wcId: number, portId: string): HeldOpen | undefined {
    const entry = held.get(portId);
    return entry !== undefined && entry.wcId === wcId ? entry : undefined;
  }

  return {
    has: (portId) => held.has(portId),
    hold(wcId, portId) {
      const entry: HeldOpen = { wcId, portId, frames: [], canceled: false };
      held.set(portId, entry);
      return entry;
    },
    release(entry) {
      if (held.get(entry.portId) === entry) held.delete(entry.portId);
    },
    keepFrame(wcId, portId, frame) {
      const entry = ownedBy(wcId, portId);
      if (entry === undefined) return false;
      if (!entry.canceled) entry.frames.push(frame);
      return true;
    },
    cancel(wcId, portId) {
      const entry = ownedBy(wcId, portId);
      if (entry === undefined) return false;
      entry.canceled = true;
      return true;
    },
    cancelSurface(wcId) {
      for (const entry of held.values()) {
        if (entry.wcId === wcId) entry.canceled = true;
      }
    },
  };
}
