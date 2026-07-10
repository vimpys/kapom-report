/**
 * Demo — Quotation (a real-world branded business document)
 * Focus: composing a complete document declaratively — `row` for the side-by-side layouts
 * (brand header / meta+customer / label+paragraph sections / right-aligned totals), `keyValue`
 * for label:value rows, and `align` on plain text for the centered title. No manual x/y anywhere;
 * the single remaining { type: 'raw' } block is the highlighted grand-total box — a deliberate
 * example of the escape hatch coexisting with declarative blocks in one document.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKapomReport, drawText } from '../src/index';
import type { ReportNodeInput, RGB } from '../src/index';
import { fontConfig, saveReport } from './shared';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../src/assets/kapom-report.png')));

/** pastel green theme — soft fills with sage text accents (deliberately its own palette, not the reference mockup's) */
const BRAND_TEXT: RGB = [106, 158, 120]; // sage green — company name / title / contact lines
const BRAND_HEAD: RGB = [126, 172, 139]; // deeper pastel green — table head fill (white text on top)
const BRAND_FILL: RGB = [205, 231, 208]; // pastel green — grand-total box fill
const BRAND_LINE: RGB = [178, 214, 186]; // soft green — dividers
const BRAND_DARK: RGB = [47, 93, 63]; // deep green — readable text on the pastel fill
const ZEBRA_FILL: RGB = [237, 246, 238]; // very light green tint — table zebra rows
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [95, 95, 95];

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
  projectDescription:
    'Private 4-person travel package in Chiang Mai: a full-day city tour, round-trip airport transfers, and 7-day travel insurance for the group.',
  items: [
    { description: 'City tour package — full day (per person)', qty: 4, unitPrice: 1500 },
    { description: 'Airport transfer — round trip (per van)', qty: 2, unitPrice: 900 },
    { description: 'Travel insurance — 7 days (per person)', qty: 4, unitPrice: 350 },
  ] as readonly QuotationItem[],
  vatRate: 0.07,
  terms:
    'Above information is not an invoice and only an estimate of the services described. Payment will be due prior to provision of the services listed above.',
};

const subtotal = quotation.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
const vat = subtotal * quotation.vatRate;
const grandTotal = subtotal + vat;

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const contactStyle = { fontSize: 8.5, color: BRAND_TEXT } as const;
const companyStyle = { fontSize: 12, fontStyle: 'bold', color: BRAND_TEXT } as const;
const headingStyle = { fontSize: 10.5, fontStyle: 'bold', color: INK } as const;

/**
 * grand total in a filled brand-color box — the one layout the declarative blocks don't cover
 * (a text with a painted background), kept as a raw escape hatch on purpose
 */
const grandTotalBox: ReportNodeInput<QuotationItem> = {
  type: 'raw',
  measure: () => 8.5,
  draw: (doc, { x, y, contentWidth }) => {
    const right = x + contentWidth;
    doc.setFontSize(10.5);
    doc.setFont('Sarabun', 'bold');
    doc.setTextColor(INK[0], INK[1], INK[2]);
    drawText(doc, 'Total', x, y + 5.5);

    doc.setFillColor(BRAND_FILL[0], BRAND_FILL[1], BRAND_FILL[2]);
    doc.rect(right - 40, y, 40, 7.5, 'F');
    doc.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    const value = money(grandTotal);
    drawText(doc, value, right - 2 - doc.getTextWidth(value), y + 5.5);
  },
};

const report = createKapomReport<QuotationItem>({
  font: fontConfig,
  blocks: [
    // ── brand header: logo + company name (left) | contact lines right-aligned (right) ──
    {
      type: 'row',
      columns: [
        { width: 14, children: [{ type: 'image', data: logo, format: 'PNG', width: 14, height: 14 }] },
        {
          children: [
            { type: 'spacer', height: 2.5 },
            { content: 'KAPOM TRAVEL', style: companyStyle },
            { content: 'AND TOURS', style: companyStyle },
          ],
        },
        {
          children: [
            { type: 'spacer', height: 1.5 },
            { content: '123 ANYWHERE ST., ANY SUBURB, ANY CITY', align: 'right', style: contactStyle },
            { content: '082 345 6789', align: 'right', style: contactStyle },
            { content: 'WWW.KAPOMTRAVEL.COM', align: 'right', style: contactStyle },
          ],
        },
      ],
    },
    { type: 'spacer', height: 4 },

    // ── centered title — plain text with align, no raw block needed ──
    { content: 'QUOTATION', align: 'center', style: { fontSize: 24, fontStyle: 'bold', color: BRAND_TEXT } },
    { type: 'spacer', height: 5 },

    // ── quotation meta (left) | customer (right) ──
    {
      type: 'row',
      columns: [
        {
          children: [
            {
              type: 'keyValue',
              labelWidth: 32,
              rows: [
                ['Quotation No:', quotation.number],
                ['Date:', quotation.date],
                ['Valid Until:', quotation.validUntil],
                ['Customer ID:', quotation.customerId],
              ],
            },
          ],
        },
        {
          children: [
            { content: quotation.customer.name, style: { fontSize: 10, fontStyle: 'bold', color: INK } },
            ...quotation.customer.lines,
          ],
        },
      ],
    },
    { type: 'spacer', height: 4 },
    { type: 'divider', thickness: 1, color: BRAND_LINE },
    { type: 'spacer', height: 6 },

    // ── PROJECT DESCRIPTION — label column + auto-wrapping paragraph ──
    {
      type: 'row',
      columns: [
        { width: 52, children: [{ content: 'PROJECT DESCRIPTION', style: headingStyle }] },
        { children: [{ content: quotation.projectDescription, style: { fontSize: 10, color: MUTED } }] },
      ],
    },
    { type: 'spacer', height: 4 },

    // ── line items — Total is a computed column, zebra gives the striped body ──
    {
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
      // header: brand fill replacing AutoTable's theme default; zebra tints the body rows
      style: { header: { fillColor: BRAND_HEAD }, zebra: { even: ZEBRA_FILL } },
    },
    { type: 'spacer', height: 6 },

    // ── totals — right column only; keyValue right-aligns the numbers, raw box for the total ──
    {
      type: 'row',
      columns: [
        { children: [] },
        {
          width: 78,
          children: [
            {
              type: 'keyValue',
              valueAlign: 'right',
              rows: [
                ['Subtotal', money(subtotal)],
                ['VAT (7%)', money(vat)],
              ],
            },
            { type: 'spacer', height: 2 },
            grandTotalBox,
          ],
        },
      ],
    },
    { type: 'spacer', height: 4 },
    { type: 'divider', thickness: 1, color: BRAND_LINE },
    { type: 'spacer', height: 6 },

    // ── terms — same two-column shape as the description section ──
    {
      type: 'row',
      columns: [
        { width: 52, children: [{ content: 'TERMS & CONDITIONS', style: headingStyle }] },
        {
          children: [
            { content: quotation.terms, style: { fontSize: 10, color: MUTED } },
            { type: 'spacer', height: 5 },
            { content: 'PLEASE CONFIRM YOUR ACCEPTANCE OF THIS QUOTE', style: headingStyle },
          ],
        },
      ],
    },
    { type: 'spacer', height: 10 },

    {
      type: 'signature',
      slots: [{ label: 'Signature over printed name' }, { label: 'Date signed' }],
      signHeight: 12,
    },
  ],
});

saveReport(report, '16-quotation');
