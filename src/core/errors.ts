/** base error ของทั้ง lib — instanceof KapomError ครอบทุก error ที่เรา throw เอง */
export class KapomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** layout invariant พัง — margin/page size ไม่ valid, advance ติดลบ ฯลฯ */
export class KapomLayoutError extends KapomError {}
