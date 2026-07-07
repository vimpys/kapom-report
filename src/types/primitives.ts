export type HAlign = 'left' | 'center' | 'right';
export type FontStyle = 'normal' | 'bold' | 'italic';

/** RGB 0–255 — jsPDF uses a three-value tuple */
export type RGB = readonly [r: number, g: number, b: number];

/** utility: override just the fields you need in a nested structure */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface TextStyle {
  fontSize: number;
  fontStyle?: FontStyle;
  color?: RGB;
  fontFamily?: string;
}

export interface NumberFormat {
  locale?: string;
  /** shorthand: sets both min/max fraction digits at once — ignored per-side if that side is set explicitly */
  fractionDigits?: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface CellStyle {
  textColor?: RGB;
  fillColor?: RGB;
  fontStyle?: FontStyle;
  fontSize?: number;
  halign?: HAlign;
}
