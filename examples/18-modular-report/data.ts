/**
 * File 1 of 3 — raw data.
 * Already in the final row shape the report consumes — no mapping/flatMap step needed, just an
 * array of records you could equally have fetched from a database or an API.
 */

export interface Sale {
  product: string;
  customer: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

export const sales: Sale[] = [
  { product: 'Alice Mutton', customer: 'ANTON', q1: 0, q2: 702, q3: 0, q4: 0 },
  { product: 'Alice Mutton', customer: 'BERGS', q1: 312, q2: 0, q3: 0, q4: 0 },
  { product: 'Alice Mutton', customer: 'BOLID', q1: 0, q2: 0, q3: 0, q4: 1170 },
  { product: 'Alice Mutton', customer: 'BOTTM', q1: 1170, q2: 0, q3: 0, q4: 0 },
  { product: 'Alice Mutton', customer: 'ERNSH', q1: 1123.2, q2: 0, q3: 2607.15, q4: 0 },
  { product: 'Alice Mutton', customer: 'GODOS', q1: 0, q2: 280.8, q3: 0, q4: 0 },
  { product: 'Alice Mutton', customer: 'HUNGC', q1: 62.4, q2: 0, q3: 0, q4: 0 },
  { product: 'Alice Mutton', customer: 'PICCO', q1: 0, q2: 1560, q3: 936, q4: 0 },
  { product: 'Alice Mutton', customer: 'RATTC', q1: 0, q2: 592.8, q3: 0, q4: 0 },

  { product: 'Aniseed Syrup', customer: 'ALFKI', q1: 0, q2: 60, q3: 0, q4: 0 },
  { product: 'Aniseed Syrup', customer: 'BOTTM', q1: 0, q2: 200, q3: 0, q4: 0 },
  { product: 'Aniseed Syrup', customer: 'ERNSH', q1: 0, q2: 0, q3: 180, q4: 0 },
  { product: 'Aniseed Syrup', customer: 'LINOD', q1: 544, q2: 0, q3: 0, q4: 0 },
  { product: 'Aniseed Syrup', customer: 'QUICK', q1: 0, q2: 600, q3: 0, q4: 0 },
  { product: 'Aniseed Syrup', customer: 'VAFFE', q1: 0, q2: 0, q3: 140, q4: 0 },

  { product: 'Boston Crab Meat', customer: 'ANTON', q1: 0, q2: 165.6, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'BERGS', q1: 920, q2: 0, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'BONAP', q1: 248.4, q2: 524.4, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'BOTTM', q1: 551.25, q2: 0, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'BSBEV', q1: 147, q2: 0, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'FRANS', q1: 0, q2: 0, q3: 18.4, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'HILAA', q1: 0, q2: 1104, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'LAZYK', q1: 147, q2: 0, q3: 0, q4: 0 },
  { product: 'Boston Crab Meat', customer: 'LEHMS', q1: 0, q2: 515.2, q3: 0, q4: 0 },

  { product: 'Camembert Pierrot', customer: 'ANTON', q1: 0, q2: 0, q3: 340, q4: 0 },
  { product: 'Camembert Pierrot', customer: 'BERGS', q1: 1088, q2: 0, q3: 0, q4: 0 },
  { product: 'Camembert Pierrot', customer: 'FOLKO', q1: 0, q2: 850, q3: 0, q4: 0 },
  { product: 'Camembert Pierrot', customer: 'LILAS', q1: 0, q2: 0, q3: 0, q4: 1275 },
  { product: 'Camembert Pierrot', customer: 'MEREP', q1: 476, q2: 0, q3: 0, q4: 0 },
  { product: 'Camembert Pierrot', customer: 'SAVEA', q1: 0, q2: 2380, q3: 0, q4: 0 },

  { product: 'Chai', customer: 'ALFKI', q1: 0, q2: 0, q3: 288, q4: 0 },
  { product: 'Chai', customer: 'BOTTM', q1: 612, q2: 0, q3: 0, q4: 0 },
  { product: 'Chai', customer: 'ERNSH', q1: 0, q2: 0, q3: 0, q4: 900 },
  { product: 'Chai', customer: 'LEHMS', q1: 0, q2: 342, q3: 0, q4: 0 },
  { product: 'Chai', customer: 'QUICK', q1: 720, q2: 0, q3: 0, q4: 0 },
  { product: 'Chai', customer: 'VINET', q1: 0, q2: 0, q3: 108, q4: 0 },

  { product: 'Chang', customer: 'BERGS', q1: 0, q2: 380, q3: 0, q4: 0 },
  { product: 'Chang', customer: 'BLONP', q1: 340, q2: 0, q3: 0, q4: 0 },
  { product: 'Chang', customer: 'ERNSH', q1: 0, q2: 0, q3: 1520, q4: 0 },
  { product: 'Chang', customer: 'FRANK', q1: 0, q2: 855, q3: 0, q4: 0 },
  { product: 'Chang', customer: 'QUICK', q1: 0, q2: 0, q3: 0, q4: 646 },
  { product: 'Chang', customer: 'WARTH', q1: 190, q2: 0, q3: 0, q4: 0 },

  { product: 'Gorgonzola Telino', customer: 'ANTON', q1: 0, q2: 250, q3: 0, q4: 0 },
  { product: 'Gorgonzola Telino', customer: 'BONAP', q1: 500, q2: 0, q3: 0, q4: 0 },
  { product: 'Gorgonzola Telino', customer: 'LAMAI', q1: 0, q2: 0, q3: 750, q4: 0 },
  { product: 'Gorgonzola Telino', customer: 'ROMEY', q1: 0, q2: 300, q3: 0, q4: 0 },
  { product: 'Gorgonzola Telino', customer: 'SAVEA', q1: 1000, q2: 0, q3: 0, q4: 0 },
  { product: 'Gorgonzola Telino', customer: 'WHITC', q1: 0, q2: 0, q3: 0, q4: 450 },
];
