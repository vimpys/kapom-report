import type { Table } from 'jspdf-autotable';

/**
 * jspdf-autotable sets lastAutoTable on the doc after autoTable() but doesn't declare its type —
 * a single augmentation here per the decision in CLAUDE.md (no `any` leaking out)
 */
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable?: Table;
  }
}
