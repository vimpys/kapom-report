/**
 * File 1 of 3 — raw data.
 * A small catalog sold in two regions — enough rows for a group band, a subtotal per group, a
 * grand total, and a few zebra stripes, so a theme has every table surface to colour. The
 * `qtyByRegion` lookup (instead of parallel arrays) keeps row construction safe under
 * noUncheckedIndexedAccess.
 */

export interface CatalogSale {
  region: string;
  product: string;
  qty: number;
  price: string; // string on purpose — matches a DECIMAL column from a DB (Decimalish)
}

interface CatalogItem {
  name: string;
  price: string;
  qtyByRegion: Record<string, number>;
}

const catalog: CatalogItem[] = [
  { name: 'Wireless Mouse', price: '19.99', qtyByRegion: { 'North America': 42, Europe: 31 } },
  { name: 'Mechanical Keyboard', price: '59.99', qtyByRegion: { 'North America': 18, Europe: 24 } },
  { name: 'USB-C Hub', price: '34.50', qtyByRegion: { 'North America': 27, Europe: 19 } },
  { name: '27" Monitor', price: '219.00', qtyByRegion: { 'North America': 9, Europe: 12 } },
  { name: 'Webcam HD', price: '45.00', qtyByRegion: { 'North America': 21, Europe: 16 } },
  { name: 'Laptop Stand', price: '29.90', qtyByRegion: { 'North America': 33, Europe: 22 } },
];

const regions = ['North America', 'Europe'];

export const catalogSales: CatalogSale[] = regions.flatMap((region) =>
  catalog.map((item) => ({
    region,
    product: item.name,
    qty: item.qtyByRegion[region] ?? 0,
    price: item.price,
  })),
);
