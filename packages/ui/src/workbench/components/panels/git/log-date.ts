/**
 * IDE-log date column formatting: fresh commits read relative
 * ("5m ago"), today's read as a bare time, yesterday's as
 * "Yesterday HH:MM", and everything older as a full local date + time —
 * the graduated precision the reference log views use.
 */

import { formatAgo } from '@openheaders/ui/shared/awareness/format-ago';

const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
const DATE_ONLY: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `withTime` is the eye menu's Commit Timestamp toggle — on, dates
 *  older than yesterday carry their time too; off (the IDE default)
 *  they read as a bare date. */
export function formatLogDate(
  authoredAt: string,
  locale: string,
  yesterdayLabel: (time: string) => string,
  withTime = true,
  now: Date = new Date(),
): string {
  const date = new Date(authoredAt);
  if (Number.isNaN(date.getTime())) return authoredAt;
  const ageMs = now.getTime() - date.getTime();
  if (ageMs < 60 * 60 * 1000) return formatAgo(ageMs, locale);
  if (sameCalendarDay(date, now)) return date.toLocaleTimeString(locale, TIME);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) return yesterdayLabel(date.toLocaleTimeString(locale, TIME));
  return date.toLocaleString(locale, withTime ? DATE_TIME : DATE_ONLY);
}
