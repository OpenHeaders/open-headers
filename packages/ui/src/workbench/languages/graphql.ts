/**
 * GraphQL — Monarch grammar (executable AND type-system documents).
 *
 * Our own tokenizer over the spec's lexical grammar
 * (https://spec.graphql.org/October2021/#sec-Language): comments,
 * punctuators, the keyword set (operations, fragments, `on`, the
 * type-system definitions and extensions, `true` / `false` / `null`),
 * `$variables`, `@directives`, names, ints / floats, strings with the
 * escape set, and block strings (`"""…"""`, spanning lines). Tokens map
 * to Monaco's standard scopes (comment / keyword / string / number /
 * variable / annotation / type.identifier / delimiter) so every theme
 * colors them without grammar-specific rules. Registered in the Monaco
 * bootstrap under the registry id `graphql` — no worker, tokenizer
 * only; the completion / diagnostics providers ride
 * `@openheaders/core/graphql` from the editor that binds them.
 *
 * Names that follow a `type` / `interface` / `union` / `enum` /
 * `input` / `scalar` / `on` / `implements` / `:` / `&` / `|` read as
 * type identifiers; every other name is a field, argument or fragment
 * name. A type reference inside a variable definition (`$id: ID!`)
 * takes the `:` rule.
 */

import type * as monaco from 'monaco-editor';

const KEYWORDS = [
  'query',
  'mutation',
  'subscription',
  'fragment',
  'on',
  'schema',
  'scalar',
  'type',
  'interface',
  'union',
  'enum',
  'input',
  'extend',
  'directive',
  'implements',
  'repeatable',
];

const CONSTANTS = ['true', 'false', 'null'];

const DIRECTIVE_LOCATIONS = [
  'QUERY',
  'MUTATION',
  'SUBSCRIPTION',
  'FIELD',
  'FRAGMENT_DEFINITION',
  'FRAGMENT_SPREAD',
  'INLINE_FRAGMENT',
  'VARIABLE_DEFINITION',
  'SCHEMA',
  'SCALAR',
  'OBJECT',
  'FIELD_DEFINITION',
  'ARGUMENT_DEFINITION',
  'INTERFACE',
  'UNION',
  'ENUM',
  'ENUM_VALUE',
  'INPUT_OBJECT',
  'INPUT_FIELD_DEFINITION',
];

export const graphqlMonarch: monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.graphql',
  keywords: KEYWORDS,
  constants: CONSTANTS,
  locations: DIRECTIVE_LOCATIONS,

  brackets: [
    { open: '{', close: '}', token: 'delimiter.curly' },
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  tokenizer: {
    root: [
      [/#.*$/, 'comment'],
      // Block strings first — the triple quote must win over the plain
      // string rule below.
      [/"""/, { token: 'string.quote', next: '@blockString' }],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/"(?:[^"\\]|\\.)*$/, 'string.invalid'],
      [/\$[_A-Za-z][_0-9A-Za-z]*/, 'variable'],
      [/@[_A-Za-z][_0-9A-Za-z]*/, 'annotation'],
      // A type reference after `:` / `&` / `|` / `on` / `implements`
      // and the named type-system definitions.
      [
        /(:|&|\|)(\s*)(\[?)(\s*)([_A-Za-z][_0-9A-Za-z]*)/,
        ['delimiter', 'white', 'delimiter.square', 'white', 'type.identifier'],
      ],
      [
        /\b(type|interface|union|enum|input|scalar|on|implements|extend\s+(?:type|interface|union|enum|input|scalar))(\s+)([_A-Za-z][_0-9A-Za-z]*)/,
        ['keyword', 'white', 'type.identifier'],
      ],
      [/\bdirective(\s*)(@[_A-Za-z][_0-9A-Za-z]*)/, ['keyword', 'white', 'annotation']],
      [/-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/, 'number'],
      [
        /[_A-Za-z][_0-9A-Za-z]*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@constants': 'constant',
            '@locations': 'type.identifier',
            '@default': 'identifier',
          },
        },
      ],
      [/\.\.\./, 'operator'],
      [/[!=]/, 'operator'],
      [/[{}()[\]]/, '@brackets'],
      [/[:|&]/, 'delimiter'],
      [/,/, 'delimiter'],
      [/\s+/, 'white'],
    ],

    blockString: [
      [/\\"""/, 'string.escape'],
      [/"""/, { token: 'string.quote', next: '@pop' }],
      [/[^"\\]+/, 'string'],
      [/./, 'string'],
    ],
  },
};

export const graphqlLanguageConfiguration: monaco.languages.LanguageConfiguration = {
  comments: { lineComment: '#' },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
};

/** Register the language id + tokenizer + configuration on the Monaco
 *  singleton — called once from the bootstrap's synchronous phase. */
export function registerGraphqlLanguage(monacoApi: {
  languages: Pick<typeof monaco.languages, 'register' | 'setMonarchTokensProvider' | 'setLanguageConfiguration'>;
}): void {
  monacoApi.languages.register({ id: 'graphql', extensions: ['.graphql', '.gql'], aliases: ['GraphQL'] });
  monacoApi.languages.setMonarchTokensProvider('graphql', graphqlMonarch);
  monacoApi.languages.setLanguageConfiguration('graphql', graphqlLanguageConfiguration);
}
