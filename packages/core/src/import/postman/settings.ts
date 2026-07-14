import * as v from 'valibot';
import { MAX_MAX_REDIRECTS, MaxRedirectsSchema, MIN_MAX_REDIRECTS } from '../../schemas/request';
import type { ImportedRequestSettings } from '../curl';
import { type ImportReport, recordDrop, recordTransform } from '../report';

// ── protocolProfileBehavior → request-settings knobs ────────────────

/**
 * Behavior keys with a shipped per-request settings knob. `strictSSL`
 * renames to `sslVerification`; the rest are name-identical. Every
 * mapped value is a boolean except `maxRedirects` (handled separately
 * — its value rides the schema bounds).
 */
type BooleanKnob = 'sslVerification' | 'followRedirects' | 'followOriginalHttpMethod' | 'followAuthorizationHeader';

const BOOLEAN_KNOBS: Readonly<Record<string, BooleanKnob>> = {
  strictSSL: 'sslVerification',
  followRedirects: 'followRedirects',
  followOriginalHttpMethod: 'followOriginalHttpMethod',
  followAuthorizationHeader: 'followAuthorizationHeader',
};

/**
 * Map an item's `protocolProfileBehavior` object onto the request
 * settings knobs the product ships. Keys without a counterpart knob
 * are dropped with a note naming the key — the object must never be
 * silently ignored. Returns `undefined` when nothing mapped, so
 * callers can leave `CurlRequest.settings` absent.
 */
export function mapProtocolProfileBehavior(
  raw: unknown,
  jsonPath: string,
  report: ImportReport,
): ImportedRequestSettings | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    recordDrop(report, {
      path: `${jsonPath}.protocolProfileBehavior`,
      reason: 'Protocol settings are not an object — ignored.',
      tracking: 'PERMANENT: Postman shape validation',
    });
    return undefined;
  }

  const settings: ImportedRequestSettings = {};
  let mapped = false;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const knob = BOOLEAN_KNOBS[key];
    if (knob !== undefined) {
      if (typeof value === 'boolean') {
        settings[knob] = value;
        mapped = true;
      } else {
        recordDrop(report, {
          path: `${jsonPath}.protocolProfileBehavior.${key}`,
          reason: `Protocol setting "${key}" expects a boolean, got ${JSON.stringify(value)} — not imported.`,
          tracking: 'PERMANENT: Postman shape validation',
        });
      }
      continue;
    }

    if (key === 'maxRedirects') {
      const bounded = v.safeParse(MaxRedirectsSchema, value);
      if (bounded.success) {
        settings.maxRedirects = bounded.output;
        mapped = true;
      } else if (typeof value === 'number' && Number.isInteger(value)) {
        const clamped = Math.min(Math.max(value, MIN_MAX_REDIRECTS), MAX_MAX_REDIRECTS);
        settings.maxRedirects = clamped;
        mapped = true;
        recordTransform(report, {
          path: `${jsonPath}.protocolProfileBehavior.maxRedirects`,
          from: String(value),
          to: String(clamped),
          reason: `The redirect cap is bounded to ${MIN_MAX_REDIRECTS}–${MAX_MAX_REDIRECTS}; the value was clamped.`,
        });
      } else {
        recordDrop(report, {
          path: `${jsonPath}.protocolProfileBehavior.maxRedirects`,
          reason: `Protocol setting "maxRedirects" expects an integer, got ${JSON.stringify(value)} — not imported.`,
          tracking: 'PERMANENT: Postman shape validation',
        });
      }
      continue;
    }

    // `disableBodyPruning: true` opts OUT of the vendor's own strip-the-
    // body-on-bodiless-methods behavior — sending the authored body is
    // exactly what our executor already does, so the value is
    // behaviorally identical and lossless to ignore. The vendor stamps
    // it on nearly every generated request, so noting it would bury a
    // real report under hundreds of no-op entries. `false` (prune)
    // genuinely differs and keeps the note.
    if (key === 'disableBodyPruning' && value === true) continue;

    recordDrop(report, {
      path: `${jsonPath}.protocolProfileBehavior.${key}`,
      reason: `Protocol setting "${key}" has no counterpart request setting — not imported.`,
      tracking: '#todo-request-settings',
    });
  }

  return mapped ? settings : undefined;
}
