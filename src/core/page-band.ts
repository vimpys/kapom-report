import type { jsPDF } from 'jspdf';

/**
 * The context a band renderer receives — draws in the reserved zone (header/footer) of one page
 * A band is drawn at finalize (after rendering finishes), so it already knows the real pageCount → supports "page X / Y"
 */
export interface PageBandContext {
  readonly doc: jsPDF;
  /** 0-based — counts continuously across the whole document */
  readonly pageIndex: number;
  readonly pageCount: number;
  /** the rectangle of the band's zone (x,y = top-left corner) in the doc's units */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** draw text through the normalizer facade (the only place a band is allowed to touch text) */
  readonly drawText: (text: string, x: number, y: number) => void;
}

export type PageBandRenderer = (ctx: PageBandContext) => void;

/**
 * page header/footer — repeats on every page, reserves height outside the content flow
 * height is always subtracted from the content area; render() draws into that zone at finalize
 */
export interface PageBand {
  height: number;
  render: PageBandRenderer;
  /** draw on the first page too? — default true */
  showOnFirstPage?: boolean;
}
