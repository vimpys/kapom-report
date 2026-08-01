import { buildConfinedContext } from '../core/confined-context';
import type { MeasurableBlock, MeasureContext, RenderContext } from '../core/context';
import { KapomError, KapomLayoutError } from '../core/errors';
import { sum } from '../core/layout-math';
import { deriveMeasureContext, measureBlocksHeight } from '../core/measure-context';
import type { BoxNode } from '../types/node';
import type { RGB } from '../types/primitives';

export const DEFAULT_BOX_PADDING = 2;
export const DEFAULT_BOX_BORDER_WIDTH = 0.2;

/** validate the node shape — fail-fast at build time, same convention as row/signature */
export function assertBoxNodeValid(node: BoxNode<unknown>): void {
  if (node.children.length === 0) {
    throw new KapomError('box: children must not be empty');
  }

  if (node.padding !== undefined && (!Number.isFinite(node.padding) || node.padding < 0)) {
    throw new KapomLayoutError(`box: padding must be >= 0 (got ${node.padding})`);
  }

  if (
    node.borderWidth !== undefined &&
    (!Number.isFinite(node.borderWidth) || node.borderWidth <= 0)
  ) {
    throw new KapomLayoutError(`box: borderWidth must be > 0 (got ${node.borderWidth})`);
  }

  if (node.radius !== undefined && (!Number.isFinite(node.radius) || node.radius < 0)) {
    throw new KapomLayoutError(`box: radius must be >= 0 (got ${node.radius})`);
  }
}

/** the paint/behavior options the factory resolves out of a BoxNode */
export interface BoxBlockOptions {
  readonly background: RGB | undefined;
  readonly borderColor: RGB | undefined;
  readonly borderWidth: number;
  readonly padding: number;
  readonly radius: number;
  readonly keepTogether: boolean;
}

/**
 * A painted container around a vertical stack of children. Default mode splits across pages at
 * child boundaries, "clone" style: measure children up front (measure === render for every
 * allowed child, so segment heights are known before anything is drawn — which is what lets the
 * background be painted *before* its content despite jsPDF having no z-order), greedily take
 * children that fit the space left on the current page, paint that segment's full box
 * (background + border + its own padding), render the children into a confined sub-context,
 * then forcePageBreak and continue with a fresh box at the top of the next page.
 * `keepTogether` opts out: the whole box moves to the next page instead, and content taller
 * than one full page throws. In both modes a *single child* taller than one full page throws
 * (no segmentation can place it) — fail-fast instead of silently drawing past the content area.
 */
export class BoxBlock implements MeasurableBlock {
  constructor(
    private readonly children: readonly MeasurableBlock[],
    private readonly options: BoxBlockOptions,
  ) {}

  /**
   * unbroken height (children + padding both sides) — when the box actually splits, each extra
   * segment adds its own padding so the real total can exceed this; an approximation is fine
   * here (same precedent as TableBlock.measureHeight) and it keeps the value safe for confined
   * parents (row/box) that reserve exactly this much and never split
   */
  measureHeight(ctx: MeasureContext): number {
    const inner: MeasureContext = { ...ctx, contentWidth: this.innerWidth(ctx.contentWidth) };

    return measureBlocksHeight(this.children, inner) + 2 * this.options.padding;
  }

  /**
   * a breakable box only needs room for its first child (+ padding) to start on the current
   * page — without this, the engine's break-before check (which uses full measureHeight) would
   * push a long box whole to a fresh page and the mid-page split would never happen; a
   * keepTogether box genuinely needs its full height, so it reports exactly that
   */
  minStartHeight(ctx: MeasureContext): number {
    if (this.options.keepTogether) return this.measureHeight(ctx);
    const inner: MeasureContext = { ...ctx, contentWidth: this.innerWidth(ctx.contentWidth) };
    const first = this.children[0];

    return (first ? first.measureHeight(inner) : 0) + 2 * this.options.padding;
  }

