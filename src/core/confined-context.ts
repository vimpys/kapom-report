import type { RenderContext } from './context';
import { KapomLayoutError } from './errors';

/**
 * A RenderContext confined to a fixed box (used by RowBlock's columns and BoxBlock's segments):
 * cursor.x pinned to the box's left edge, cursor.y tracked locally from the box's top edge
 * (advanceY moves only this box — the parent already reserved the full height and advances the
 * real cursor itself), margins/contentWidth describe the box. This is what lets a composite start
 * each column/segment back at the same top edge, which the real cursor can't do (PdfCursor.syncTo
 * never goes backwards) — the real cursor is never touched. ensureSpace is a no-op (space is
 * already reserved); syncCursor/forcePageBreak throw (their callers — table/section — are
 * rejected at build time by assertConfinedChildAllowed).
 */
export function buildConfinedContext(
  ctx: RenderContext,
  boxX: number,
  boxWidth: number,
  top: number,
  container: string,
): RenderContext {
  const pageWidth = ctx.margins.left + ctx.contentWidth + ctx.margins.right;
  const state = { y: top };

  return {
    ...ctx,
    cursor: {
      get x() {
        return boxX;
      },
      get y() {
        return state.y;
      },
      get pageIndex() {
        return ctx.cursor.pageIndex;
      },
    },
    margins: {
      ...ctx.margins,
      left: boxX,
      right: pageWidth - boxX - boxWidth,
    },
    contentWidth: boxWidth,
    advanceY: (amount) => {
      state.y += amount;
    },
    ensureSpace: () => {
      /* no-op — the parent reserved the full height before any child rendered */
    },
    syncCursor: () => {
      throw new KapomLayoutError(
        `${container}: a block that paginates itself cannot render inside a ${container}`,
      );
    },
    forcePageBreak: () => {
      throw new KapomLayoutError(`${container}: forcePageBreak is not supported inside a ${container}`);
    },
  };
}
