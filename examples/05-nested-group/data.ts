/**
 * File 1 of 3 — raw data.
 * Restaurant-chain sales across three branch regions, two menu categories each — built from a
 * literal menu (name + price + per-region quantities) so every subtotal in the report can be
 * checked against real numbers by hand.
 */

export interface BranchSale {
  region: string;
  category: string;
  product: string;
  qty: number;
  price: string;
}

interface MenuItem {
  category: string;
  name: string;
  price: string;
  qtyByRegion: Record<string, number>;
}

const menu: MenuItem[] = [
  { category: 'Food', name: 'Pad Thai', price: '65.00', qtyByRegion: { North: 48, South: 35, East: 52 } },
  { category: 'Food', name: 'Green Curry Chicken', price: '75.00', qtyByRegion: { North: 30, South: 41, East: 27 } },
  { category: 'Food', name: 'Tom Yum Goong', price: '95.00', qtyByRegion: { North: 22, South: 38, East: 31 } },
  { category: 'Food', name: 'Spring Rolls', price: '45.00', qtyByRegion: { North: 55, South: 29, East: 44 } },
  { category: 'Food', name: 'Mango Sticky Rice', price: '55.00', qtyByRegion: { North: 26, South: 33, East: 39 } },
  { category: 'Drink', name: 'Thai Iced Tea', price: '35.00', qtyByRegion: { North: 72, South: 64, East: 81 } },
  { category: 'Drink', name: 'Fresh Coconut Water', price: '40.00', qtyByRegion: { North: 45, South: 58, East: 40 } },
  { category: 'Drink', name: 'Lemongrass Juice', price: '30.00', qtyByRegion: { North: 28, South: 36, East: 25 } },
  { category: 'Drink', name: 'Iced Americano', price: '50.00', qtyByRegion: { North: 61, South: 43, East: 57 } },
  { category: 'Drink', name: 'Fresh Orange Juice', price: '45.00', qtyByRegion: { North: 34, South: 39, East: 46 } },
];

const regions = ['North', 'South', 'East'];

export const branchSales: BranchSale[] = regions.flatMap((region) =>
  menu.map((item) => ({
    region,
    category: item.category,
    product: item.name,
    qty: item.qtyByRegion[region] ?? 0,
    price: item.price,
  })),
);
