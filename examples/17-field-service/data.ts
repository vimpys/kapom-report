/**
 * File 1 of 3 — raw data.
 * A completed field-service call as plain records — company/technician, customer, job details,
 * the service type performed, the reported and found problems, the work steps, and the parts used.
 * The template fills the form fields from these values (blank areas become the actual text).
 */

export interface PartUsed {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface FieldServiceReport {
  company: { name: string; technician: string; phone: string; license: string };
  customer: { name: string; address: string; phone: string; email: string };
  job: { workOrder: string; serviceDate: string; timeInOut: string; serviceAddress: string };
  /** the one service type performed — matched against the checkbox list */
  serviceType: 'Installation' | 'Repair' | 'Maintenance' | 'Inspection' | 'Emergency';
  problemReported: string;
  problemFound: string;
  workPerformed: readonly string[];
  parts: readonly PartUsed[];
}

export const serviceReport: FieldServiceReport = {
  company: { name: 'Kapom Service Co.', technician: 'Somchai P.', phone: '02-555-0100', license: 'LIC-88231' },
  customer: {
    name: 'Gerrit Kruger',
    address: '123 Anywhere St., Any City',
    phone: '082 345 6789',
    email: 'gerrit@example.com',
  },
  job: {
    workOrder: 'WO-2026-0731',
    serviceDate: '2026-07-11',
    timeInOut: '09:15 — 11:40',
    serviceAddress: '123 Anywhere St., Any City',
  },
  serviceType: 'Repair',
  problemReported:
    'Air conditioner in the main office is not cooling; the unit runs but blows warm air and trips the breaker after roughly ten minutes of operation.',
  problemFound:
    'Condenser coil was heavily fouled and the run capacitor measured out of tolerance (18 µF against a 35 µF rating), causing the compressor to overdraw and trip the breaker.',
  workPerformed: [
    'Cleaned the condenser and evaporator coils and cleared the blocked drain line.',
    'Replaced the failed run capacitor with a new 35 µF OEM part.',
    'Recharged the refrigerant to the rated pressure and verified subcooling.',
    'Ran the unit for 30 minutes and confirmed stable cooling with no breaker trips.',
  ],
  parts: [
    { name: 'Run capacitor 35 µF', qty: 1, unitPrice: 480 },
    { name: 'Refrigerant R-32 (per kg)', qty: 2, unitPrice: 650 },
    { name: 'Coil cleaner (bottle)', qty: 1, unitPrice: 220 },
  ],
};
