/**
 * The JSON shadow — a body editor's text with every `{{ref}}` read as
 * a value, kept beside the real buffer for the validator plane. The
 * JSON worker validates raw text and cannot be taught a token; an
 * unquoted reference reads as "Property expected" plus the parser's
 * cascade. The shadow replaces each reference with a same-length run
 * of `1` (a leading `0` would split into two number tokens, a new
 * error), so the worker's positions map onto the real buffer one to
 * one and a reference inside a string stays a string of digits.
 *
 * A reference is one line's span, as the dress and the hover read it;
 * line breaks are never inside a mask, so the shadow's line structure
 * is the real buffer's. The mirror is incremental: the real buffer's
 * content changes apply verbatim (the worker's own mirror-model
 * idiom), then the lines those changes touched are re-masked from the
 * real text — after the verbatim step both buffers share line
 * numbers and lengths, so the re-mask reads only the real lines. A
 * full `setValue` per keystroke would resend the whole body to the
 * worker, where the delta sync sends the edit.
 */

import type * as monaco from 'monaco-editor';
import { attachJsonStandIn } from '../../monaco/json-diagnostics';
import { TEMPLATE_REGEX } from '../highlight';

export const JSON_SHADOW_SCHEME = 'oh-json-shadow';
export const SHADOW_VALUE_CHAR = '1';

const LINE_BREAK = /\r\n|\r|\n/g;

/** One line with every `{{…}}` masked to a same-length value token. */
export function maskTemplateLine(line: string): string {
  return line.replace(TEMPLATE_REGEX, (match) => SHADOW_VALUE_CHAR.repeat(match.length));
}

/** Whole text, line by line, every line break kept as it was. */
export function maskTemplateText(text: string): string {
  return text
    .split(/(\r\n|\r|\n)/)
    .map((part, index) => (index % 2 === 0 ? maskTemplateLine(part) : part))
    .join('');
}

function countLineBreaks(text: string): number {
  return text.match(LINE_BREAK)?.length ?? 0;
}

/**
 * The post-edit line numbers a content event touched — the lines the
 * verbatim mirror left raw. Changes are ordered by position; each
 * change's post-edit start is its pre-edit start moved by the line
 * delta of the changes before it, and it reaches as many lines as its
 * text inserts.
 */
export function touchedLines(changes: readonly monaco.editor.IModelContentChange[]): number[] {
  const ordered = [...changes].sort(
    (a, b) => a.range.startLineNumber - b.range.startLineNumber || a.range.startColumn - b.range.startColumn,
  );
  const touched = new Set<number>();
  let delta = 0;
  for (const change of ordered) {
    const first = change.range.startLineNumber + delta;
    const inserted = countLineBreaks(change.text);
    for (let line = first; line <= first + inserted; line++) touched.add(line);
    delta += inserted - (change.range.endLineNumber - change.range.startLineNumber);
  }
  return [...touched].sort((a, b) => a - b);
}

/** The lines of a buffer the mirror reads. */
export interface ShadowLines {
  getLineContent(lineNumber: number): string;
  getLineMaxColumn(lineNumber: number): number;
}

export interface ShadowEdit {
  range: monaco.IRange;
  text: string;
}

/** The whole-line replacements that bring the shadow's `lines` back to
 *  the mask of the real ones — only the lines that differ. */
export function remaskEdits(lines: readonly number[], real: ShadowLines, shadow: ShadowLines): ShadowEdit[] {
  const edits: ShadowEdit[] = [];
  for (const line of lines) {
    const masked = maskTemplateLine(real.getLineContent(line));
    if (masked === shadow.getLineContent(line)) continue;
    edits.push({
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: shadow.getLineMaxColumn(line) },
      text: masked,
    });
  }
  return edits;
}

/** The real buffer the shadow follows. */
export type JsonShadowSource = Pick<
  monaco.editor.ITextModel,
  'uri' | 'getValue' | 'getLanguageId' | 'getLineContent' | 'getLineMaxColumn' | 'onDidChangeContent' | 'isDisposed'
>;

/** The shadow buffer as the model service hands it out. */
export type JsonShadowModel = Pick<
  monaco.editor.ITextModel,
  | 'uri'
  | 'getLanguageId'
  | 'getLineContent'
  | 'getLineMaxColumn'
  | 'getEOL'
  | 'setEOL'
  | 'applyEdits'
  | 'onDidChangeContent'
  | 'isDisposed'
  | 'dispose'
>;

/** The namespace slice the shadow needs — the bundled namespace
 *  satisfies it. */
export interface JsonShadowMonaco {
  editor: {
    createModel(value: string, language?: string, uri?: monaco.Uri): JsonShadowModel;
    EndOfLineSequence: typeof monaco.editor.EndOfLineSequence;
  };
  Uri: typeof monaco.Uri;
}

/** The shadow's uri, derived from the real buffer's — one per model. */
export function jsonShadowUri(monacoApi: JsonShadowMonaco, real: monaco.Uri): monaco.Uri {
  return monacoApi.Uri.from({ scheme: JSON_SHADOW_SCHEME, path: `/${real.scheme}/${real.authority}${real.path}` });
}

/**
 * Create the shadow of `real`, hand it to the validator plane as the
 * stand-in, and mirror every content change until disposed. Plaintext:
 * the worker never reads the language, the plane's own create hook
 * must not adopt the shadow as a JSON buffer, and nothing tokenizes it.
 */
export function createJsonShadow(monacoApi: JsonShadowMonaco, real: JsonShadowSource): monaco.IDisposable {
  const shadow = monacoApi.editor.createModel(
    maskTemplateText(real.getValue()),
    'plaintext',
    jsonShadowUri(monacoApi, real.uri),
  );
  const lease = attachJsonStandIn(real, shadow);
  const subscription = real.onDidChangeContent((e) => {
    if (e.changes.length > 0) {
      shadow.applyEdits(e.changes.map(({ range, text }) => ({ range, text })));
      const edits = remaskEdits(touchedLines(e.changes), real, shadow);
      if (edits.length > 0) shadow.applyEdits(edits);
    }
    if (shadow.getEOL() !== e.eol) {
      const { EndOfLineSequence } = monacoApi.editor;
      shadow.setEOL(e.eol === '\r\n' ? EndOfLineSequence.CRLF : EndOfLineSequence.LF);
    }
  });
  return {
    dispose: () => {
      subscription.dispose();
      lease.dispose();
      shadow.dispose();
    },
  };
}
