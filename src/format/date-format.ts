export interface DateFormat {
  locale?: string;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

/**
 * default locale 'en-CA' → an unambiguous YYYY-MM-DD — not defaulted to 'th-TH' because ICU
 * would automatically interpret the calendar as the Buddhist era (e.g. 2569 instead of 2026),
 * which isn't always what a user wants; the Thai locale/calendar can be chosen explicitly via
 * DateFormat.locale (e.g. 'th-TH-u-ca-buddhist') — per concept.md, which specifies this must
 * live in the formatter config, not be hardcoded in the resolver
 */
export const DEFAULT_DATE_FORMAT: Required<Pick<DateFormat, 'locale' | 'dateStyle'>> = {
  locale: 'en-CA',
  dateStyle: 'short',
};

/** Intl.DateTimeFormat is expensive to construct — cached per (locale + options), same as number-format.ts */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
}

export function formatDate(date: Date, format?: DateFormat): string {
  const locale = format?.locale ?? DEFAULT_DATE_FORMAT.locale;
  const dateStyle = format?.dateStyle ?? DEFAULT_DATE_FORMAT.dateStyle;
  return getDateTimeFormatter(locale, { dateStyle }).format(date);
}

export function formatTime(date: Date, format?: DateFormat): string {
  const locale = format?.locale ?? DEFAULT_DATE_FORMAT.locale;
  const timeStyle = format?.timeStyle ?? 'short';
  return getDateTimeFormatter(locale, { timeStyle }).format(date);
}

export function formatDateTime(date: Date, format?: DateFormat): string {
  const locale = format?.locale ?? DEFAULT_DATE_FORMAT.locale;
  const dateStyle = format?.dateStyle ?? DEFAULT_DATE_FORMAT.dateStyle;
  const timeStyle = format?.timeStyle ?? 'short';
  return getDateTimeFormatter(locale, { dateStyle, timeStyle }).format(date);
}
