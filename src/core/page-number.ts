import type { jsPDF } from 'jspdf';
import { anchorX } from './anchor';
import { applyTextStyle, drawText } from './draw-text';
import { lineHeightOf } from './text-metrics';
import { resolveSystemFields } from './system-field';
import type { DateFormat } from '../format/date-format';
import type { PageMargins } from './context';
import type { HAlign, TextStyle } from '../types/primitives';

export type PageNumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * A lightweight page-number annotation — unlike pageHeader/pageFooter (PageBand), this never
 * reserves height from the content area. It's drawn directly inside the existing page margin
 * (which content never uses anyway), at a fixed position on every page. Reach for a `pageFooter`
 * band instead when the footer holds real content that must not overlap the body.
 */
export interface PageNumberOptions {
  /** default 'bottom-left' */
  position?: PageNumberPosition;
  /** template using {pageNumber}/{totalPages}/{date}/{time}/{dateTime} — default '{pageNumber} / {totalPages}' */
  format?: string;
  style?: Partial<TextStyle>;
  dateFormat?: DateFormat;
  /** draw on the first page too? — default true (unlike a watermark/letterhead, a page number is expected on every page including the first) */
  showOnFirstPage?: boolean;
}

/** the config the engine/facade accepts — `true` for the default, a position string shorthand, `false`/omitted to disable, or a full object */
export type PageNumberInput = boolean | PageNumberPosition | PageNumberOptions;

export const DEFAULT_PAGE_NUMBER_POSITION: PageNumberPosition = 'bottom-left';
export const DEFAULT_PAGE_NUMBER_FORMAT = '{pageNumber} / {totalPages}';
const DEFAULT_PAGE_NUMBER_STYLE: TextStyle = {
  fontSize: 9,
  fontStyle: 'normal',
  color: [0, 0, 0],
};

interface ResolvedPageNumber {
  position: PageNumberPosition;
  format: string;
  style: TextStyle;
  dateFormat: DateFormat | undefined;
  showOnFirstPage: boolean;
}

function isPositionShorthand(input: PageNumberInput): input is PageNumberPosition {
  return typeof input === 'string';
}

/** converts the 3-layer PageNumberInput into a canonical shape the engine renders from — `false`/undefined means disabled */
export function resolvePageNumber(input: PageNumberInput | undefined): ResolvedPageNumber | undefined {
  if (input === undefined || input === false) return undefined;
  if (input === true) {
    return {
      position: DEFAULT_PAGE_NUMBER_POSITION,
      format: DEFAULT_PAGE_NUMBER_FORMAT,
      style: DEFAULT_PAGE_NUMBER_STYLE,
      dateFormat: undefined,
      showOnFirstPage: true,
    };
  }

  if (isPositionShorthand(input)) {
    return {
      position: input,
      format: DEFAULT_PAGE_NUMBER_FORMAT,
      style: DEFAULT_PAGE_NUMBER_STYLE,
      dateFormat: undefined,
      showOnFirstPage: true,
    };
  }

  return {
    position: input.position ?? DEFAULT_PAGE_NUMBER_POSITION,
    format: input.format ?? DEFAULT_PAGE_NUMBER_FORMAT,
    style: { ...DEFAULT_PAGE_NUMBER_STYLE, ...input.style },
    dateFormat: input.dateFormat,
    showOnFirstPage: input.showOnFirstPage ?? true,
  };
}

function horizontalAlign(position: PageNumberPosition): HAlign {
  if (position.endsWith('left')) return 'left';
  if (position.endsWith('right')) return 'right';
  return 'center';
}

/** the margin strip (top or bottom) a position renders into — never the reserved header/footer band, just the physical page margin */
function verticalStrip(position: PageNumberPosition, margins: PageMargins, pageHeight: number): { top: number; height: number } {
  return position.startsWith('top')
    ? { top: 0, height: margins.top }
    : { top: pageHeight - margins.bottom, height: margins.bottom };
}

/**
 * Draws one page's page-number text, vertically centered in the margin strip (same
 * top+height/2+lineHeight/2 baseline convention as createAnchoredBand's vertical centering)
 * and horizontally aligned within the page's content width (margins.left to pageWidth-margins.right).
 */
export function renderPageNumber(
  doc: jsPDF,
  pageIndex: number,
  pageCount: number,
  pageWidth: number,
  pageHeight: number,
  margins: PageMargins,
  resolved: ResolvedPageNumber,
  now: () => Date = () => new Date(),
): void {
  const text = resolveSystemFields(
    resolved.format,
    { pageNumber: pageIndex + 1, totalPages: pageCount, now: now() },
    resolved.dateFormat,
  );

  const previousSize = doc.getFontSize();
  const previousFont = doc.getFont();
  applyTextStyle(doc, resolved.style);

  const textWidth = doc.getTextWidth(text);
  const align = horizontalAlign(resolved.position);
  const x = anchorX(align, margins.left, pageWidth - margins.left - margins.right, textWidth);
  const strip = verticalStrip(resolved.position, margins, pageHeight);
  const lineHeight = lineHeightOf(doc, resolved.style.fontSize);
  const y = strip.top + strip.height / 2 + lineHeight / 2;

  drawText(doc, text, x, y);

  doc.setFontSize(previousSize);
  doc.setFont(previousFont.fontName, previousFont.fontStyle);
}
