/**
 * File 1 of 3 — the data.
 * Purchase orders, each with its own line items. The report shows every order as a master row
 * with its items nested underneath, plus a report-level summary computed from these numbers.
 */

export interface LineItem {
  item: string;
  unitPrice: number;
  qty: number;
}

export interface Order {
  no: number;
  poNumber: string;
  vendor: string;
  items: readonly LineItem[];
}

export const orders: readonly Order[] = [
  {
    no: 1,
    poNumber: 'PO-1001',
    vendor: 'Acme Co.',
    items: [
      { item: 'Widget A', unitPrice: 200, qty: 20 },
      { item: 'Widget B', unitPrice: 250, qty: 20 },
    ],
  },
  {
    no: 2,
    poNumber: 'PO-1002',
    vendor: 'Globex Inc.',
    items: [
      { item: 'Gadget X', unitPrice: 150, qty: 10 },
      { item: 'Gadget Y', unitPrice: 300, qty: 15 },
    ],
  },
  {
    no: 3,
    poNumber: 'PO-1003',
    vendor: 'Initech Ltd.',
    items: [
      { item: 'Part M', unitPrice: 400, qty: 20 },
      { item: 'Part N', unitPrice: 500, qty: 8 },
    ],
  },
];

/** an order's total quantity (sum of its line-item quantities) */
export const orderQty = (order: Order): number => order.items.reduce((sum, li) => sum + li.qty, 0);

/** an order's total amount (sum of unit price × quantity across its line items) */
export const orderAmount = (order: Order): number =>
  order.items.reduce((sum, li) => sum + li.unitPrice * li.qty, 0);
