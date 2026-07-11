/**
 * File 2 of 3 — the report template.
 * The field-service form layout, now *filled from data* — the same box/row/divider composition as
 * a blank form, but the empty cells and writing areas carry the actual values. Exposed as
 * `buildFieldServiceReport(report)`. Checkboxes render `[x]` for the service type performed.
 */
import { createKapomReport } from '../../src/index';
import type { KapomReport, ReportNodeInput, RGB, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { FieldServiceReport, PartUsed } from './data';

const NAVY: RGB = [40, 78, 120];
const LABEL_FILL: RGB = [238, 240, 243];
const BORDER: RGB = [180, 188, 198];
const INK: RGB = [40, 40, 40];
const MUTED: RGB = [110, 110, 110];
const WHITE: RGB = [255, 255, 255];

const SERVICE_TYPES = ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Emergency'] as const;

/** the report's block type — the whole form is one createKapomReport<PartUsed>, so its layout blocks share that T (ReportNode is invariant in T; the parts table is the only block that actually uses it) */
type Node = ReportNodeInput<PartUsed>;

const barText = { fontSize: 10, fontStyle: 'bold', color: WHITE } as const;
const labelText = { fontSize: 9.5, fontStyle: 'bold', color: INK } as const;
const valueText = { fontSize: 9.5, color: INK } as const;

/** full-width navy section bar with white bold text */
function sectionBar(title: string): Node {
  return { type: 'box', background: NAVY, padding: 1.6, children: [{ content: title, style: barText }] };
}

/** header bar + a bordered label:value list (a COMPANY / CUSTOMER details column) */
function detailUnit(header: string, rows: ReadonlyArray<readonly [string, string]>): Node {
  return {
    type: 'box',
    padding: 0,
    children: [
      sectionBar(header),
      { type: 'box', borderColor: BORDER, padding: 2.5, children: [{ type: 'keyValue', labelWidth: 26, rows }] },
    ],
  };
}

/** one job-details row: a filled label cell + a bordered cell carrying the value */
function fieldRow(label: string, value: string): Node {
  return {
    type: 'row',
    gap: 0,
    columns: [
      {
        width: 55,
        children: [
          { type: 'box', background: LABEL_FILL, borderColor: BORDER, padding: 2, children: [{ content: label, style: labelText }] },
        ],
      },
      {
        children: [{ type: 'box', borderColor: BORDER, padding: 2, children: [{ content: value, style: valueText }] }],
      },
    ],
  };
}

/** "[x] Repair    [ ] Installation …" — the performed type checked, the rest empty ([ ] is glyph-safe; U+2610 isn't in Sarabun) */
function checkboxLine(selected: string): string {
  const marks = SERVICE_TYPES.map((t) => `${t === selected ? '[x]' : '[ ]'} ${t}`).join('    ');
  return `${marks}    [ ] Other: __________`;
}

/** a bordered area carrying wrapped body text */
function textArea(text: string): Node {
  return { type: 'box', borderColor: BORDER, padding: 2.5, children: [{ content: text, style: valueText }] };
}

/** a bordered area with a numbered list of steps */
function listArea(items: readonly string[]): Node {
  const children: Node[] = [];
  items.forEach((item, i) => {
    children.push({ content: `${i + 1}. ${item}`, style: valueText });
    if (i < items.length - 1) children.push({ type: 'spacer', height: 1.5 });
  });
  return { type: 'box', borderColor: BORDER, padding: 2.5, children };
}

function partsTable(parts: readonly PartUsed[]): TableNode<PartUsed> {
  return {
    type: 'table',
    columns: [
      { type: 'data', key: 'name', header: 'Item' },
      { type: 'data', key: 'qty', header: 'Qty', align: 'center', width: 20 },
      { type: 'data', key: 'unitPrice', header: 'Unit Price', align: 'right', width: 30, numberFormat: {}, aggregate: 'sum' },
      {
        type: 'computed',
        header: 'Total',
        align: 'right',
        width: 30,
        compute: (row) => row.qty * row.unitPrice,
        numberFormat: {},
        aggregate: 'sum',
      },
    ],
    data: parts,
    summaryLabel: 'Total',
    style: { header: { fillColor: NAVY } },
  };
}

export function buildFieldServiceReport(report: FieldServiceReport): KapomReport {
  const { company, customer, job } = report;

  return createKapomReport<PartUsed>({
    font: fontConfig,
    blocks: [
      { content: 'FIELD SERVICE REPORT', align: 'center', style: { fontSize: 20, fontStyle: 'bold', color: NAVY } },
      { content: 'Service Documentation Form', align: 'center', style: { fontSize: 10, color: MUTED } },
      { type: 'spacer', height: 6 },

      {
        type: 'row',
        columns: [
          {
            children: [
              detailUnit('COMPANY DETAILS', [
                ['Company:', company.name],
                ['Technician:', company.technician],
                ['Phone:', company.phone],
                ['License #:', company.license],
              ]),
            ],
          },
          {
            children: [
              detailUnit('CUSTOMER DETAILS', [
                ['Name:', customer.name],
                ['Address:', customer.address],
                ['Phone:', customer.phone],
                ['Email:', customer.email],
              ]),
            ],
          },
        ],
      },
      { type: 'spacer', height: 6 },

      sectionBar('JOB DETAILS'),
      fieldRow('Work Order #', job.workOrder),
      fieldRow('Service Date', job.serviceDate),
      fieldRow('Time In / Out', job.timeInOut),
      fieldRow('Service Address', job.serviceAddress),
      { type: 'spacer', height: 6 },

      sectionBar('SERVICE TYPE'),
      { type: 'box', borderColor: BORDER, padding: 2, children: [{ content: checkboxLine(report.serviceType), style: valueText }] },
      { type: 'spacer', height: 6 },

      sectionBar('PROBLEM REPORTED BY CUSTOMER'),
      textArea(report.problemReported),
      { type: 'spacer', height: 6 },

      sectionBar('PROBLEM FOUND ON ARRIVAL'),
      textArea(report.problemFound),
      { type: 'spacer', height: 6 },

      sectionBar('WORK PERFORMED'),
      listArea(report.workPerformed),
      { type: 'spacer', height: 6 },

      sectionBar('PARTS & MATERIALS USED'),
      { type: 'spacer', height: 2 },
      partsTable(report.parts),
    ],
  });
}
