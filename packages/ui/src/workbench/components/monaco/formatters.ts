/**
 * Register Monaco `DocumentFormattingEditProvider`s for languages Monaco
 * has no built-in formatter for: Prettier for JavaScript and XML, the
 * core GraphQL printer for `graphql`.
 *
 * Monaco's language-service dispatch model:
 *   • `editor.action.formatDocument` (the action our Format button +
 *     Shift+Alt+F invoke) iterates every registered provider for the
 *     active model's language and runs the first one.
 *   • JSON / CSS / HTML have built-in providers auto-registered by
 *     their LSP contributions (`language/json/monaco.contribution`
 *     etc.). We do NOT override them — Monaco's built-ins are good,
 *     use zero extra bundle, and already ship via the LSP workers.
 *   • JS / TS / XML have no built-in formatter in Monaco. We register
 *     our own Prettier-backed provider here so the same action works
 *     everywhere.
 *
 * The provider is lazy: it only imports `prettier/standalone` and the
 * language plugin when the user actually formats, so the Prettier
 * chunk stays out of the initial bundle.
 */

import { parseDocument, printNode } from '@openheaders/core/graphql';
import type * as monaco from 'monaco-editor';
import { formatWithPrettier, isPrettierLanguage } from '../../languages/prettier';
import type { LanguageId } from '../../languages/registry';

/** Languages that get a Prettier-backed provider. Must be Monaco
 *  language ids — `text` maps to Monaco's `plaintext` and gets none. */
const REGISTER_FOR: LanguageId[] = ['javascript', 'xml'];

export function registerPrettierFormatters(m: typeof monaco): void {
  for (const language of REGISTER_FOR) {
    if (!isPrettierLanguage(language)) continue;
    m.languages.registerDocumentFormattingEditProvider(language, {
      displayName: 'Prettier',
      async provideDocumentFormattingEdits(model) {
        const original = model.getValue();
        if (original.trim().length === 0) return [];
        const formatted = await formatWithPrettier(original, language);
        if (formatted === original) return [];
        return [
          {
            range: model.getFullModelRange(),
            text: formatted,
          },
        ];
      },
    });
  }
}

/** The GraphQL document formatter — the core parser and printer, so
 *  Format Document (the button, the chord) lays a document out exactly
 *  as the builder and the bridges print it. A document that does not
 *  parse throws its first error; the editor's banner renders it. */
export function registerGraphqlFormatter(m: typeof monaco): void {
  m.languages.registerDocumentFormattingEditProvider('graphql', {
    displayName: 'GraphQL',
    provideDocumentFormattingEdits(model) {
      const original = model.getValue();
      if (original.trim().length === 0) return [];
      const parsed = parseDocument(original);
      if (parsed.document === null) {
        throw new Error(parsed.errors.map((error) => error.message).join('\n'));
      }
      const formatted = printNode(parsed.document);
      if (formatted === original) return [];
      return [{ range: model.getFullModelRange(), text: formatted }];
    },
  });
}
