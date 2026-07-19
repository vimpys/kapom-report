import { afterEach, describe, expect, it, vi } from 'vitest';
import { KapomError } from '../../src/core/errors';
import { createKapomReport } from '../../src/report/create-kapom-report';

// จำลอง browser: isNodeRuntime() = false → save/preview ต้องเดินเส้นทาง jsPDF native
// (Node I/O ทุกตัว mock ทิ้ง — เส้นทาง browser ห้ามเรียกถึงเลย)
vi.mock('../../src/report/node-io', () => ({
  isNodeRuntime: () => false,
  assertNodeIoSupported: vi.fn(), // browser = no-op (real one only throws on old Node)
  writeFile: vi.fn(),
  writeTempPdf: vi.fn(),
  openWithDefaultViewer: vi.fn(),
}));

const config = {
  columns: [{ key: 'product' as const, header: 'Product' }],
  data: [{ product: 'A' }, { product: 'B' }],
};

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as { open?: unknown }).open;
});

describe('createKapomReport — เส้นทาง browser (isNodeRuntime = false)', () => {
  it('save() → เรียก jsPDF native doc.save (trigger download) ไม่แตะ Node I/O', async () => {
    const report = createKapomReport(config);
    // jsPDF ผูก method ที่ instance (ไม่ใช่ prototype) — spy ที่ report.doc หลังสร้าง
    const nativeSave = vi.spyOn(report.doc, 'save').mockReturnValue(report.doc);
    const { writeFile } = await import('../../src/report/node-io');

    report.save('report.pdf');

    expect(nativeSave).toHaveBeenCalledWith('report.pdf');
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });

  it('preview() → ได้ blob URL + เปิด tab ใหม่ผ่าน window.open', () => {
    const report = createKapomReport(config);
    vi.spyOn(report.doc, 'output').mockReturnValue('blob:fake-url' as never);
    const open = vi.fn();
    (globalThis as { open?: unknown }).open = open;

    const url = report.preview();

    expect(url).toBe('blob:fake-url');
    expect(open).toHaveBeenCalledWith('blob:fake-url');
  });

  it('preview() ใน environment ที่ไม่มีทั้ง Node และ window.open → throw KapomError', () => {
    const report = createKapomReport(config);
    vi.spyOn(report.doc, 'output').mockReturnValue('blob:fake-url' as never);

    expect(() => report.preview()).toThrow(KapomError);
  });
});
