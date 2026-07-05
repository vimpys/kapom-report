import type { Table } from 'jspdf-autotable';

/**
 * jspdf-autotable ใส่ lastAutoTable ลง doc หลัง autoTable() แต่ไม่ประกาศ type —
 * augmentation ครั้งเดียวที่นี่ตาม decision ใน CLAUDE.md (ไม่มี any รั่ว)
 */
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: Table;
  }
}
