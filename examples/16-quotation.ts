/**
 * Demo — Quotation (a real-world branded business document)
 * Focus: composing a complete document by mixing facade blocks (table/divider/signature/spacer)
 * with { type: 'raw' } escape hatches for the layouts the lib has no block for: a two-column
 * brand header, a centered title, side-by-side label+paragraph sections, and a highlighted
 * grand-total box. The engine still owns the cursor and page-breaks throughout — each raw block
 * only fills in measure() + draw(), and all text goes through the exported drawText() facade.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKapomReport, drawText } from '../src/index';
import type { RawNode, ReportNodeInput, RGB, TableNode } from '../src/index';
import { fontConfig, saveReport } from './shared';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../src/assets/kapom-report.png')));

/** jsPDF doc type, without the demo having to import jspdf itself */
type Doc = Parameters<RawNode['draw']>[0];

const BRAND: RGB = [47, 138, 87];
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [95, 95, 95];
const WHITE: RGB = [255, 255, 255];

interface QuotationItem {
  description: string;
  qty: number;
  unitPrice: number;
}

const quotation = {
  number: 'QT-2026-0042',
  date: '2026-07-10',
  validUntil: '2026-08-09',
  customerId: 'CU-1188',
  customer: {
    name: 'Gerrit Kruger',
    lines: ['123 Anywhere St., Any City', 'Limpopo, 1234', '082 345 6789'],
  },
  projectDescription: [
    'Private 4-person travel package in Chiang Mai: a full-day city tour,',
    'round-trip airport transfers, and 7-day travel insurance for the group.',
  ],
  items: [
    { description: 'City tour package — full day (per person)', qty: 4, unitPrice: 1500 },
    { description: 'Airport transfer — round trip (per van)', qty: 2, unitPrice: 900 },
    { description: 'Travel insurance — 7 days (per person)', qty: 4, unitPrice: 350 },
  ] as readonly QuotationItem[],
  vatRate: 0.07,
  terms: [
    'Above information is not an invoice and only an estimate of the services described.',
    'Payment will be due prior to provision of the services listed above.',
  ],
};

const subtotal = quotation.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
const vat = subtotal * quotation.vatRate;
const grandTotal = subtotal + vat;

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function setText(doc: Doc, size: number, style: 'normal' | 'bold', color: RGB): void {
  doc.setFontSize(size);
  doc.setFont('Sarabun', style);
  doc.setTextColor(color[0], color[1], color[2]);
}

function rightText(doc: Doc, text: string, rightX: number, baseline: number): void {
  drawText(doc, text, rightX - doc.getTextWidth(text), baseline);
}

function centerText(doc: Doc, text: string, centerX: number, baseline: number): void {
  drawText(doc, text, centerX - doc.getTextWidth(text) / 2, baseline);
}

/** brand header — logo + company name on the left, contact lines right-aligned (raw: two columns on one row) */
const brandHeader: ReportNodeInput<QuotationItem> = {
  type: 'raw',
  measure: () => 18,
  draw: (doc, { x, y, contentWidth }) => {
    doc.addImage(logo, 'PNG', x, y, 14, 14); // source PNG is 1:1, so a square box keeps the aspect
    setText(doc, 12, 'bold', BRAND);
    drawText(doc, 'KAPOM TRAVEL', x + 17, y + 7);
    drawText(doc, 'AND TOURS', x + 17, y + 12);

    setText(doc, 8.5, 'normal', BRAND);
    const right = x + contentWidth;
    rightText(doc, '123 ANYWHERE ST., ANY SUBURB, ANY CITY', right, y + 5);
    rightText(doc, '082 345 6789', right, y + 9.5);
    rightText(doc, 'WWW.KAPOMTRAVEL.COM', right, y + 14);
  },
};

/** centered page title (raw: TextNode has no center alignment) */
const title: ReportNodeInput<QuotationItem> = {
  type: 'raw',
  measure: () => 12,
  draw: (doc, { x, y, contentWidth }) => {
    setText(doc, 24, 'bold', BRAND);
    centerText(doc, 'QUOTATION', x + contentWidth / 2, y + 9);
  },
};

const INFO_PITCH = 5.5;
const infoRows: ReadonlyArray<readonly [string, string]> = [
  ['Quotation No:', quotation.number],
  ['Date:', quotation.date],
  ['Valid Until:', quotation.validUntil],
  ['Customer ID:', quotation.customerId],
];

