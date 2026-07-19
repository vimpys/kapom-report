/**
 * File 2 of 3 — the report template.
 * The "advanced" showcase: built with the low-level `createKapomReport({ blocks })` object form
 * (not the `reportBuilder()` chain the other demos use) so you can see the declarative tree
 * directly. It combines, in one report:
 *   - a declarative page-header band (logo + "Kapom Report" + printed timestamp) and a page footer
 *   - a master-detail table with a multi-row (column-group) header
 *   - two levels of summary: a subtotal on each nested child table, plus a master grand total
 *   - a value-driven per-column cell highlight (a negative/returned line total turns red)
 *   - a "Summary section" content block: two equal, bordered boxes side by side
 *   - a margin-only page number
 *
 * Palette: the same pastel-green family as demo 11-quotation (Kapom Report's main colour), applied via the
 * per-table `style.header` override and the box/divider colours.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { col, createKapomReport, divider, formatTimestamp, spacer } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import { type LineItem, type Order, orderAmount, orderQty } from './data';

const here = dirname(fileURLToPath(import.meta.url));
const logo = new Uint8Array(readFileSync(join(here, '../../src/assets/kapom-report.png')));

/** pastel-green theme — the Kapom Report main colour */
const HEAD_FILL: RGB = [183, 222, 189]; // master header
const CHILD_FILL: RGB = [220, 239, 222]; // nested child header (a touch lighter)
const LINE: RGB = [156, 203, 164]; // green hairline (box borders)
const DARK: RGB = [40, 92, 58]; // text on the green fills
const SAGE: RGB = [106, 158, 120]; // brand rule
const TINT: RGB = [237, 246, 238]; // nested subtotal fill (light green)
const TOTAL: RGB = [62, 112, 80]; // master grand-total fill (deep green)
const WHITE: RGB = [255, 255, 255];
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [95, 95, 95];
const RED: RGB = [198, 40, 40]; // negative-amount highlight
const RED_TINT: RGB = [250, 226, 226]; // softer red for the wider master Amount cell

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Node = ReportNodeInput<Order>;

// ── the master-detail table ─────────────────────────────────────────────

/** one order's line items as a sub-table, with its own subtotal foot (the nested-level summary) */
function childTable(items: readonly LineItem[]): TableNode<unknown> {
  const c = col<LineItem>();
  const table: TableNode<LineItem> = {
    type: 'table',
    columns: [
      c.data('item', 'Item'),
      c.data('unitPrice', 'Unit price', { align: 'right', numberFormat: { fractionDigits: 2 } }),
      c.data('qty', 'Qty', { align: 'right', aggregate: 'sum' }),
      c.computed('Line total', (li) => li.unitPrice * li.qty, {
        align: 'right',
        aggregate: 'sum',
        numberFormat: { fractionDigits: 2 },
        // per-column conditional cell style: only this cell turns red when the line total is negative
        conditionalStyle: (li) => (li.unitPrice * li.qty < 0 ? { fillColor: RED, textColor: WHITE } : undefined),
      }),
    ],
    data: items,
    summaryLabel: 'Subtotal',
    // header + subtotal foot both themed green (footer override merges over the summary token)
    style: { header: { fillColor: CHILD_FILL, textColor: DARK }, footer: { fillColor: TINT, textColor: DARK } },
  };
  // a concrete child TableNode<LineItem> can't assign to nested's TableNode<unknown> directly
  // (DataColumn.key: keyof T makes TableNode invariant in T) — cast once, same as ReportRegistry
  return table as unknown as TableNode<unknown>;
}

