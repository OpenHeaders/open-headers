/**
 * Curated picklists for the Overrides panel's locale and timezone facets (CDP
 * Control Plane, Phase F3b). The locale facet drives `Emulation.setLocaleOverride`
 * (a BCP-47 language tag); the timezone facet drives `Emulation.setTimezoneOverride`
 * (an IANA zone id). Both are large open sets, so a searchable list of common
 * values is friendlier than free text — these cover the everyday cases without
 * trying to be exhaustive.
 */

export interface OverrideOption {
  /** The literal id sent to CDP (BCP-47 tag / IANA zone id). */
  readonly value: string;
  /** Human label for the searchable dropdown. */
  readonly label: string;
}

/** Common BCP-47 language tags for the locale override. */
export const LOCALE_OPTIONS: readonly OverrideOption[] = [
  { value: 'en-US', label: 'English (United States) — en-US' },
  { value: 'en-GB', label: 'English (United Kingdom) — en-GB' },
  { value: 'fr-FR', label: 'French (France) — fr-FR' },
  { value: 'de-DE', label: 'German (Germany) — de-DE' },
  { value: 'es-ES', label: 'Spanish (Spain) — es-ES' },
  { value: 'es-MX', label: 'Spanish (Mexico) — es-MX' },
  { value: 'it-IT', label: 'Italian (Italy) — it-IT' },
  { value: 'pt-BR', label: 'Portuguese (Brazil) — pt-BR' },
  { value: 'nl-NL', label: 'Dutch (Netherlands) — nl-NL' },
  { value: 'pl-PL', label: 'Polish (Poland) — pl-PL' },
  { value: 'ru-RU', label: 'Russian (Russia) — ru-RU' },
  { value: 'tr-TR', label: 'Turkish (Türkiye) — tr-TR' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia) — ar-SA' },
  { value: 'hi-IN', label: 'Hindi (India) — hi-IN' },
  { value: 'ja-JP', label: 'Japanese (Japan) — ja-JP' },
  { value: 'ko-KR', label: 'Korean (South Korea) — ko-KR' },
  { value: 'zh-CN', label: 'Chinese (Simplified) — zh-CN' },
  { value: 'zh-TW', label: 'Chinese (Traditional) — zh-TW' },
  { value: 'sv-SE', label: 'Swedish (Sweden) — sv-SE' },
  { value: 'el-GR', label: 'Greek (Greece) — el-GR' },
];

/** Common IANA timezone ids for the timezone override. */
export const TIMEZONE_OPTIONS: readonly OverrideOption[] = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (US Pacific) — America/Los_Angeles' },
  { value: 'America/Denver', label: 'Denver (US Mountain) — America/Denver' },
  { value: 'America/Chicago', label: 'Chicago (US Central) — America/Chicago' },
  { value: 'America/New_York', label: 'New York (US Eastern) — America/New_York' },
  { value: 'America/Sao_Paulo', label: 'São Paulo — America/Sao_Paulo' },
  { value: 'Europe/London', label: 'London — Europe/London' },
  { value: 'Europe/Paris', label: 'Paris (Central European) — Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Berlin (Central European) — Europe/Berlin' },
  { value: 'Europe/Madrid', label: 'Madrid (Central European) — Europe/Madrid' },
  { value: 'Europe/Moscow', label: 'Moscow — Europe/Moscow' },
  { value: 'Africa/Cairo', label: 'Cairo — Africa/Cairo' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg — Africa/Johannesburg' },
  { value: 'Asia/Dubai', label: 'Dubai — Asia/Dubai' },
  { value: 'Asia/Kolkata', label: 'Kolkata (India) — Asia/Kolkata' },
  { value: 'Asia/Singapore', label: 'Singapore — Asia/Singapore' },
  { value: 'Asia/Shanghai', label: 'Shanghai — Asia/Shanghai' },
  { value: 'Asia/Tokyo', label: 'Tokyo — Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney — Australia/Sydney' },
  { value: 'Pacific/Auckland', label: 'Auckland — Pacific/Auckland' },
];
