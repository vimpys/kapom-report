import type { jsPDF } from 'jspdf';
import type { NumericStrategy } from '../numeric/numeric-strategy';
import type { Typography } from '../types/typography';

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** cursor state — read-only from outside a block */
export interface CursorState {
  readonly x: number;
  readonly y: number;
  readonly pageIndex: number;
}

/** context during measure — a block reports its height without drawing yet (doesn't touch doc state) */
export interface MeasureContext {
  readonly pageWidth: number;
  readonly contentWidth: number;
  readonly numeric: NumericStrategy;
  readonly typography: Typography;
  /** measure real text via jsPDF without drawing (splitTextToSize/getTextWidth) */
  readonly measureText: (text: string, fontSize: number, maxWidth: number) => number;
}

/** context during render — a block draws onto the doc; the cursor is managed by the engine */
export interface RenderContext {
  readonly doc: jsPDF;
  readonly cursor: CursorState;
  readonly margins: PageMargins;
  readonly contentWidth: number;
  /** top edge of the content area (below the reserved page-header) — absolute Y; a block that paginates itself (AutoTable) must use this to avoid drawing over a band */
  readonly contentTop: number;
  /** bottom edge of the content area (above the reserved page-footer) — absolute Y */
  readonly contentBottom: number;
  readonly numeric: NumericStrategy;
  readonly typography: Typography;
  /** the engine handles page-breaks — a block calls this to advance y */
  readonly advanceY: (amount: number) => void;
  readonly ensureSpace: (requiredHeight: number) => void;
  /**
   * for a block that paginates across pages itself (e.g. AutoTable) — tells the engine
   * which page/position the doc ended up at; pageIndex is 0-based and can't go backwards
   */
  readonly syncCursor: (pageIndex: number, y: number) => void;
  /**
   * force a new page regardless of whether there's enough room left (unlike ensureSpace,
   * which only breaks when there isn't enough space) — a no-op if the cursor is already at
   * the top of a page (avoids stacking blank pages); used for the page-break policy between
   * sections of a Composite Report (roadmap 6c)
   */
  readonly forcePageBreak: () => void;
}

/**
 * The shared contract for every block — it must answer two things: how tall, and how to draw.
 * text/image/table/group/report all implement this same interface.
 */
export interface MeasurableBlock {
  /** total height (recursive for composites like group/nested) */
  measureHeight(ctx: MeasureContext): number;
  /**
   * optional — the minimum height needed to *start* rendering, for a block that splits itself
   * across pages (e.g. a breakable box: just its first child + padding). The engine's render
   * loop (and StackBlock's per-child loop) uses this instead of measureHeight for the
   * break-before decision, so such a block can start in the space left on the current page and
   * continue on the next, instead of being pushed whole to a fresh page. Absent = the block
   * needs its full measureHeight up front (every non-splitting block).
   */
  minStartHeight?(ctx: MeasureContext): number;
  /** draw onto the doc; must not compute page-breaks itself — use ctx.ensureSpace */
  render(ctx: RenderContext): void;
}
