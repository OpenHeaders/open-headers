/**
 * editor-font-readiness — keeps Monaco's glyph metrics honest for the
 * editor font presets that ship as web fonts.
 *
 * Monaco measures the character width once per font configuration,
 * when the first editor mounts, and its monospace fast path then
 * places the caret and the selection highlight at `column × measured
 * width` while the glyphs themselves paint at their true advance. A
 * bundled preset (JetBrains Mono, Fira Code, …) is an `@font-face` the
 * browser may not have parsed by that first mount, so the reading is
 * the fallback face's — and Monaco keeps it: a reading is only retried
 * when it comes back at zero width, never when a different face
 * answered. The caret then sits a few characters off the click and
 * Backspace deletes where the click really landed — the Windows
 * report (Windows and Linux default to JetBrains Mono; macOS defaults
 * to the native System Mono stack and never measures a fallback).
 *
 * The cure is the terminal's law for xterm (`whenTerminalFontReady`):
 * await the preset's faces through the CSS Font Loading API, then ask
 * Monaco to re-read — `remeasureFonts()` drops every cached reading
 * and each mounted editor re-measures and re-lays out. Installed once
 * by the first mounting editor; a preset change runs the same
 * await-then-remeasure for the new family.
 */

import { resolveFontFamily } from '../../settings/schema/editor';
import { get as getSetting, subscribeKey } from '../../settings/store';

/** The slice of the Monaco namespace this module drives —
 *  structurally satisfied by the instance `onMount` hands out. */
export interface MonacoFontHost {
  editor: {
    remeasureFonts(): void;
  };
}

/** The slice of `document.fonts` the readiness wait needs. */
export interface FontLoader {
  load(font: string): Promise<ArrayLike<unknown>>;
}

export interface EditorFontReadinessDeps {
  /** The active editor font stack (the preset's CSS value). */
  readStack: () => string;
  /** Fires whenever the stack may have changed; returns the unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** `document.fonts`, or `null` where the API is absent (then every
   *  wait resolves at once and no remeasure runs). */
  fonts: FontLoader | null;
}

export interface EditorFontReadiness {
  dispose(): void;
}

/** First family of a CSS font stack, unquoted — the face to await. */
export function primaryFontFamily(stack: string): string {
  return stack
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

/** The faces Monaco samples when it measures: regular, bold and
 *  italic of the primary family. A generic keyword (`ui-monospace`,
 *  `monospace`) or a system font matches no registered face and
 *  resolves empty — the caller reads that as "nothing to wait for". */
const SAMPLE_SIZE_PX = 13;
const SAMPLE_STYLES = ['', 'bold ', 'italic '] as const;

/**
 * Resolves with whether any registered face of the stack's primary
 * family was (or became) loaded — true means Monaco's metrics may
 * have been read against a fallback and are worth re-measuring.
 */
export async function whenEditorFontReady(stack: string, fonts: FontLoader | null): Promise<boolean> {
  if (fonts === null) return false;
  const family = primaryFontFamily(stack);
  const results = await Promise.all(
    SAMPLE_STYLES.map((style) =>
      fonts.load(`${style}${SAMPLE_SIZE_PX}px "${family}"`).then(
        (faces) => faces.length > 0,
        () => false,
      ),
    ),
  );
  return results.some(Boolean);
}

/**
 * Wire the await-then-remeasure cycle for the current stack and every
 * later change of it. A stale wait (the stack changed again while its
 * faces were loading) never remeasures for the family it no longer
 * targets — the newest cycle owns the remeasure.
 */
export function createEditorFontReadiness(host: MonacoFontHost, deps: EditorFontReadinessDeps): EditorFontReadiness {
  let generation = 0;
  let disposed = false;

  const run = () => {
    const current = ++generation;
    void whenEditorFontReady(deps.readStack(), deps.fonts).then((loaded) => {
      if (disposed || current !== generation || !loaded) return;
      host.editor.remeasureFonts();
    });
  };

  run();
  const unsubscribe = deps.subscribe(run);
  return {
    dispose() {
      disposed = true;
      unsubscribe();
    },
  };
}

let active: EditorFontReadiness | null = null;

/**
 * Install the settings→Monaco font readiness sync. Idempotent — the
 * first mounted editor wins; Monaco's measurements are page-global, so
 * later mounts share the remeasure.
 */
export function ensureEditorFontReadiness(host: MonacoFontHost): void {
  if (active) return;
  active = createEditorFontReadiness(host, {
    readStack: () => resolveFontFamily(getSetting('editor.fontFamilyPreset')),
    subscribe: (listener) => subscribeKey('editor.fontFamilyPreset', listener),
    fonts: typeof document === 'undefined' ? null : (document.fonts ?? null),
  });
}
