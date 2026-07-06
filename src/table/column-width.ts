import type { jsPDF } from 'jspdf';

/** fallback เมื่อไม่ส่ง fontSize — ตรง default ของ AutoTable และ DEFAULT_TYPOGRAPHY.detailRow */
const AUTOTABLE_FONT_SIZE = 10;
/** cellPadding ซ้าย+ขวา โดยประมาณของ AutoTable default (5pt ต่อข้าง) ในหน่วย doc */
function paddingAllowance(doc: jsPDF): number {
  return (2 * 5) / doc.internal.scaleFactor;
}

/**
 * fix ความกว้าง column ล่วงหน้าชุดเดียว — จำเป็นกับ grouped table ที่แต่ละกลุ่ม
 * เป็น autoTable แยกกัน (ปล่อยให้แต่ละตัวคำนวณ auto เอง column จะเหลื่อมข้ามกลุ่ม)
 *
 * ไม่จำเป็นต้องแจกความกว้างเหมือนอัลกอริทึมภายในของ AutoTable เป๊ะ —
 * แค่ทุก segment ใช้ค่าชุดเดียวกัน เส้นแบ่ง column ก็ตรงกันทั้ง report;
 * ข้อความที่กว้างกว่าที่วัด AutoTable ตัดบรรทัดให้เอง (แถวสูงขึ้น ไม่ล้น)
 *
 * @param fontSize ต้องตรงกับ fontSize ที่ body ใช้จริง (typography.detailRow ที่ resolve แล้ว —
 *   ค้างแก้ #3: เดิม hardcode 10 ทำให้วัดผิดเมื่อ user override typography)
 */
export function computeColumnWidths(
  doc: jsPDF,
  rows: readonly (readonly string[])[],
  userWidths: readonly (number | undefined)[],
  contentWidth: number,
  fontSize: number = AUTOTABLE_FONT_SIZE,
): number[] {
  const previousSize = doc.getFontSize();
  doc.setFontSize(fontSize);
  const pad = paddingAllowance(doc);

  const natural: number[] = [];
  for (let i = 0; i < userWidths.length; i += 1) {
    const user = userWidths[i];
    if (user !== undefined) {
      natural.push(user);
      continue;
    }
    let widest = 0;
    for (const row of rows) {
      const cell = row[i];
      if (cell === undefined || cell === '') continue;
      // cell อาจมีหลายบรรทัด — ความกว้างธรรมชาติ = บรรทัดที่ยาวสุด
      for (const line of cell.split('\n')) {
        widest = Math.max(widest, doc.getTextWidth(line));
      }
    }
    natural.push(widest + pad);
  }
  doc.setFontSize(previousSize);

  // scale เฉพาะ column ที่ user ไม่ fix ให้รวมพอดี contentWidth (ทั้งหดและยืด —
  // AutoTable default ยืดตารางเต็มความกว้างเสมอ ทำให้ look สอดคล้องตาราง ungrouped)
  let fixedSum = 0;
  let flexSum = 0;
  natural.forEach((width, i) => {
    if (userWidths[i] !== undefined) fixedSum += width;
    else flexSum += width;
  });

  const targetFlex = contentWidth - fixedSum;
  if (flexSum <= 0 || targetFlex <= 0) return natural;

  const factor = targetFlex / flexSum;
  return natural.map((width, i) =>
    userWidths[i] !== undefined ? width : width * factor,
  );
}
