/**
 * editor-font-readiness — Monaco re-measures its glyph metrics once
 * the active preset's web font has loaded, and again on a preset
 * change; a generic or system family (no registered face) and a
 * superseded wait never remeasure.
 */

import {
  createEditorFontReadiness,
  type FontLoader,
  primaryFontFamily,
  whenEditorFontReady,
} from '@openheaders/ui/workbench/components/monaco/editor-font-readiness';
import { describe, expect, it, vi } from 'vitest';

describe('primaryFontFamily', () => {
  it('takes the first family of the stack, unquoted', () => {
    expect(primaryFontFamily("'JetBrains Mono', ui-monospace, monospace")).toBe('JetBrains Mono');
    expect(primaryFontFamily('ui-monospace, SFMono-Regular, Menlo, monospace')).toBe('ui-monospace');
    expect(primaryFontFamily('"Press Start 2P"')).toBe('Press Start 2P');
  });
});

/** A font set that knows the given families — `load` resolves with
 *  one face per known family and empty otherwise, and records every
 *  request so the test can read the sampled styles. */
function fontSet(known: string[]): FontLoader & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    load: (font: string) => {
      requests.push(font);
      const family = /"([^"]+)"/.exec(font)?.[1] ?? '';
      return Promise.resolve(known.includes(family) ? [{}] : []);
    },
  };
}

describe('whenEditorFontReady', () => {
  it('samples regular, bold and italic of the primary family and reports a loaded face', async () => {
    const fonts = fontSet(['JetBrains Mono']);
    await expect(whenEditorFontReady("'JetBrains Mono', monospace", fonts)).resolves.toBe(true);
    expect(fonts.requests).toEqual([
      '13px "JetBrains Mono"',
      'bold 13px "JetBrains Mono"',
      'italic 13px "JetBrains Mono"',
    ]);
  });

  it('reports nothing to wait for on a system or generic family', async () => {
    await expect(whenEditorFontReady('ui-monospace, Menlo, monospace', fontSet(['JetBrains Mono']))).resolves.toBe(
      false,
    );
  });

  it('resolves false without the CSS Font Loading API', async () => {
    await expect(whenEditorFontReady("'JetBrains Mono', monospace", null)).resolves.toBe(false);
  });

  it('treats a rejected load as not loaded', async () => {
    const fonts: FontLoader = { load: () => Promise.reject(new Error('blocked')) };
    await expect(whenEditorFontReady("'Fira Code', monospace", fonts)).resolves.toBe(false);
  });
});

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

describe('createEditorFontReadiness', () => {
  it('remeasures once the current preset loads and again after a preset change', async () => {
    const remeasureFonts = vi.fn();
    let stack = "'JetBrains Mono', monospace";
    const listeners = new Set<() => void>();
    const readiness = createEditorFontReadiness(
      { editor: { remeasureFonts } },
      {
        readStack: () => stack,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        fonts: fontSet(['JetBrains Mono', 'Fira Code']),
      },
    );
    await settle();
    expect(remeasureFonts).toHaveBeenCalledTimes(1);

    stack = "'Fira Code', monospace";
    for (const listener of listeners) listener();
    await settle();
    expect(remeasureFonts).toHaveBeenCalledTimes(2);

    readiness.dispose();
    expect(listeners.size).toBe(0);
  });

  it('skips the remeasure for a family with no registered face', async () => {
    const remeasureFonts = vi.fn();
    createEditorFontReadiness(
      { editor: { remeasureFonts } },
      { readStack: () => 'ui-monospace, monospace', subscribe: () => () => {}, fonts: fontSet([]) },
    );
    await settle();
    expect(remeasureFonts).not.toHaveBeenCalled();
  });

  it('lets only the newest wait remeasure when the preset changes mid-load', async () => {
    const remeasureFonts = vi.fn();
    let stack = "'JetBrains Mono', monospace";
    const pending: Array<(faces: unknown[]) => void> = [];
    const fonts: FontLoader = {
      load: () =>
        new Promise<unknown[]>((resolve) => {
          pending.push(resolve);
        }),
    };
    let fire: () => void = () => {};
    createEditorFontReadiness(
      { editor: { remeasureFonts } },
      {
        readStack: () => stack,
        subscribe: (listener) => {
          fire = listener;
          return () => {};
        },
        fonts,
      },
    );
    stack = "'Fira Code', monospace";
    fire();
    // The first wait's three samples resolve loaded — superseded, so no remeasure.
    for (const resolve of pending.splice(0, 3)) resolve([{}]);
    await settle();
    expect(remeasureFonts).not.toHaveBeenCalled();
    for (const resolve of pending.splice(0, 3)) resolve([{}]);
    await settle();
    expect(remeasureFonts).toHaveBeenCalledTimes(1);
  });

  it('never remeasures after dispose', async () => {
    const remeasureFonts = vi.fn();
    let resolveLoad: (faces: unknown[]) => void = () => {};
    const fonts: FontLoader = {
      load: () =>
        new Promise<unknown[]>((resolve) => {
          resolveLoad = resolve;
        }),
    };
    const readiness = createEditorFontReadiness(
      { editor: { remeasureFonts } },
      { readStack: () => "'JetBrains Mono', monospace", subscribe: () => () => {}, fonts },
    );
    readiness.dispose();
    resolveLoad([{}]);
    await settle();
    expect(remeasureFonts).not.toHaveBeenCalled();
  });
});
