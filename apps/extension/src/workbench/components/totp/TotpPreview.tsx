/**
 * TotpPreview — live-updating display of the current TOTP code for a
 * given seed + parameters.
 *
 * Computes once on mount + whenever the inputs change, then ticks at
 * 1Hz. The inner effect short-circuits when the time window hasn't
 * flipped — only the countdown remaining state advances on those
 * ticks, no crypto.subtle round-trip — keeping the editor responsive
 * even when several previews are mounted at once.
 *
 * Two density variants:
 *   - `default` — code + copy button + 22×22 countdown ring. Used in
 *     the VaultEditor row.
 *   - `compact` — code + 14×14 ring, no copy button. Used in the
 *     Inspector / suggestion-popover surfaces where horizontal space
 *     is at a premium.
 *
 * Errors (malformed base32, zero-byte seed) render as a small inline
 * danger message rather than throwing, so a typo in one row doesn't
 * crash the whole table.
 */

import { CopyOutlined } from '@ant-design/icons';
import { generateTotp, totpSecondsRemaining } from '@openheaders/core/totp';
import type { V5 } from '@openheaders/core/types';
import { App, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';

const { Text } = Typography;

export interface TotpPreviewProps {
  seed: string;
  algorithm: V5.TotpAlgorithm;
  digits: number;
  period: number;
  /** `compact` shrinks the code + ring + drops the copy button. */
  density?: 'default' | 'compact';
  /** When false (default `true`), suppress the copy button even on
   *  the `default` density — useful in surfaces where copying could
   *  leak the live code past the user's intent (popovers). */
  showCopy?: boolean;
}

const TotpPreview: React.FC<TotpPreviewProps> = ({
  seed,
  algorithm,
  digits,
  period,
  density = 'default',
  showCopy = true,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(() => totpSecondsRemaining(period));

  useEffect(() => {
    if (!seed.trim()) {
      setCode(null);
      setError(null);
      return;
    }
    let cancelled = false;
    let lastWindow = -1;
    let timeoutId: number | null = null;

    const compute = async () => {
      const nowMs = Date.now();
      const w = Math.floor(Math.floor(nowMs / 1000) / period);
      if (w === lastWindow) {
        setRemaining(totpSecondsRemaining(period, nowMs));
        return;
      }
      lastWindow = w;
      try {
        const next = await generateTotp({ seed, algorithm, digits, period, now: () => nowMs });
        if (!cancelled) {
          setCode(next);
          setError(null);
          setRemaining(totpSecondsRemaining(period, nowMs));
        }
      } catch (err) {
        if (!cancelled) {
          setCode(null);
          setError((err as Error).message);
        }
      }
    };

    // Self-rescheduling tick: aligns to the next window-flip wall-clock
    // boundary so the code rotation happens within ~50ms of the actual
    // flip — `setInterval(1000)` drifts up to a full second past the
    // boundary, which made the UI visibly lag the HTTP request.
    // Between flips we tick every 1s so the countdown number ticks
    // smoothly.
    const scheduleNext = () => {
      if (cancelled) return;
      const nowMs = Date.now();
      const flipMs = (Math.floor(nowMs / 1000 / period) + 1) * period * 1000;
      const msToFlip = flipMs - nowMs;
      // 50ms guardband AFTER the flip so the next compute reads the
      // new window. `Math.min(1000, ...)` keeps the countdown ticking
      // every second when the flip is more than 1s away.
      const delay = msToFlip <= 1000 ? msToFlip + 50 : 1000;
      timeoutId = window.setTimeout(async () => {
        await compute();
        scheduleNext();
      }, delay);
    };

    void compute();
    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [seed, algorithm, digits, period]);

  const compact = density === 'compact';
  const codeFontSize = compact ? 11 : 14;
  const ringSize = compact ? 14 : 22;
  const ringStroke = compact ? 1.5 : 2;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - remaining / period);
  const ringColor = remaining <= 5 ? token.colorErrorText : remaining <= 10 ? token.colorWarning : token.colorPrimary;

  if (error) {
    return (
      <Text type="danger" style={{ fontSize: compact ? 10 : 11 }}>
        {error}
      </Text>
    );
  }
  if (!seed.trim()) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 4 : 8 }}>
      <Text
        code
        style={{
          fontSize: codeFontSize,
          fontWeight: 600,
          letterSpacing: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {code ?? '—'}
      </Text>
      {!compact && showCopy && code && (
        <Tooltip title="Copy code">
          <CopyOutlined
            style={{ fontSize: 11, cursor: 'pointer', color: token.colorTextTertiary }}
            onClick={() => {
              void navigator.clipboard.writeText(code);
              void message.success('Copied');
            }}
          />
        </Tooltip>
      )}
      <Tooltip title={`Refreshes in ${remaining}s`}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg
            width={ringSize}
            height={ringSize}
            style={{ display: 'block' }}
            role="img"
            aria-label={`TOTP code refreshes in ${remaining} seconds`}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              fill="none"
              stroke={token.colorFillSecondary}
              strokeWidth={ringStroke}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={ringRadius}
              fill="none"
              stroke={ringColor}
              strokeWidth={ringStroke}
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringDashOffset}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <Text
            type="secondary"
            style={{
              fontSize: compact ? 10 : 11,
              fontVariantNumeric: 'tabular-nums',
              minWidth: 16,
              textAlign: 'right',
              color: ringColor,
            }}
          >
            {remaining}
          </Text>
        </span>
      </Tooltip>
    </span>
  );
};

export default TotpPreview;
