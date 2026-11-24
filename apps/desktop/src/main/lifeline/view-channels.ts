/**
 * View channels — the lifelines that exist only to paint a window: the
 * browser list, a watched tab's traffic, console and storage planes, the
 * proxy capture partition, a recorded session's replay.
 *
 * Nothing here is a capture. An armed source and a recording session
 * read in the main process and never open a lifeline, so shutting these
 * channels for a closed window stops no capture.
 *
 * Presence is not a view: it says the surface exists and holds its
 * workspace, window open or not. A name this list does not know is left
 * alone.
 */

import { CONSOLE_STREAM_PORT_PREFIX } from '@openheaders/core/console-stream';
import { STORAGE_PORT_PREFIX, TELEMETRY_TABS_PORT_NAME } from '@openheaders/core/protocol';
import { LIFECYCLE_PORT_PREFIX, REPLAY_LIFECYCLE_PORT_PREFIX } from '@openheaders/core/request-lifecycle';

const VIEW_CHANNEL_PREFIXES: readonly string[] = [
  LIFECYCLE_PORT_PREFIX,
  CONSOLE_STREAM_PORT_PREFIX,
  STORAGE_PORT_PREFIX,
  REPLAY_LIFECYCLE_PORT_PREFIX,
];

export function isViewChannel(name: string): boolean {
  if (name === TELEMETRY_TABS_PORT_NAME) return true;
  for (const prefix of VIEW_CHANNEL_PREFIXES) {
    if (name.startsWith(prefix)) return true;
  }
  return false;
}
