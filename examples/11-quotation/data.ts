/**
 * File 1 of 3 — raw data.
 * The quotation as plain records (header fields, customer, line items, tax rate, terms) — ready
 * to feed straight into the template. Derived values (subtotal / VAT / total) are computed by the
 * template from `items` + `vatRate`, not stored here.
 */

export interface QuotationItem {
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Quotation {
  number: string;
  date: string;
  validUntil: string;
  customerId: string;
  customer: { name: string; lines: readonly string[] };
  projectDescription: string;
  items: readonly QuotationItem[];
  /** 0–1, e.g. 0.07 = 7% */
  vatRate: number;
  terms: string;
}

export const quotation: Quotation = {
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
  ],
  vatRate: 0.07,
  terms:
    'Above information is not an invoice and only an estimate of the services described. Payment will be due prior to provision of the services listed above.',
};
