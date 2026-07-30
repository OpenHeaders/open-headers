/**
 * DelayMsKnob — the delay-rule duration knob shared by the full rule
 * editor and the panel quick editors: a {@link ComboKnob} over
 * milliseconds with curated presets plus interpreted free entry
 * ("2s" → "2 s", "250" → "250 ms"). The field is REQUIRED — an empty
 * knob gates Save at every surface — so the placeholder is a
 * suggestion, not an effective default, and keeps placeholder
 * contrast.
 *
 * Bounds: min 1 because a 0ms delay makes the rule a no-op (the
 * compiler skips `delayMs === 0`), so it would save but never fire;
 * max 30 s is the cap the delay editors have always enforced.
 */
import type React from 'react';
import { ComboKnob, durationMsInterpreter, formatDurationMs, numericPresets } from '@openheaders/ui/shared/combo-knob';

export const MIN_DELAY_MS = 1;
export const MAX_DELAY_MS = 30_000;

const interpretDelay = durationMsInterpreter({ min: MIN_DELAY_MS, max: MAX_DELAY_MS });
const DELAY_PRESETS = numericPresets([100, 500, 1_000, 2_000, 5_000, 10_000, 30_000], formatDurationMs);

const DelayMsKnob: React.FC<{
  /** Optional so antd `Form.Item` can inject both props. */
  value?: number;
  onChange?: (value: number | undefined) => void;
  ariaLabel?: string;
}> = ({ value, onChange, ariaLabel }) => (
  <ComboKnob
    value={value}
    onChange={(v) => onChange?.(v)}
    presets={DELAY_PRESETS}
    interpret={interpretDelay}
    format={formatDurationMs}
    placeholder={formatDurationMs(1_000)}
    ariaLabel={ariaLabel}
    style={{ width: 160 }}
  />
);

export default DelayMsKnob;
