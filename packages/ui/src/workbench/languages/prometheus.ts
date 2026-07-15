/**
 * Prometheus / OpenMetrics exposition format — Monarch grammar.
 *
 * The format is line-oriented (https://prometheus.io/docs/instrumenting/exposition_formats/):
 *
 *   # HELP metric_name free text
 *   # TYPE metric_name counter|gauge|histogram|…
 *   metric_name{label="value",…} 1027 1720000000123
 *   # EOF                                    (OpenMetrics terminator)
 *
 * Tokens map to Monaco's standard scopes (comment / keyword / string /
 * number / type.identifier / attribute.name) so every theme colors them
 * without grammar-specific rules. Registered in the Monaco bootstrap
 * under the registry id `prometheus` — no worker, tokenizer only.
 */

import type * as monaco from 'monaco-editor';

/** Metric-name charset per the exposition grammar. */
export const METRIC_NAME_PATTERN = /[a-zA-Z_:][a-zA-Z0-9_:]*/;

const METRIC_TYPES = 'counter|gauge|histogram|gaugehistogram|summary|info|stateset|unknown|untyped';

export const prometheusMonarch: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.prometheus',

  tokenizer: {
    root: [
      // Metadata comments — keyword, the metric name it describes, then
      // the type word (TYPE) or free text (HELP / UNIT).
      [/^(#\s*(?:HELP|UNIT))(\s+)([a-zA-Z_:][a-zA-Z0-9_:]*)(.*)$/, ['keyword', 'white', 'type.identifier', 'comment']],
      [
        new RegExp(`^(#\\s*TYPE)(\\s+)([a-zA-Z_:][a-zA-Z0-9_:]*)(\\s+)(${METRIC_TYPES})(\\s*)$`),
        ['keyword', 'white', 'type.identifier', 'white', 'keyword', 'white'],
      ],
      [/^#\s*EOF\s*$/, 'keyword'],
      // Any other full-line comment.
      [/^#.*$/, 'comment'],
      // Sample line: metric name at line start; labels / value /
      // timestamp / exemplar follow through the shared rules below.
      [/^[a-zA-Z_:][a-zA-Z0-9_:]*/, 'type.identifier'],
      [/\{/, { token: 'delimiter.curly', next: '@labels' }],
      // Mid-line `#` opens an exemplar (OpenMetrics) — its label set and
      // value ride the same root rules.
      [/#/, 'delimiter'],
      [/[+-]?(?:Inf|NaN)\b/, 'number.float'],
      [/-?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/, 'number'],
      [/\s+/, 'white'],
    ],

    labels: [
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'attribute.name'],
      [/=/, 'operator'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      // Unterminated value — mark the tail, pop at end of line so the
      // state never leaks onto the next sample.
      [/"(?:[^"\\]|\\.)*$/, { token: 'string.invalid', next: '@pop' }],
      [/,/, 'delimiter'],
      [/\}/, { token: 'delimiter.curly', next: '@pop' }],
      [/\s+/, 'white'],
      [/$/, { token: 'white', next: '@pop' }],
    ],
  },
};

/** Register the language id + tokenizer on the Monaco singleton — called
 *  once from the bootstrap's synchronous phase. */
export function registerPrometheusLanguage(monacoApi: {
  languages: Pick<typeof monaco.languages, 'register' | 'setMonarchTokensProvider'>;
}): void {
  monacoApi.languages.register({ id: 'prometheus' });
  monacoApi.languages.setMonarchTokensProvider('prometheus', prometheusMonarch);
}