/** the master table: multi-header (two column groups), a nested child per order, master grand total */
function masterTable(orders: readonly Order[]): TableNode<Order> {
  const c = col<Order>();
  return {
    type: 'table',
    columns: [
      c.rowNumber(),
      c.group('Order info', [c.data('poNumber', 'PO no.'), c.data('vendor', 'Vendor')]),
      c.group('Financials', [
        c.computed('Qty', orderQty, { align: 'right', aggregate: 'sum', numberFormat: { fractionDigits: 0 } }),
        c.computed('Amount', orderAmount, {
          align: 'right',
          aggregate: 'sum',
          numberFormat: { fractionDigits: 2 },
          // the master Amount cell for an order that nets negative gets a soft red highlight too
          conditionalStyle: (o) => (orderAmount(o) < 0 ? { fillColor: RED_TINT, textColor: RED } : undefined),
        }),
      ]),
    ],
    data: orders,
    nested: (order) => childTable(order.items),
    nestedLayout: 'below', // child indented under the master row (keeps the multi-row master header)
    nestedIndentColumn: 1, // child left edge lines up after the row-number column
    summaryLabel: 'Grand total',
    // the grand-total foot now honours style.footer too (deep green) — same knob as the leaf foot
    style: { header: { fillColor: HEAD_FILL, textColor: DARK }, footer: { fillColor: TOTAL, textColor: WHITE } },
  };
}

// ── the "Summary section" — two equal bordered boxes side by side ─────────

/** one bordered summary box: a green title over right-aligned label/value rows */
const summaryBox = (title: string, rows: readonly (readonly [string, string])[]): Node => ({
  type: 'box',
  borderColor: LINE,
  borderWidth: 0.4,
  radius: 2, // rounded corners on the summary boxes
  padding: 3,
  children: [
    { content: title, style: { fontSize: 10, fontStyle: 'bold', color: DARK } },
    spacer(1.5),
    { type: 'keyValue', valueAlign: 'right', rows },
  ],
});

/** the two boxes in a row — no explicit widths, so they split the width equally */
function summarySection(orders: readonly Order[]): Node {
  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const totalQty = orders.reduce((sum, o) => sum + orderQty(o), 0);
  const subtotal = orders.reduce((sum, o) => sum + orderAmount(o), 0);
  const vat = subtotal * 0.07;
  const grandTotal = subtotal + vat;

  return {
    type: 'row',
    columns: [
      {
        children: [
          summaryBox('Order summary', [
            ['Total orders', String(orders.length)],
            ['Line items', String(totalItems)],
            ['Total qty', String(totalQty)],
          ]),
        ],
      },
      {
        children: [
          summaryBox('Financial summary', [
            ['Subtotal', money(subtotal)],
            ['VAT (7%)', money(vat)],
            ['Grand total', money(grandTotal)],
          ]),
        ],
      },
    ],
  };
}

// ── the report ────────────────────────────────────────────────────────────

export function buildAdvanceReport(orders: readonly Order[]): KapomReport {
  return createKapomReport<Order>({
    font: fontConfig,
    // a declarative page-header band — logo + brand (left) | printed timestamp (right), over a rule
    pageHeader: {
      children: [
        {
          type: 'row',
          columns: [
            { width: 12, children: [{ type: 'image', data: logo, format: 'PNG', width: 12, height: 12 }] },
            { children: [spacer(2), { content: 'Kapom Report', style: { fontSize: 13, fontStyle: 'bold', color: DARK } }] },
            {
              children: [
                spacer(3),
                { content: `Printed: ${formatTimestamp(new Date())}`, align: 'right', style: { fontSize: 8.5, color: MUTED } },
              ],
            },
          ],
        },
        divider({ thickness: 0.6, color: SAGE }),
      ],
    },
    pageFooter: {
      children: [
        divider({ thickness: 0.4, color: SAGE }),
        { content: 'Generated by kapom-report', style: { fontSize: 8, color: MUTED } },
      ],
    },
    // margin-only annotation — doesn't reduce the content area (unlike the footer band)
    pageNumber: { position: 'bottom-right', format: 'Page {pageNumber} of {totalPages}' },
    blocks: [
      { content: 'Advance Report', style: { fontSize: 19, fontStyle: 'bold', color: INK } },
      { content: 'Purchase orders with line items · Q3 2026', style: { fontSize: 9, color: MUTED } },
      spacer(5),
      masterTable(orders),
      spacer(6),
      { content: 'Summary section', style: { fontSize: 12, fontStyle: 'bold', color: DARK } },
      spacer(2),
      summarySection(orders),
    ],
  });
}
