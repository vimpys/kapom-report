/**
 * File 3 of 3 — the runner.
 * Wires the raw ledger entries (data.ts) into the styled template (report-template.ts) and saves.
 *
 * Run with: `tsx examples/03-styled-table/index.ts`
 */
import { saveReport } from '../shared';
import { ledgerEntries } from './data';
import { buildStyledLedger } from './report-template';

const report = buildStyledLedger(ledgerEntries);

saveReport(report, '03-styled-table');
