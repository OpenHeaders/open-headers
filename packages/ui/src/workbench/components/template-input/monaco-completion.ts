/**
 * Monaco completion provider for `{{scope.name}}` variable references.
 *
 * Fires while the user is typing inside a `{{…}}` reference in any
 * Monaco-hosted editor (JSON / GraphQL / XML / JS body editors, static
 * body rule fields, inject-code fields). Same scope catalogue +
 * ordering the line-input picker uses — callers plug in the
 * suggestion getter and the shared {@link SuggestionContext}.
 *
 * See `docs/VARIABLE_AUTOCOMPLETE_PLAN.md` Phase D.
 */

import { filterSuggestions, type SuggestionContext, type VariableSuggestion } from '@openheaders/core/variables';
import type * as monaco from 'monaco-editor';

/**
 * Language ids we register the provider for. Matches the current set
 * of body editors in the extension. `plaintext` covers request bodies
 * that haven't picked a language; `graphql` is the GraphQL body
 * editor; `xml`, `json`, `javascript` are the other content types.
 */
export const COMPLETION_LANGUAGES: ReadonlyArray<string> = ['json', 'graphql', 'xml', 'plaintext', 'javascript'];

export interface RegisterOptions {
  /** Getter for the current candidate list — called on every popover
   *  fire, so callers can subscribe to live stores and return the
   *  latest snapshot. */
  getSuggestions: () => ReadonlyArray<VariableSuggestion>;
  /** Caller-side gating. Used only for the reserved-namespace
   *  filtering here; the list returned by `getSuggestions` is
   *  assumed to already honor the context's scope gates. */
  context?: SuggestionContext;
  /** Languages to register against. Defaults to
   *  {@link COMPLETION_LANGUAGES}. */
  languages?: ReadonlyArray<string>;
}

/** Scope pill color — mirrors SuggestionRow's palette so the Monaco
 *  hover detail matches the line-input rendering. */
const SCOPE_LABEL: Record<VariableSuggestion['scope'], string> = {
  vault: 'Vault secret',
  env: 'Environment',
  collection: 'Collection',
  workspace: 'Workspace',
  live: 'Source',
  step: 'Source flow step capture',
  file: 'File reference',
  dynamic: 'Dynamic generator',
};

/**
 * Registers one completion provider per language in `languages` and
 * returns a disposable that tears them all down. Safe to call from an
 * editor's `onMount` — invoke the disposable in the matching
 * `onBeforeDispose` / unmount handler.
 */
export function registerVariableCompletionProvider(
  monacoApi: typeof monaco,
  opts: RegisterOptions,
): monaco.IDisposable {
  const languages = opts.languages ?? COMPLETION_LANGUAGES;
  const disposables: monaco.IDisposable[] = [];

  for (const lang of languages) {
    disposables.push(
      monacoApi.languages.registerCompletionItemProvider(lang, {
        // `{` triggers the second-brace check below. `.` lets the user
        // keep narrowing `env.API_` → `env.API_URL` from Monaco's
        // filter.
        triggerCharacters: ['{', '.'],
        provideCompletionItems: (model, position) => {
          const line = model.getLineContent(position.lineNumber);
          const prefix = line.slice(0, position.column - 1);

          // Find the most recent unclosed `{{` on this line — that's
          // our measure-start. If a `}}` appears after it on the same
          // line, the reference is already closed; no suggestions.
          const openIdx = prefix.lastIndexOf('{{');
          if (openIdx === -1) return { suggestions: [] };
          const afterOpen = prefix.slice(openIdx + 2);
          if (afterOpen.includes('}}')) return { suggestions: [] };

          const query = afterOpen;
          const all = opts.getSuggestions();
          const ranked = filterSuggestions(all, query);

          // `{{` is already in the buffer at columns
          // `openIdx+1..openIdx+2` (1-based); caret is at `column`.
          // Replace `afterOpen` + any trailing `}}` would be handled
          // by rc-mentions in the line-input path; here we only
          // replace `afterOpen` and let Monaco's default behavior
          // keep whatever the user already typed after the caret.
          const replaceStart = openIdx + 3; // column (1-based) of char after `{{`
          const range: monaco.IRange = {
            startLineNumber: position.lineNumber,
            startColumn: replaceStart,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          };

          const items: monaco.languages.CompletionItem[] = ranked.map((s, idx) => {
            const detail = scopeDetail(s);
            const insertText = s.disabled ? `${s.reference}}}` : `${s.reference}}}`;
            const documentation = previewDocumentation(s);
            return {
              label: {
                label: s.reference,
                description: SCOPE_LABEL[s.scope],
              },
              kind: monacoApi.languages.CompletionItemKind.Variable,
              detail,
              documentation: documentation ? { value: documentation } : undefined,
              insertText,
              range,
              // Preserve the engine's ranking by issuing monotonically
              // descending sortText ("000" < "001" < …). Monaco sorts
              // lexicographically on sortText, so "000" wins.
              sortText: String(idx).padStart(4, '0'),
              // Keep reserved rows visible but non-insertable — they
              // render grey with the subtitle and picking is harmless
              // (the resolver surfaces `reserved-namespace` at
              // runtime; no silent data loss).
              filterText: s.reference,
              // Monaco has no "disabled" flag on completion items; we
              // mark them via `tags` + commit the literal text
              // regardless (same behavior as the line picker).
              tags: s.disabled ? [monacoApi.languages.CompletionItemTag.Deprecated] : undefined,
            };
          });
          return { suggestions: items };
        },
      }),
    );
  }

  return {
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

function scopeDetail(s: VariableSuggestion): string {
  switch (s.preview.kind) {
    case 'value':
    case 'stale': {
      const tag = s.preview.kind === 'stale' ? ' (stale)' : '';
      return s.preview.masked ? `${SCOPE_LABEL[s.scope]}${tag} — ••••` : `${SCOPE_LABEL[s.scope]}${tag}`;
    }
    case 'reserved':
      return `${SCOPE_LABEL[s.scope]} — coming soon`;
    case 'step-runtime':
      return `${SCOPE_LABEL[s.scope]} — captured at runtime`;
    case 'totp':
      return `${SCOPE_LABEL[s.scope]} — TOTP code (${s.preview.digits} digits, ${s.preview.period}s)`;
  }
}

function previewDocumentation(s: VariableSuggestion): string | null {
  switch (s.preview.kind) {
    case 'value':
      // Only expose the literal value to Monaco's hover when the
      // scope's default says it's safe — match the line-input
      // masking discipline.
      return s.preview.masked ? 'Value hidden (sensitive scope).' : `**Value:** \`${s.preview.value}\``;
    case 'stale':
      return s.preview.masked ? 'Value hidden (stale live variable).' : `**Stale value:** \`${s.preview.value}\``;
    case 'reserved':
      return s.preview.subtitle;
    case 'step-runtime':
      return 'Captured when the workflow runs.';
    case 'totp': {
      const issuer = s.preview.issuer ? ` for **${s.preview.issuer}**` : '';
      return `**TOTP code**${issuer} — ${s.preview.algorithm}, ${s.preview.digits} digits, refreshes every ${s.preview.period}s.`;
    }
  }
}
