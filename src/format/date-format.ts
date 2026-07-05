export interface DateFormat {
  locale?: string;
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
  timeStyle?: 'full' | 'long' | 'medium' | 'short';
}

/**
 * default locale 'en-CA' → YYYY-MM-DD ไม่กำกวม — ไม่ default เป็น 'th-TH' เพราะ ICU ตีความปฏิทินเป็น
 * พุทธศักราชอัตโนมัติ (เช่น 2569 แทน 2026) ซึ่งอาจไม่ใช่สิ่งที่ผู้ใช้ต้องการเสมอไป; locale/ปฏิทินไทย
 * เลือกเองได้ผ่าน DateFormat.locale (เช่น 'th-TH-u-ca-buddhist') — ตาม concept.md ที่ระบุว่า
 * ต้องอยู่ใน formatter config ไม่ hardcode ใน resolver
 */
export const DEFAULT_DATE_FORMAT: Required<Pick<DateFormat, 'locale' | 'dateStyle'>> = {
  locale: 'en-CA',
  dateStyle: 'short',
};

/** Intl.DateTimeFormat สร้างแพง — cache ต่อ (locale + options) เหมือน number-format.ts */
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
