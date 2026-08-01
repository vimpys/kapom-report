import type { Table } from 'jspdf-autotable';

/**
 * jspdf-autotable sets lastAutoTable on the doc after autoTable() but doesn't declare its type —
 * a single augmentation here, so no `any` leaks out
 */
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: Table;
  }
}
