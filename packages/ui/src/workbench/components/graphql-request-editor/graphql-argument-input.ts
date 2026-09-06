/**
 * The builder's argument value cell, the pure half: what the cell shows
 * for the document's value and what the document gets for the cell's
 * text. A String-like argument (String, ID, a custom scalar) QUOTES for
 * the user — the cell holds the bare text and the document the escaped
 * literal, so every keystroke lands a valid value (the live-typing law);
 * a `$variable` typed there passes through and an empty cell is `""`.
 * Every other type (Int, Float, Boolean, enums, lists, input objects)
 * takes the text as one GraphQL value verbatim and answers `invalid`
 * until it parses as one. Removing the argument is the checkbox's.
 */

import {
  type GraphqlInputValue,
  type GraphqlSchema,
  namedTypeOf,
  parseValue,
  printNode,
  printString,
  type ValueNode,
} from '@openheaders/core/graphql';

const BARE_SCALARS: ReadonlySet<string> = new Set(['Int', 'Float', 'Boolean']);

/** Whether the cell quotes for the user — String, ID and the custom scalars. */
export function argumentQuotes(arg: GraphqlInputValue, schema: GraphqlSchema): boolean {
  const named = schema.types.get(namedTypeOf(arg.type));
  return named !== undefined && named.kind === 'SCALAR' && !BARE_SCALARS.has(named.name);
}

/** The cell's text for the document's value — the bare string of a quoted literal, the printed node otherwise; '' when unset. */
export function argumentInputText(value: ValueNode | null, quotes: boolean): string {
  if (value === null) return '';
  if (quotes && value.kind === 'StringValue') return value.value;
  return printNode(value);
}

/** The document's answer to the cell's text: lands as `text`, or waits while the text is not one value. */
export type ArgumentLiteral = { readonly kind: 'value'; readonly text: string } | { readonly kind: 'invalid' };

export function argumentLiteral(text: string, quotes: boolean): ArgumentLiteral {
  const trimmed = text.trim();
  if (quotes) {
    const variable = trimmed.startsWith('$') ? parseValue(trimmed).value : null;
    const passthrough = variable !== null && variable.kind === 'Variable';
    return { kind: 'value', text: passthrough ? trimmed : printString(text) };
  }
  return trimmed === '' || parseValue(trimmed).value === null ? { kind: 'invalid' } : { kind: 'value', text: trimmed };
}
