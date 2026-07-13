/**
 * File 1 of 3 — raw data.
 * The same catalog sold in every region, at a fixed unit price — only sales volume differs by
 * region. The `qtyByRegion` lookup (instead of parallel arrays) keeps the row construction safe
 * under noUncheckedIndexedAccess.
 *
 * `price` stays a string on purpose — matching a DECIMAL column from a DB; the lib accepts
 * Decimalish (number | string) as-is.
 */

export interface RegionSale {
  region: string;
  product: string;
  qty: number;
  price: string;
}

interface CatalogItem {
  name: string;
  price: string;
  qtyByRegion: Record<string, number>;
}

const catalog: CatalogItem[] = [
  { name: 'Wireless Mouse', price: '19.99', qtyByRegion: { 'North America': 42, Europe: 31, 'Asia Pacific': 68 } },
  { name: 'Mechanical Keyboard', price: '59.99', qtyByRegion: { 'North America': 18, Europe: 24, 'Asia Pacific': 35 } },
  { name: 'USB-C Hub', price: '34.50', qtyByRegion: { 'North America': 27, Europe: 19, 'Asia Pacific': 44 } },
  { name: '27" Monitor', price: '219.00', qtyByRegion: { 'North America': 9, Europe: 12, 'Asia Pacific': 15 } },
  { name: 'Webcam HD', price: '45.00', qtyByRegion: { 'North America': 21, Europe: 16, 'Asia Pacific': 29 } },
  { name: 'Laptop Stand', price: '29.90', qtyByRegion: { 'North America': 33, Europe: 22, 'Asia Pacific': 40 } },
  { name: 'Desk Lamp', price: '24.50', qtyByRegion: { 'North America': 14, Europe: 10, 'Asia Pacific': 23 } },
  { name: 'Noise-Cancelling Headphones', price: '89.99', qtyByRegion: { 'North America': 11, Europe: 8, 'Asia Pacific': 17 } },
];

const regions = ['North America', 'Europe', 'Asia Pacific'];

export const regionSales: RegionSale[] = regions.flatMap((region) =>
  catalog.map((item) => ({
    region,
    product: item.name,
    qty: item.qtyByRegion[region] ?? 0,
    price: item.price,
  })),
);
