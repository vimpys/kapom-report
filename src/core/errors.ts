/** base error ของทั้ง lib — instanceof KapomError ครอบทุก error ที่เรา throw เอง */
export class KapomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** layout invariant พัง — margin/page size ไม่ valid, advance ติดลบ ฯลฯ */
export class KapomLayoutError extends KapomError {}

/**
 * font config ไม่ valid — jsPDF fail แบบ silent (ตัวอักษรหาย/กลายเป็นสี่เหลี่ยม ไม่ throw)
 * เลยต้อง validate เองแบบ fail-fast ตอน register กันปัญหาไปโผล่ตอนเปิดไฟล์ PDF
 */
export class KapomFontError extends KapomError {}
