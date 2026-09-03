/**
 * Script slots — the rail's per-slot unsaved flags. The HTTP request
 * editor's pair rides its section flags; the container editor diffs
 * its draft against the saved entity over the whole vocabulary, one
 * flag per slot whose editor text differs verbatim, nothing set for
 * the rest.
 */

import {
  emptyScriptSlotValues,
  SCRIPT_KINDS,
  scriptSlotFlagsBetween,
  scriptSlotFlagsOf,
} from '@openheaders/ui/workbench/components/script-editor/script-slots';
import { describe, expect, it } from 'vitest';

describe('scriptSlotFlagsOf', () => {
  it('maps the request editor section flags onto the HTTP pair alone', () => {
    expect(scriptSlotFlagsOf({ preRequestScript: true, postResponseScript: false })).toEqual({
      'pre-request': true,
      'post-response': false,
    });
  });
});

describe('scriptSlotFlagsBetween', () => {
  it('flags every slot whose draft differs from the saved text, verbatim, and nothing else', () => {
    const saved = { ...emptyScriptSlotValues(), 'ws-on-message': 'oh.send("pong")' };
    const draft = {
      ...saved,
      'mqtt-before-publish': 'oh.setTopic("sensors/1")',
      'ws-on-message': 'oh.send("pong") ',
    };
    expect(scriptSlotFlagsBetween(draft, saved)).toEqual({ 'mqtt-before-publish': true, 'ws-on-message': true });
  });

  it('an unchanged draft sets no flag — the section reads clean', () => {
    const saved = { ...emptyScriptSlotValues(), 'grpc-before-invoke': 'oh.setMetadata("x", "1")' };
    const flags = scriptSlotFlagsBetween({ ...saved }, saved);
    expect(flags).toEqual({});
    expect(SCRIPT_KINDS.some((kind) => flags[kind] === true)).toBe(false);
  });
});
