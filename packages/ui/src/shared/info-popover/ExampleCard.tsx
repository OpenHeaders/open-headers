/**
 * ExampleCard — the shared example card a family of info popovers
 * renders in its diagram slot: one canonical concrete example (a
 * send, a session, a call) as lines of wire-vocabulary tokens, with
 * the popover's own slice lit. Every settings-row family (HTTP send,
 * MQTT session, WebSocket session, gRPC call) hands it its lines and
 * the lit ids, so the four cards share one markup and one look — the
 * `.oh-info-eg*` sheet — and a reader moving between editors meets
 * the same card. Tokens ride raw; only the caption is localized.
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
            className="oh-info-eg-line"
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
            {line.tokens.map((token, i) => (
              <Fragment key={token.id}>
                {i > 0 ? ' · ' : line.opener !== undefined ? ' ' : null}
                <span className={`oh-info-eg-tok${lit.has(token.id) ? ' oh-info-eg-hl' : ''}`}>{token.text}</span>
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
