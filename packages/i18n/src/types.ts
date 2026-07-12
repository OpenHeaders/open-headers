/**
 * Message and catalog shapes.
 *
 * A message is either a plain template string with `{name}` placeholders
 * or an authored function for anything a template can't express (plurals,
 * grammatical selection). Function messages receive the interpolation
 * args plus the active locale and return the final string — there is no
 * runtime message-format parser anywhere in this package.
 */

export type MessageArgValue = string | number;
export type MessageArgs = Readonly<Record<string, MessageArgValue>>;

export type MessageFn = (args: MessageArgs, locale: string) => string;
export type Message = string | MessageFn;

export type Catalog = Readonly<Record<string, Message>>;

export type LocaleDirection = 'ltr' | 'rtl';

export interface LocaleDef {
  /** BCP-47 code; also the settings value and the catalog id. */
  code: string;
  /** Name in English, for tooling and translator handoff. */
  englishName: string;
  /** Name in the locale itself — what the language picker shows. */
  nativeName: string;
  direction: LocaleDirection;
  /**
   * Synthetic locales (pseudo) are selectable but never the result of
   * `auto` resolution and never offered to translators.
   */
  synthetic?: boolean;
}
