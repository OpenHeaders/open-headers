/**
 * ExampleCard — the shared example card a family of info popovers
 * renders in its diagram slot: one canonical concrete example (a
 * send, a session, a call) as lines of wire-vocabulary tokens, with
 * the popover's own slice lit. Every settings-row family (HTTP send,
 * MQTT session, WebSocket session, gRPC call) hands it its lines and
 * the lit ids, so the four cards share one markup and one look — the
 * `.oh-info-eg*` sheet — and a reader moving between editors meets
 * the same card. Tokens ride raw; only the caption is localized.
 *
 * The card is a two-column grid: the openers fill the left column and
 * every line's tokens start from the same x (the lifecycle cards read
 * their hook labels as a column); a line without an opener spans both
 * columns, so a card of bare lines keeps its flush-left look.
 */

import { Fragment } from 'react';

export interface ExampleCardToken<Id extends string> {
  id: Id;
  text: string;
}

export interface ExampleCardLine<Id extends string> {
  /** Bold opener before the tokens — the verb of the line (POST,
   *  CONNECT, SUBSCRIBE, CALL). A token opener is also a slice
   *  (an auth header's scheme lights for the delivery rows). */
  opener?: string | ExampleCardToken<Id>;
  tokens: ReadonlyArray<ExampleCardToken<Id>>;
}

function openerText<Id extends string>(opener: string | ExampleCardToken<Id>): string {
  return typeof opener === 'string' ? opener : opener.text;
}

export function ExampleCard<Id extends string>({
  caption,
  lines,
  lit,
}: {
  caption: string;
  lines: ReadonlyArray<ExampleCardLine<Id>>;
  lit: ReadonlySet<Id>;
}) {
  return (
    <div className="oh-info-eg">
      <div className="oh-info-eg-cap">{caption}</div>
      <div className="oh-info-eg-card">
        {lines.map((line) => (
          <div
            className={`oh-info-eg-line${line.opener === undefined ? ' oh-info-eg-line--bare' : ''}`}
            key={line.opener !== undefined ? openerText(line.opener) : line.tokens[0]?.id}
          >
            {line.opener !== undefined && (
              <span
                className={`oh-info-eg-method${
                  typeof line.opener !== 'string' && lit.has(line.opener.id) ? ' oh-info-eg-hl' : ''
                }`}
              >
                {openerText(line.opener)}
              </span>
            )}
            <span className="oh-info-eg-toks">
              {line.tokens.map((token, i) => (
                <Fragment key={token.id}>
                  {i > 0 ? ' · ' : null}
                  <span className={`oh-info-eg-tok${lit.has(token.id) ? ' oh-info-eg-hl' : ''}`}>{token.text}</span>
                </Fragment>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
