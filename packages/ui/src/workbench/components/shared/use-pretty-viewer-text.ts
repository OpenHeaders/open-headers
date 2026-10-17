/**
 * usePrettyViewerText — the timeline viewers' Pretty text: the HTTP
 * response body's formatting law over a decoded message. JSON
 * re-indents synchronously and losslessly (`prettyBody`); markup
 * formats go through the lazy Prettier pipeline (`useFormattedBody`),
 * so the wire text paints first and the formatted text swaps in. Raw
 * hands the wire text through untouched — the viewer's display choice,
 * never the frame's bytes.
 */

import type { LanguageId } from '../../languages/registry';
import { prettyBody } from '../request-editor/response/response-format';
import { useFormattedBody } from '../request-editor/response/use-formatted-body';

export function usePrettyViewerText(text: string, language: LanguageId, pretty: boolean): string {
  const source = pretty ? prettyBody(text, language) : text;
  // `text` as the language keeps the async formatter idle on Raw —
  // the hook's formattable set never names it.
  return useFormattedBody(source, pretty ? language : 'text');
}
