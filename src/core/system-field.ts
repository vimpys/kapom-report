import { formatDate, formatDateTime, formatTime } from '../format/date-format';
import type { DateFormat } from '../format/date-format';
import { KapomError } from './errors';

/**
 * Values the engine injects automatically (roadmap 7) — distinct from a user's own data fields.
 * pageNumber/totalPages are only known for real at finalize() (naturally two-pass, since
 * finalize iterates every page in the doc after rendering finishes — see PageBand/Watermark).
 * sectionName/groupName/reportTitle/generatedBy/sectionPageNumber are not supported yet
 * (would need threading extra context across the tree, which has no attachment point yet —
 * deferred until there's a real pain point).
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
      throw new KapomError(`SystemField: unknown token '{${token}}'`);
  }
}

/** Substitutes every {token} in the template with a real value — an unrecognized token throws immediately (fail-fast against a silent typo) */
export function resolveSystemFields(
  template: string,
  values: SystemFieldValues,
  dateFormat?: DateFormat,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, token: string) =>
    resolveSystemFieldToken(token, values, dateFormat),
  );
}
