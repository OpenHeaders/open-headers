import {
  qualifiedConsolePortName,
  qualifiedStoragePortName,
  TELEMETRY_TABS_PORT_NAME,
} from '@openheaders/core/protocol';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import {
  lifecyclePortName,
  qualifiedLifecyclePortName,
  replayLifecyclePortName,
} from '@openheaders/core/request-lifecycle';
import { describe, expect, it } from 'vitest';
import { isViewChannel } from '@/main/lifeline/view-channels';

describe('view channels', () => {
  it.each([
    ['the browser list', TELEMETRY_TABS_PORT_NAME],
    ["a watched tab's traffic", qualifiedLifecyclePortName(7, 'ext-1')],
    ["a watched tab's console", qualifiedConsolePortName(7, 'ext-1')],
    ["a watched tab's storage", qualifiedStoragePortName(7, 'ext-1')],
    ['the proxy capture partition', lifecyclePortName(PROXY_LIFECYCLE_TAB_ID)],
    ["a recorded session's replay", replayLifecyclePortName('archive-1')],
  ])('counts %s as a view', (_label, name) => {
    expect(isViewChannel(name)).toBe(true);
  });

  it('does not count presence as a view', () => {
    expect(isViewChannel('oh.awareness.lifeline:surface-1')).toBe(false);
  });

  it('leaves a name it does not know alone', () => {
    expect(isViewChannel('oh-something-new:1')).toBe(false);
    expect(isViewChannel('')).toBe(false);
  });
});
