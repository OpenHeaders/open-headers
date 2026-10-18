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
 *
 * An opener starts a GROUP; the bare lines after it belong to it. A
 * card with two or more groups folds every group the popover does not
 * light down to its opener line (the opener itself is the toggle, a
 * muted chevron riding it), so the lit packet
 * reads in full and the summary below the card stays above the fold —
 * the user's call, S8. A card with one group, or a group with no line
 * after its opener, folds nothing.
 */

import { Fragment, useState } from 'react';

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

interface LineGroup<Id extends string> {
  head: ExampleCardLine<Id>;
  rest: ExampleCardLine<Id>[];
}

/** The opener-led groups of a card; leading bare lines form a group
 *  of their own (never foldable — it has no opener row to fold to). */
function groupLines<Id extends string>(lines: ReadonlyArray<ExampleCardLine<Id>>): LineGroup<Id>[] {
  const groups: LineGroup<Id>[] = [];
  for (const line of lines) {
    const current = groups[groups.length - 1];
    if (line.opener !== undefined || current === undefined) groups.push({ head: line, rest: [] });
    else current.rest.push(line);
  }
  return groups;
}

function lineLit<Id extends string>(line: ExampleCardLine<Id>, lit: ReadonlySet<Id>): boolean {
  if (line.opener !== undefined && typeof line.opener !== 'string' && lit.has(line.opener.id)) return true;
  return line.tokens.some((token) => lit.has(token.id));
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
  const groups = groupLines(lines);
  const foldable = (group: LineGroup<Id>): boolean =>
    groups.length > 1 && group.head.opener !== undefined && group.rest.length > 0;
  // Open at mount: the groups the popover lights. The card mounts with
  // its popover, so each (i) opens on its own packet.
  const [open, setOpen] = useState<ReadonlySet<number>>(
    () => new Set(groups.flatMap((group, i) => ([group.head, ...group.rest].some((l) => lineLit(l, lit)) ? [i] : []))),
  );
  const toggle = (index: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const renderLine = (line: ExampleCardLine<Id>, fold?: { index: number; expanded: boolean }) => (
    <div
      className={`oh-info-eg-line${line.opener === undefined ? ' oh-info-eg-line--bare' : ''}`}
      key={line.opener !== undefined ? openerText(line.opener) : line.tokens[0]?.id}
    >
      {line.opener !== undefined &&
        (fold !== undefined ? (
          // The opener IS the fold toggle — verb and chevron one
          // button, hover on both — the user's call.
          <button
            type="button"
            className="oh-info-eg-fold"
            aria-label={openerText(line.opener)}
            aria-expanded={fold.expanded}
            onClick={() => toggle(fold.index)}
          >
            <span
              className={`oh-info-eg-method${
                typeof line.opener !== 'string' && lit.has(line.opener.id) ? ' oh-info-eg-hl' : ''
              }`}
            >
              {openerText(line.opener)}
            </span>
            <span className="oh-info-eg-fold-glyph">{fold.expanded ? '▾' : '▸'}</span>
          </button>
        ) : (
          <span
            className={`oh-info-eg-method${
              typeof line.opener !== 'string' && lit.has(line.opener.id) ? ' oh-info-eg-hl' : ''
            }`}
          >
            {openerText(line.opener)}
          </span>
        ))}
      <span className="oh-info-eg-toks">
        {line.tokens.map((token, i) => (
          <Fragment key={token.id}>
            {i > 0 ? ' · ' : null}
            <span className={`oh-info-eg-tok${lit.has(token.id) ? ' oh-info-eg-hl' : ''}`}>{token.text}</span>
          </Fragment>
        ))}
      </span>
    </div>
  );

  return (
    <div className="oh-info-eg">
      <div className="oh-info-eg-cap">{caption}</div>
      <div className="oh-info-eg-card">
        {groups.map((group, index) => {
          if (!foldable(group)) return [group.head, ...group.rest].map((line) => renderLine(line));
          const expanded = open.has(index);
          const rest = expanded ? group.rest.map((l) => renderLine(l)) : [];
          return [renderLine(group.head, { index, expanded }), ...rest];
        })}
      </div>
    </div>
  );
}
