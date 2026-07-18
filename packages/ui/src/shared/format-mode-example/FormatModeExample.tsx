/**
 * FormatModeExample — the format-mode (i) popover's shared diagram: ONE
 * example value rendered in both modes, so Formatted and Raw read as two
 * views of the same bytes rather than two different values. Same
 * example-card idiom as the network column popovers, hosted here because
 * the card renders in both the workbench (FormatAwareBodyEditor) and the
 * panel (FormatModeToggle).
 *
 * Fully prop-driven: the caption and mode labels arrive translated from
 * the host's own catalog family; the JSON example itself is raw wire
 * text and never translates.
 */

import './format-mode-example.css';

function Key({ text }: { text: string }) {
  return <span className="oh-fmt-eg-key">{text}</span>;
}

function Str({ text }: { text: string }) {
  return <span className="oh-fmt-eg-str">{text}</span>;
}

function Num({ text }: { text: string }) {
  return <span className="oh-fmt-eg-num">{text}</span>;
}

export interface FormatModeExampleProps {
  caption: string;
  formattedLabel: string;
  rawLabel: string;
}

export function FormatModeExample({ caption, formattedLabel, rawLabel }: FormatModeExampleProps) {
  return (
    <div className="oh-fmt-eg">
      <div className="oh-fmt-eg-cap">{caption}</div>
      <div className="oh-fmt-eg-card">
        <span className="oh-fmt-eg-chip oh-fmt-eg-chip--formatted">{formattedLabel}</span>
        <pre className="oh-fmt-eg-code">
          {'{\n  '}
          <Key text='"theme"' />
          {': '}
          <Str text='"dark"' />
          {',\n  '}
          <Key text='"tabs"' />
          {': '}
          <Num text="3" />
          {'\n}'}
        </pre>
        <span className="oh-fmt-eg-chip oh-fmt-eg-chip--raw">{rawLabel}</span>
        <pre className="oh-fmt-eg-code">
          {'{'}
          <Key text='"theme"' />
          {':'}
          <Str text='"dark"' />
          {','}
          <Key text='"tabs"' />
          {':'}
          <Num text="3" />
          {'}'}
        </pre>
      </div>
    </div>
  );
}