  render(ctx: RenderContext): void {
    const { padding, keepTogether } = this.options;
    const innerWidth = this.innerWidth(ctx.contentWidth);
    if (innerWidth <= 0) {
      throw new KapomLayoutError(
        `box: padding ${padding} leaves no content width inside ${ctx.contentWidth.toFixed(2)}`,
      );
    }

    const measureCtx: MeasureContext = { ...deriveMeasureContext(ctx), contentWidth: innerWidth };
    const heights = this.children.map((child) => child.measureHeight(measureCtx));
    const fullPageCapacity = ctx.contentBottom - ctx.contentTop - 2 * padding;

    const tallest = Math.max(...heights);
    if (tallest > fullPageCapacity) {
      throw new KapomLayoutError(
        `box: a single child is taller (${tallest.toFixed(2)}) than one full page of box content (${fullPageCapacity.toFixed(2)}) — no segmentation can place it; split that child's content up`,
      );
    }

    if (keepTogether) {
      this.renderKeepTogether(ctx, heights, innerWidth, fullPageCapacity);
    } else {
      this.renderBreakable(ctx, heights, innerWidth);
    }
  }

  /** whole box as one segment: not enough room = move to a fresh page; taller than a page = throw */
  private renderKeepTogether(
    ctx: RenderContext,
    heights: readonly number[],
    innerWidth: number,
    fullPageCapacity: number,
  ): void {
    const contentHeight = sum(heights);
    if (contentHeight > fullPageCapacity) {
      throw new KapomLayoutError(
        `box: content height ${contentHeight.toFixed(2)} is taller than one full page and keepTogether is set — split the content into multiple boxes or remove keepTogether`,
      );
    }

    const boxHeight = contentHeight + 2 * this.options.padding;
    ctx.ensureSpace(boxHeight);
    this.renderSegment(ctx, this.children, boxHeight, innerWidth);
    ctx.advanceY(boxHeight);
  }

  /** clone-style split: greedily fill each page, closing the box at every break */
  private renderBreakable(ctx: RenderContext, heights: readonly number[], innerWidth: number): void {
    const { padding } = this.options;
    let index = 0;

    while (index < this.children.length) {
      const capacity = ctx.contentBottom - ctx.cursor.y - 2 * padding;

      // take children while they fit the space left on this page
      let used = 0;
      const start = index;
      while (index < this.children.length) {
        const h = heights[index] ?? 0;
        if (used + h > capacity) break;
        used += h;
        index += 1;
      }

      if (index === start) {
        // nothing fits here — start the segment on a fresh page instead (always succeeds:
        // every child is <= fullPageCapacity, checked in render())
        ctx.forcePageBreak();
        continue;
      }

      const segmentHeight = used + 2 * padding;
      this.renderSegment(ctx, this.children.slice(start, index), segmentHeight, innerWidth);
      ctx.advanceY(segmentHeight);

      if (index < this.children.length) ctx.forcePageBreak();
    }
  }

  /** paint one closed box (fill + border) then render its children inside, inset by padding */
  private renderSegment(
    ctx: RenderContext,
    children: readonly MeasurableBlock[],
    boxHeight: number,
    innerWidth: number,
  ): void {
    const { background, borderColor, borderWidth, padding, radius } = this.options;
    const { doc } = ctx;
    const left = ctx.margins.left; // follows an indent override, same lesson as drawGroupBand
    const top = ctx.cursor.y;
    const width = ctx.contentWidth;

    // roundedRect for a positive radius, plain rect otherwise (keeps output identical when unset)
    const paint = (style: 'F' | 'S'): void => {
      if (radius > 0) doc.roundedRect(left, top, width, boxHeight, radius, radius, style);
      else doc.rect(left, top, width, boxHeight, style);
    };

    if (background) {
      doc.setFillColor(background[0], background[1], background[2]);
      paint('F');
    }

    if (borderColor) {
      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(borderWidth);
      paint('S');
    }

    const innerCtx = buildConfinedContext(ctx, left + padding, innerWidth, top + padding, 'box');
    for (const child of children) {
      child.render(innerCtx);
    }
  }

  private innerWidth(contentWidth: number): number {
    return contentWidth - 2 * this.options.padding;
  }
}
