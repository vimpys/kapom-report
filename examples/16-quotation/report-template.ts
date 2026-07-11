/**
 * File 2 of 3 — the report template.
 * Data-agnostic: the whole quotation layout lives here (brand header, centered title, meta +
 * customer columns, project description, line-items table, right-aligned totals with a
 * highlighted grand-total box, terms, signature), exposed as `buildQuotation(quotation)`.
 * 100% declarative — no manual x/y, no raw jsPDF. Swap in any `Quotation` and the layout holds.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKapomReport } from '../../src/index';
import type { KapomReport, RGB } from '../../src/index';
import { fontConfig } from '../shared';
import type { Quotation, QuotationItem } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

/** pastel green theme — soft fills with sage text accents (deliberately its own palette, not any reference mockup's) */
const BRAND_TEXT: RGB = [106, 158, 120];
const BRAND_HEAD: RGB = [126, 172, 139];
const BRAND_FILL: RGB = [205, 231, 208];
const BRAND_LINE: RGB = [178, 214, 186];
const BRAND_DARK: RGB = [47, 93, 63];
const ZEBRA_FILL: RGB = [237, 246, 238];
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [95, 95, 95];

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const contactStyle = { fontSize: 8.5, color: BRAND_TEXT } as const;
const companyStyle = { fontSize: 12, fontStyle: 'bold', color: BRAND_TEXT } as const;
const headingStyle = { fontSize: 10.5, fontStyle: 'bold', color: INK } as const;

export function buildQuotation(quotation: Quotation): KapomReport {
  const subtotal = quotation.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const vat = subtotal * quotation.vatRate;
  const grandTotal = subtotal + vat;

  return createKapomReport<QuotationItem>({
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

      // ── line items — Total is a computed column, zebra tints the body ──
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
        style: { header: { fillColor: BRAND_HEAD }, zebra: { even: ZEBRA_FILL } },
      },
      { type: 'spacer', height: 6 },

      // ── totals — right column only; keyValue right-aligns the numbers, box highlights the total ──
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
              {
                type: 'row',
                columns: [
                  { children: [{ content: 'Total', style: headingStyle }] },
                  {
                    width: 40,
                    children: [
                      {
                        type: 'box',
                        background: BRAND_FILL,
                        padding: 1.5,
                        children: [
                          {
                            content: money(grandTotal),
                            align: 'right',
                            style: { fontSize: 10.5, fontStyle: 'bold', color: BRAND_DARK },
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
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
      // signature pinned to the bottom of the page, not flowing right after the terms
      {
        type: 'bottomAnchor',
        children: [
          {
            type: 'signature',
            slots: [{ label: 'Signature over printed name' }, { label: 'Date signed' }],
            signHeight: 12,
          },
        ],
      },
    ],
  });
}
