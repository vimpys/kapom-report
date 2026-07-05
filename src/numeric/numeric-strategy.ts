/**
 * ค่าที่รับได้ในระบบคำนวณ — number หรือ string (จาก DECIMAL column ของ DB)
 * mysql2/pg คืน DECIMAL เป็น string เพื่อคง precision → รับตรงๆ ไม่แปลง number
 */
export type Decimalish = number | string;

/**
 * Boundary ของ arithmetic ทั้งหมดใน Kapom Report
 * ห้ามเขียน `a + b` ตรงๆ ใน aggregate/computed/runningTotal — ต้องผ่าน strategy นี้
 * MVP ใช้ nativeNumeric; migrate decimal.js ทีหลังโดยไม่แตะ logic ที่เรียกใช้
 */
export interface NumericStrategy {
  add(a: Decimalish, b: Decimalish): Decimalish;
  subtract(a: Decimalish, b: Decimalish): Decimalish;
  multiply(a: Decimalish, b: Decimalish): Decimalish;
  divide(a: Decimalish, b: Decimalish): Decimalish;
  sum(values: readonly Decimalish[]): Decimalish;
  /** แปลงเป็น number สำหรับ jsPDF/Intl.NumberFormat ที่จุดสุดท้าย */
  toNumber(value: Decimalish): number;
}

const toNum = (value: Decimalish): number =>
  typeof value === 'number' ? value : Number(value);

export const nativeNumeric: NumericStrategy = {
  add: (a, b) => toNum(a) + toNum(b),
  subtract: (a, b) => toNum(a) - toNum(b),
  multiply: (a, b) => toNum(a) * toNum(b),
  divide: (a, b) => toNum(a) / toNum(b),
  sum: (values) => values.reduce<number>((acc, v) => acc + toNum(v), 0),
  toNumber: toNum,
} as const;
