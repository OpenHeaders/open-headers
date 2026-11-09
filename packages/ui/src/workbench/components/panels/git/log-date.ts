/**
 * log-window date column formatting: fresh commits read relative
 * ("5m ago"), today's as "Today HH:MM", yesterday's as "Yesterday HH:MM",
 * and everything older as a full local date + time — the graduated
 * precision the reference log views use. The hour cycle follows the
 * workbench clock-format setting, never the locale (the UI language's
 * locale says AM/PM to users whose system runs a 24-hour clock).
 */

import { formatAgo } from '@openheaders/ui/shared/awareness/format-ago';
import type { ClockFormat } from '@openheaders/ui/workbench/settings/schema/appearance';

export type HourCycle = 'h23' | 'h12';

export const hourCycleFor = (clock: ClockFormat): HourCycle => (clock === '12h' ? 'h12' : 'h23');

export interface LogDateLabels {
  today: (time: string) => string;
  yesterday: (time: string) => string;
}

export interface LogDateOptions {
  /** The eye menu's Commit Timestamp toggle — on, dates older than
   *  yesterday carry their time too; off (the reference default) they
   *  read as a bare date. */
  withTime?: boolean;
  hourCycle?: HourCycle;
}

const DATE_ONLY: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatLogDate(
  authoredAt: string,
  locale: string,
  labels: LogDateLabels,
  { withTime = true, hourCycle = 'h23' }: LogDateOptions = {},
  now: Date = new Date(),
): string {
  const date = new Date(authoredAt);
  if (Number.isNaN(date.getTime())) return authoredAt;
  const ageMs = now.getTime() - date.getTime();
  if (ageMs < 60 * 60 * 1000) return formatAgo(ageMs, locale);
  const time: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle };
  if (sameCalendarDay(date, now)) return labels.today(date.toLocaleTimeString(locale, time));
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) return labels.yesterday(date.toLocaleTimeString(locale, time));
  return date.toLocaleString(locale, withTime ? { ...DATE_ONLY, ...time } : DATE_ONLY);
}

/** The row's hover title — the full local date and time on the same hour cycle. */
export function formatLogDateTitle(authoredAt: string, locale: string, hourCycle: HourCycle): string {
  const date = new Date(authoredAt);
  return Number.isNaN(date.getTime()) ? authoredAt : date.toLocaleString(locale, { hourCycle });
}
