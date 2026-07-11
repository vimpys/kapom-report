import type { jsPDF } from 'jspdf';
import type { MeasurableBlock } from './context';

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

/**
 * a declarative page band — the header/footer content is a block tree (already resolved into
 * MeasurableBlocks), rendered into the reserved zone on every page via a confined context, so
 * no raw `doc` render callback is needed. The engine draws these; the facade resolves a user's
 * `children` into `blocks`. Children are restricted the same way a row/box's are (no table/
 * section — they'd paginate inside a fixed zone).
 */
export interface BlockBand {
  /** reserved zone height (mm); omit = the engine auto-measures the blocks' total height */
  height?: number;
  blocks: readonly MeasurableBlock[];
  /** draw on the first page too? — default true */
  showOnFirstPage?: boolean;
}

/** a band is either a raw render callback (PageBand) or a resolved block tree (BlockBand) */
export type PageBandLike = PageBand | BlockBand;

export function isBlockBand(band: PageBandLike): band is BlockBand {
  return 'blocks' in band;
}
