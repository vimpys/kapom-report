import { GState } from 'jspdf';
import type { jsPDF } from 'jspdf';
import { KapomError } from './errors';
import type { RGB } from '../types/primitives';

/** the jsPDF text options a watermark may pass through the facade (subset — rotation + alignment) */
export interface WatermarkTextOptions {
  /** rotation in degrees, counter-clockwise around (x, y) */
  angle?: number;
  align?: 'left' | 'center' | 'right';
  baseline?: 'alphabetic' | 'top' | 'middle' | 'bottom';
}

export interface WatermarkContext {
  readonly doc: jsPDF;
  /** 0-based — counts continuously across the whole document */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** the report's default font family — a preset watermark sets this so it never inherits ambient font state */
  readonly defaultFontFamily: string;
  /** draw text through the normalizer facade (the only place a watermark is allowed to touch text) */
  readonly drawText: (text: string, x: number, y: number, options?: WatermarkTextOptions) => void;
}

/** how the preset lays the text out on the page */
export type WatermarkLayout =
  /** one stamp centered on the page (default) */
  | 'single'
  /** one stamp auto-sized to span the page (fontSize is ignored — it's computed) */
  | 'stretch'
  /** the text repeated in a grid filling the whole page */
  | 'tile';

export type WatermarkRenderer = (ctx: WatermarkContext) => void;

/**
 * Drawn repeatedly on every page, doesn't subtract from the content area (unlike PageBand, which
 * subtracts contentTop/contentBottom) — drawn at finalize() after every page's content is done,
 * for the same reason as PageBand (AutoTable creates pages of its own, bypassing the engine's
 * onPageBreak), which means mechanically the watermark always draws "over" the content (jsPDF has
 * no z-order — whatever draws later sits on top). The user controls opacity themselves (e.g.
 * `doc.setGState(new jsPDF.GState({opacity: 0.15}))` before drawing, then reset to 1 afterward)
 * to make it "look like" it's beneath the content visually — raw `doc` access at the same level
 * as the Raw block/PageBand escape hatch.
 */
export interface Watermark {
  render: WatermarkRenderer;
  /** draw on the first page too? — default false */
  showOnFirstPage?: boolean;
}

/**
 * A helper that controls opacity around a draw call — sets the GState opacity before calling
 * draw, then always resets it back to 1, so a watermark renderer doesn't need to import GState
 * from jspdf itself (easier to use, same purpose as the drawText facade); a value outside 0-1 is
 * clamped by jsPDF itself.
 */
export function withOpacity(doc: jsPDF, opacity: number, draw: () => void): void {
  doc.setGState(new GState({ opacity }));
  try {
    draw();
  } finally {
    doc.setGState(new GState({ opacity: 1 }));
  }
}

export const DEFAULT_WATERMARK_OPACITY = 0.15;
export const DEFAULT_WATERMARK_FONT_SIZE = 60;
export const DEFAULT_WATERMARK_COLOR: RGB = [150, 150, 150];
export const DEFAULT_WATERMARK_ROTATE = 0;
export const DEFAULT_WATERMARK_LAYOUT: WatermarkLayout = 'single';

/**
 * Declarative preset — just give it a string and get a stamp centered on every
 * page, with no need to write a render callback or know jsPDF at all (same pattern as
 * createAnchoredBand, which did this for PageBand); reach for the full Watermark interface if you need more control.
 */
export interface TextWatermark {
  text: string;
  /** opacity 0-1 — default 0.15 */
  opacity?: number;
  /** pt — default 60; ignored when layout is 'stretch' (auto-sized) */
  fontSize?: number;
  /** default gray [150,150,150] */
  color?: RGB;
  /** rotation in degrees, counter-clockwise — default 0 (e.g. 45 for a diagonal stamp) */
  rotate?: number;
  /** how to lay the text out — default 'single' */
  layout?: WatermarkLayout;
  /** font family — default the report's registered default family (never inherits ambient font state) */
  fontFamily?: string;
  /** draw on the first page too? — default false */
  showOnFirstPage?: boolean;
}

/** the config the engine/facade accepts — a text preset, or a full render callback (escape hatch) */
export type WatermarkInput = Watermark | TextWatermark;

