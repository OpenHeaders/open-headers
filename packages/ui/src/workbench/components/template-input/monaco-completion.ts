/**
 * Monaco completion provider for `{{scope.name}}` variable references.
 *
 * Fires while the user is typing inside a `{{…}}` reference in any
 * Monaco-hosted editor (JSON / GraphQL / XML / JS body editors, static
 * body rule fields, inject-code fields). Same scope catalogue +
 * ordering the line-input picker uses — callers plug in the
 * suggestion getter and the shared {@link SuggestionContext}.
 *
 * See the variable-autocomplete plan Phase D.
 */

import { filterSuggestions, type SuggestionContext, type VariableSuggestion } from '@openheaders/core/variables';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
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
const SCOPE_LABEL_KEY: Record<VariableSuggestion['scope'], MessageKey> = {
  vault: 'shared.templateInput.completion.scope.vault',
  env: 'shared.templateInput.completion.scope.env',
  collection: 'shared.templateInput.completion.scope.collection',
  workspace: 'shared.templateInput.completion.scope.workspace',
  live: 'shared.templateInput.completion.scope.live',
  step: 'shared.templateInput.completion.scope.step',
  file: 'shared.templateInput.completion.scope.file',
  dynamic: 'shared.templateInput.completion.scope.dynamic',
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
  t: Translate,
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
          // Drop namespace-scaffold rows here — empty-scope discovery is
          // a line-input (TemplateInput) affordance; in a code/JSON body
          // a per-scope `{{scope.}}` row would be noise.
          const ranked = filterSuggestions(all, query).filter((s) => s.preview.kind !== 'namespace');

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
            const detail = scopeDetail(s, t);
            const insertText = s.disabled ? `${s.reference}}}` : `${s.reference}}}`;
            const documentation = previewDocumentation(s, t);
            return {
              label: {
                label: s.reference,
                description: t(SCOPE_LABEL_KEY[s.scope]),
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

// The em-dash join between the scope label and its qualifier is list
// punctuation, not sentence grammar — composed here with each part
// keyed (the masking dots and namespace-scaffold subtitles from core's
// dynamic-generator registry stay raw).
function scopeDetail(s: VariableSuggestion, t: Translate): string {
  const label = t(SCOPE_LABEL_KEY[s.scope]);
  switch (s.preview.kind) {
    case 'value':
    case 'stale': {
      const tag = s.preview.kind === 'stale' ? ` ${t('shared.templateInput.completion.staleSuffix')}` : '';
      return s.preview.masked ? `${label}${tag} — ••••` : `${label}${tag}`;
    }
    case 'reserved':
      return `${label} — ${t('shared.templateInput.completion.comingSoon')}`;
    case 'namespace':
    case 'dynamic':
      return `${label} — ${scaffoldSubtitleFor(s, t)}`;
    case 'step-runtime':
      return `${label} — ${t('shared.templateInput.completion.capturedAtRuntime')}`;
    case 'totp':
      return `${label} — ${t('shared.templateInput.completion.totpDetail', {
        digits: s.preview.digits,
        period: s.preview.period,
      })}`;
    case 'secret-manager':
      return `${label} — ${s.preview.reference}`;
  }
}

// Namespace-scaffold subtitles resolve here instead of rendering core's
// English (S8 core-copy rule); per-generator descriptions stay core data.
const SCAFFOLD_SUBTITLE_KEY: Partial<Record<VariableSuggestion['scope'], MessageKey>> = {
  vault: 'shared.templateInput.scaffold.vault',
  env: 'shared.templateInput.scaffold.env',
  collection: 'shared.templateInput.scaffold.collection',
  workspace: 'shared.templateInput.scaffold.workspace',
  dynamic: 'shared.templateInput.scaffold.dynamic',
};

function scaffoldSubtitleFor(s: VariableSuggestion, t: Translate): string {
  if (s.preview.kind !== 'namespace' && s.preview.kind !== 'dynamic' && s.preview.kind !== 'reserved') return '';
  if (s.preview.kind === 'dynamic') return s.preview.subtitle;
  if (s.preview.kind === 'reserved') {
    return s.scope === 'file' ? t('shared.templateInput.reservedFile') : s.preview.subtitle;
  }
  const key = SCAFFOLD_SUBTITLE_KEY[s.scope];
  return key ? t(key) : s.preview.subtitle;
}

function previewDocumentation(s: VariableSuggestion, t: Translate): string | null {
  switch (s.preview.kind) {
    case 'value':
      // Only expose the literal value to Monaco's hover when the
      // scope's default says it's safe — match the line-input
      // masking discipline.
      return s.preview.masked
        ? t('shared.templateInput.completion.valueHiddenSensitive')
        : t('shared.templateInput.completion.valueDoc', { value: s.preview.value });
    case 'stale':
      return s.preview.masked
        ? t('shared.templateInput.completion.valueHiddenStale')
        : t('shared.templateInput.completion.staleValueDoc', { value: s.preview.value });
    case 'reserved':
    case 'namespace':
    case 'dynamic':
      return scaffoldSubtitleFor(s, t);
    case 'step-runtime':
      return t('shared.templateInput.completion.capturedWhenRuns');
    case 'totp': {
      const args = { algorithm: s.preview.algorithm, digits: s.preview.digits, period: s.preview.period };
      return s.preview.issuer
        ? t('shared.templateInput.completion.totpDocIssuer', { ...args, issuer: s.preview.issuer })
        : t('shared.templateInput.completion.totpDoc', args);
    }
    case 'secret-manager':
      // The reference is shareable by construction — surfacing it in
      // the hover is safe; the resolved value never reaches this layer.
      return t('shared.templateInput.completion.secretManagerDoc', { reference: s.preview.reference });
  }
}
