/**
 * File 2 of 3 — the report template.
 * Demo — Style resolver: zebra striping + conditional formatting + column-level style
 * Focus: precedence conditional > zebra > column-level > row-type (Typography)
 * + column width, per-column align, and formatters — `numberFormat` for amounts and a
 * `formatter` calling formatDate() for the date column.
 */
import { formatDate, reportBuilder } from '../../src/index';
import type { KapomReport, TableNode } from '../../src/index';
import { fontConfig } from '../shared';
import type { LedgerEntry } from './data';

export function buildStyledLedger(entries: LedgerEntry[]): KapomReport {
  const ledgerTable: TableNode<LedgerEntry> = {
    type: 'table',
    columns: [
      {
        key: 'date',
        header: 'Date',
        width: 30,
        // formatter: turn the raw cell value into display text — here via the formatDate() helper
        // (explicit locale/dateStyle so the effect is visible: '2026-07-01' → '1 Jul 2026';
        // the default en-CA short style would render YYYY-MM-DD, identical to the raw ISO input)
        formatter: (value) => formatDate(new Date(String(value)), { locale: 'en-GB', dateStyle: 'medium' }),
      },
      { key: 'description', header: 'Description' },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        width: 35,
        numberFormat: {}, // {} = DEFAULT_NUMBER_FORMAT (thousands separator + 2 decimals)
        aggregate: 'sum',
        // column-level cellStyle: ranks below zebra/conditional in precedence — also tests that it still
        // shows through when conditional doesn't match (see 'Opening balance', which stays this font and isn't red)
        cellStyle: { fontFamily: 'Sarabun' },
      },
    ],
    data: entries,
    summaryLabel: 'Net',
    style: {
      zebra: { even: [255, 255, 255], odd: [245, 247, 250] },
      conditional: (row) => (row.amount < 0 ? { textColor: [220, 38, 38] } : undefined),
    },
  };

  return reportBuilder<LedgerEntry>()
    .font(fontConfig)
    .title('Ledger — zebra + conditional (negative = red); precedence conditional > zebra')
    .content(ledgerTable)
    .build();
}