function isTextWatermark(input: WatermarkInput): input is TextWatermark {
  return 'text' in input;
}

const PT_TO_MM = 25.4 / 72;
/** stretch/tile helpers keep the text off the very edge — fraction of the span it's allowed to fill */
const STRETCH_FILL = 0.9;

/** one stamp centered on the page (jsPDF centers around the anchor, then rotates around it) */
function drawSingle(ctx: WatermarkContext, text: string, rotate: number): void {
  ctx.drawText(text, ctx.pageWidth / 2, ctx.pageHeight / 2, { angle: rotate, align: 'center', baseline: 'middle' });
}

/** one stamp auto-sized to span the page (its width, or the diagonal when rotated) */
function drawStretch(ctx: WatermarkContext, text: string, rotate: number, fontSize: number): void {
  const span = rotate % 180 === 0 ? ctx.pageWidth : Math.hypot(ctx.pageWidth, ctx.pageHeight);
  const width = ctx.doc.getTextWidth(text);
  if (width > 0) ctx.doc.setFontSize((fontSize * span * STRETCH_FILL) / width);
  ctx.drawText(text, ctx.pageWidth / 2, ctx.pageHeight / 2, { angle: rotate, align: 'center', baseline: 'middle' });
}

/** the text repeated in a grid filling the page — overscanned so rotated edge tiles still cover the corners */
function drawTile(ctx: WatermarkContext, text: string, rotate: number, fontSize: number): void {
  const width = ctx.doc.getTextWidth(text);
  const height = fontSize * PT_TO_MM;
  const stepX = width * 1.6;
  const stepY = height * 4;
  const over = width; // extend past every edge so tiles rotated at the border don't leave gaps
  for (let y = -over; y < ctx.pageHeight + over; y += stepY) {
    for (let x = -over; x < ctx.pageWidth + over; x += stepX) {
      ctx.drawText(text, x, y, { angle: rotate, baseline: 'middle' });
    }
  }
}

/** converts a WatermarkInput into the Watermark the engine uses — validates fail-fast at resolve time (before rendering) */
export function resolveWatermark(input: WatermarkInput): Watermark {
  if (!isTextWatermark(input)) return input;

  const { text } = input;
  const opacity = input.opacity ?? DEFAULT_WATERMARK_OPACITY;
  const fontSize = input.fontSize ?? DEFAULT_WATERMARK_FONT_SIZE;
  const color = input.color ?? DEFAULT_WATERMARK_COLOR;
  const rotate = input.rotate ?? DEFAULT_WATERMARK_ROTATE;
  const layout = input.layout ?? DEFAULT_WATERMARK_LAYOUT;

  if (text.trim() === '') {
    throw new KapomError('watermark: text must not be empty');
  }
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new KapomError(`watermark: opacity must be between 0 and 1 (got ${opacity})`);
  }
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new KapomError(`watermark: fontSize must be a positive number (got ${fontSize})`);
  }
  if (!Number.isFinite(rotate)) {
    throw new KapomError(`watermark: rotate must be a finite number of degrees (got ${rotate})`);
  }

  return {
    ...(input.showOnFirstPage !== undefined ? { showOnFirstPage: input.showOnFirstPage } : {}),
    render: (ctx) => {
      const fontFamily = input.fontFamily ?? ctx.defaultFontFamily;
      // fail-fast: an explicit font family must be registered (same spirit as the Thai font guard)
      if (input.fontFamily !== undefined && !(input.fontFamily in ctx.doc.getFontList())) {
        throw new KapomError(`watermark: fontFamily '${input.fontFamily}' is not registered`);
      }
      withOpacity(ctx.doc, opacity, () => {
        ctx.doc.setFont(fontFamily, 'normal');
        ctx.doc.setFontSize(fontSize);
        const [r, g, b] = color;
        ctx.doc.setTextColor(r, g, b);
        switch (layout) {
          case 'single':
            drawSingle(ctx, text, rotate);
            break;
          case 'stretch':
            drawStretch(ctx, text, rotate, fontSize);
            break;
          case 'tile':
            drawTile(ctx, text, rotate, fontSize);
            break;
          default: {
            const exhaustive: never = layout;
            throw new KapomError(`watermark: unknown layout ${String(exhaustive)}`);
          }
        }
      });
    },
  };
}