/** quotation meta (bold label + value) on the left, customer block on the right */
const infoBlock: ReportNodeInput<QuotationItem> = {
  type: 'raw',
  measure: () => infoRows.length * INFO_PITCH + 2,
  draw: (doc, { x, y, contentWidth }) => {
    infoRows.forEach(([label, value], i) => {
      const baseline = y + 4 + i * INFO_PITCH;
      setText(doc, 10, 'bold', INK);
      drawText(doc, label, x, baseline);
      setText(doc, 10, 'normal', INK);
      drawText(doc, value, x + 32, baseline);
    });

    const rightCol = x + contentWidth * 0.55;
    setText(doc, 10, 'bold', INK);
    drawText(doc, quotation.customer.name, rightCol, y + 4);
    setText(doc, 10, 'normal', INK);
    quotation.customer.lines.forEach((line, i) => {
      drawText(doc, line, rightCol, y + 4 + (i + 1) * INFO_PITCH);
    });
  },
};

const SECTION_LABEL_WIDTH = 52;
const SECTION_PITCH = 5;

/** bold section label on the left + paragraph lines on the right (+ optional bold confirm line below) */
function labeledSection(
  label: string,
  paragraph: readonly string[],
  confirmLine?: string,
): ReportNodeInput<QuotationItem> {
  const rows = Math.max(1, paragraph.length) + (confirmLine !== undefined ? 2 : 0);
  return {
    type: 'raw',
    measure: () => rows * SECTION_PITCH + 2,
    draw: (doc, { x, y }) => {
      const firstBaseline = y + 4;
      setText(doc, 10.5, 'bold', INK);
      drawText(doc, label, x, firstBaseline);

      setText(doc, 10, 'normal', MUTED);
      paragraph.forEach((line, i) => {
        drawText(doc, line, x + SECTION_LABEL_WIDTH, firstBaseline + i * SECTION_PITCH);
      });

      if (confirmLine !== undefined) {
        setText(doc, 10.5, 'bold', INK);
        drawText(
          doc,
          confirmLine,
          x + SECTION_LABEL_WIDTH,
          firstBaseline + (paragraph.length + 1) * SECTION_PITCH,
        );
      }
    },
  };
}

/** line items — a plain table block; Total is a computed column, zebra gives the striped body */
const itemsTable: TableNode<QuotationItem> = {
  type: 'table',
  columns: [
    { type: 'data', key: 'description', header: 'Description' },
    { type: 'data', key: 'qty', header: 'Quantity', align: 'center' },
    { type: 'data', key: 'unitPrice', header: 'Price', align: 'right', numberFormat: {} },
    {
      type: 'computed',
      header: 'Total',
      align: 'right',
      compute: (row) => row.qty * row.unitPrice,
      numberFormat: {},
    },
  ],
  data: quotation.items,
  style: { zebra: { even: [242, 242, 242] } },
};

const TOTAL_PITCH = 6.5;

/** summary column on the right — Subtotal / VAT rows, then the grand total in a filled brand-color box */
const totalsBlock: ReportNodeInput<QuotationItem> = {
  type: 'raw',
  measure: () => 3 * TOTAL_PITCH + 3,
  draw: (doc, { x, y, contentWidth }) => {
    const right = x + contentWidth;
    const labelX = right - 78;

    setText(doc, 10, 'normal', INK);
    drawText(doc, 'Subtotal', labelX, y + 4);
    rightText(doc, money(subtotal), right - 2, y + 4);
    drawText(doc, 'VAT (7%)', labelX, y + 4 + TOTAL_PITCH);
    rightText(doc, money(vat), right - 2, y + 4 + TOTAL_PITCH);

    const totalBaseline = y + 4 + 2 * TOTAL_PITCH;
    setText(doc, 10.5, 'bold', INK);
    drawText(doc, 'Total', labelX, totalBaseline);
    doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    doc.rect(right - 40, totalBaseline - 5, 40, 7.5, 'F');
    setText(doc, 10.5, 'bold', WHITE);
    rightText(doc, money(grandTotal), right - 2, totalBaseline);
  },
};

const report = createKapomReport<QuotationItem>({
  font: fontConfig,
  blocks: [
    brandHeader,
    { type: 'spacer', height: 2 },
    title,
    { type: 'spacer', height: 4 },
    infoBlock,
    { type: 'spacer', height: 4 },
    { type: 'divider', thickness: 1, color: BRAND },
    { type: 'spacer', height: 6 },
    labeledSection('PROJECT DESCRIPTION', quotation.projectDescription),
    { type: 'spacer', height: 4 },
    itemsTable,
    { type: 'spacer', height: 6 },
    totalsBlock,
    { type: 'spacer', height: 4 },
    { type: 'divider', thickness: 1, color: BRAND },
    { type: 'spacer', height: 6 },
    labeledSection('TERMS & CONDITIONS', quotation.terms, 'PLEASE CONFIRM YOUR ACCEPTANCE OF THIS QUOTE'),
    { type: 'spacer', height: 10 },
    {
      type: 'signature',
      slots: [{ label: 'Signature over printed name' }, { label: 'Date signed' }],
      signHeight: 12,
    },
  ],
});

saveReport(report, '16-quotation');
