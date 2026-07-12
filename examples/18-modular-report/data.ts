/**
 * File 1 of 3 — raw data.
 * Monthly sales already in the final row shape (no mapping) — the template groups the 12 months
 * into quarters via a 3-level column-group header (Quarterly → Qtr 1-4 → the months).
 */

export interface Sale {
  product: string;
  customer: string;
  jan: number; feb: number; mar: number;
  apr: number; may: number; jun: number;
  jul: number; aug: number; sep: number;
  oct: number; nov: number; dec: number;
}

export const sales: Sale[] = [
  { product: 'Alice Mutton', customer: 'ANTON', jan: 0, feb: 702, mar: 0, apr: 312, may: 0, jun: 0, jul: 0, aug: 0, sep: 936, oct: 0, nov: 1170, dec: 0 },
  { product: 'Alice Mutton', customer: 'BERGS', jan: 312, feb: 0, mar: 592, apr: 0, may: 280, jun: 0, jul: 62, aug: 0, sep: 0, oct: 1170, nov: 0, dec: 0 },
  { product: 'Alice Mutton', customer: 'ERNSH', jan: 1123, feb: 0, mar: 2607, apr: 0, may: 0, jun: 936, jul: 0, aug: 592, sep: 0, oct: 0, nov: 0, dec: 1560 },

  { product: 'Aniseed Syrup', customer: 'ALFKI', jan: 0, feb: 60, mar: 0, apr: 0, may: 200, jun: 0, jul: 0, aug: 0, sep: 180, oct: 0, nov: 0, dec: 140 },
  { product: 'Aniseed Syrup', customer: 'LINOD', jan: 544, feb: 0, mar: 0, apr: 600, may: 0, jun: 0, jul: 0, aug: 320, sep: 0, oct: 0, nov: 240, dec: 0 },
  { product: 'Aniseed Syrup', customer: 'QUICK', jan: 0, feb: 0, mar: 288, apr: 0, may: 0, jun: 612, jul: 0, aug: 0, sep: 342, oct: 0, nov: 0, dec: 720 },

  { product: 'Boston Crab Meat', customer: 'ANTON', jan: 0, feb: 165, mar: 0, apr: 920, may: 0, jun: 0, jul: 248, aug: 524, sep: 0, oct: 0, nov: 551, dec: 0 },
  { product: 'Boston Crab Meat', customer: 'BONAP', jan: 147, feb: 0, mar: 0, apr: 0, may: 1104, jun: 0, jul: 0, aug: 0, sep: 18, oct: 147, nov: 0, dec: 0 },
  { product: 'Boston Crab Meat', customer: 'HILAA', jan: 0, feb: 515, mar: 0, apr: 0, may: 0, jun: 340, jul: 1088, aug: 0, sep: 0, oct: 0, nov: 850, dec: 0 },

  { product: 'Camembert Pierrot', customer: 'FOLKO', jan: 476, feb: 0, mar: 0, apr: 0, may: 2380, jun: 0, jul: 0, aug: 288, sep: 0, oct: 1275, nov: 0, dec: 0 },
  { product: 'Camembert Pierrot', customer: 'LILAS', jan: 0, feb: 612, mar: 0, apr: 900, may: 0, jun: 0, jul: 0, aug: 0, sep: 342, oct: 0, nov: 720, dec: 0 },
  { product: 'Camembert Pierrot', customer: 'MEREP', jan: 0, feb: 0, mar: 108, apr: 0, may: 380, jun: 0, jul: 340, aug: 0, sep: 0, oct: 0, nov: 0, dec: 1520 },

  { product: 'Chang', customer: 'BLONP', jan: 855, feb: 0, mar: 0, apr: 0, may: 646, jun: 0, jul: 190, aug: 0, sep: 0, oct: 250, nov: 0, dec: 0 },
  { product: 'Chang', customer: 'FRANK', jan: 0, feb: 500, mar: 0, apr: 750, may: 0, jun: 0, jul: 0, aug: 300, sep: 0, oct: 0, nov: 1000, dec: 0 },
  { product: 'Chang', customer: 'WARTH', jan: 0, feb: 0, mar: 450, apr: 0, may: 0, jun: 380, jul: 0, aug: 0, sep: 340, oct: 0, nov: 0, dec: 646 },

  { product: 'Gorgonzola Telino', customer: 'ROMEY', jan: 250, feb: 0, mar: 0, apr: 500, may: 0, jun: 0, jul: 750, aug: 0, sep: 0, oct: 300, nov: 0, dec: 0 },
  { product: 'Gorgonzola Telino', customer: 'SAVEA', jan: 0, feb: 1000, mar: 0, apr: 0, may: 450, jun: 0, jul: 0, aug: 250, sep: 0, oct: 0, nov: 500, dec: 0 },
  { product: 'Gorgonzola Telino', customer: 'WHITC', jan: 0, feb: 0, mar: 750, apr: 0, may: 0, jun: 300, jul: 0, aug: 0, sep: 1000, oct: 0, nov: 0, dec: 450 },
];
