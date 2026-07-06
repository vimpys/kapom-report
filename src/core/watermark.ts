import { GState } from 'jspdf';
import type { jsPDF } from 'jspdf';
import { KapomError } from './errors';
import type { RGB } from '../types/primitives';

export interface WatermarkContext {
  readonly doc: jsPDF;
  /** 0-based — counts continuously across the whole document */
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** draw text through the normalizer facade (the only place a watermark is allowed to touch text) */
  readonly drawText: (text: string, x: number, y: number) => void;
}

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
  /** draw on the first page too? — default true */
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

/**
 * Declarative preset (review fix #2) — just give it a string and get a stamp centered on every
 * page, with no need to write a render callback or know jsPDF at all (same pattern as
 * createAnchoredBand, which did this for PageBand); reach for the full Watermark interface if you need more control.
 */
export interface TextWatermark {
  text: string;
  /** opacity 0-1 — default 0.15 */
  opacity?: number;
  /** pt — default 60 */
  fontSize?: number;
  /** default gray [150,150,150] */
  color?: RGB;
  /** draw on the first page too? — default true */
  showOnFirstPage?: boolean;
}

/** the config the engine/facade accepts — a text preset, or a full render callback (escape hatch) */
export type WatermarkInput = Watermark | TextWatermark;

function isTextWatermark(input: WatermarkInput): input is TextWatermark {
  return 'text' in input;
}

/** converts a WatermarkInput into the Watermark the engine uses — validates fail-fast at resolve time (before rendering) */
export function resolveWatermark(input: WatermarkInput): Watermark {
  if (!isTextWatermark(input)) return input;

  const { text } = input;
  const opacity = input.opacity ?? DEFAULT_WATERMARK_OPACITY;
  const fontSize = input.fontSize ?? DEFAULT_WATERMARK_FONT_SIZE;
  const color = input.color ?? DEFAULT_WATERMARK_COLOR;

  if (text.trim() === '') {
    throw new KapomError('watermark: text must not be empty');
  }
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
    throw new KapomError(`watermark: opacity must be between 0 and 1 (got ${opacity})`);
  }
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    throw new KapomError(`watermark: fontSize must be a positive number (got ${fontSize})`);
  }

  return {
    ...(input.showOnFirstPage !== undefined ? { showOnFirstPage: input.showOnFirstPage } : {}),
    render: (ctx) => {
      withOpacity(ctx.doc, opacity, () => {
        ctx.doc.setFontSize(fontSize);
        const [r, g, b] = color;
        ctx.doc.setTextColor(r, g, b);
        // centers for real using the measured width (not a guessed offset) — always measured after setFontSize
        const textWidth = ctx.doc.getTextWidth(text);
        ctx.drawText(text, (ctx.pageWidth - textWidth) / 2, ctx.pageHeight / 2);
      });
    },
  };
}
