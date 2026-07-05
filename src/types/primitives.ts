export type HAlign = 'left' | 'center' | 'right';
export type FontStyle = 'normal' | 'bold' | 'italic';

/** RGB 0–255 — jsPDF ใช้ tuple สามค่า */
export type RGB = readonly [r: number, g: number, b: number];

/** utility: override เฉพาะ field ที่ต้องการในโครงสร้างซ้อน */
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
