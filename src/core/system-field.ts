import { formatDate, formatDateTime, formatTime } from '../format/date-format';
import type { DateFormat } from '../format/date-format';
import { KapomError } from './errors';

/**
 * ค่าที่ engine inject อัตโนมัติ (roadmap 7) — ต่างจาก data field ของ user
 * pageNumber/totalPages รู้ค่าจริงตอน finalize() เท่านั้น (two-pass โดยธรรมชาติของ
 * finalize ที่ iterate ทุกหน้าใน doc หลัง render จบแล้ว — ดู PageBand/Watermark)
 * sectionName/groupName/reportTitle/generatedBy/sectionPageNumber ยังไม่รองรับ
 * (ต้อง thread context เพิ่มข้าม tree ที่ยังไม่มีจุดต่อ — defer ไปเปิดตอนมี pain point จริง)
 */
export interface SystemFieldValues {
  /** 1-based */
  pageNumber: number;
  totalPages: number;
  now: Date;
}

function resolveSystemFieldToken(
  token: string,
  values: SystemFieldValues,
  dateFormat?: DateFormat,
): string {
  switch (token) {
    case 'pageNumber':
      return String(values.pageNumber);
    case 'totalPages':
      return String(values.totalPages);
    case 'date':
      return formatDate(values.now, dateFormat);
    case 'time':
      return formatTime(values.now, dateFormat);
    case 'dateTime':
      return formatDateTime(values.now, dateFormat);
    default:
      throw new KapomError(`SystemField: token '{${token}}' ไม่รู้จัก`);
  }
}

/** แทน {token} ทุกจุดใน template ด้วยค่าจริง — token ไม่รู้จัก throw ทันที (fail-fast กัน typo เงียบๆ) */
export function resolveSystemFields(
  template: string,
  values: SystemFieldValues,
  dateFormat?: DateFormat,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) =>
    resolveSystemFieldToken(token, values, dateFormat),
  );
}
