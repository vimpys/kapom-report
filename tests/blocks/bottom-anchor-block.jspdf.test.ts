import { describe, expect, it } from 'vitest';
import { pageBreak, reportBuilder, spacer } from '../../src/index';

// B2 regression — needs REAL jsPDF metrics: the bug was a floating-point rounding at the exact
// bottom edge, which only shows up with jsPDF's real mm/pt conversions (a stub's clean arithmetic
// never hits it). The 0.1mm spacer nudges the pinned summary's height onto that edge.
describe('BottomAnchorBlock — B2 regression (real jsPDF)', () => {
  it('summary pinned on a fresh page stays there — no spurious extra page from a float-edge break', () => {
    const report = reportBuilder()
      .title('B2 regression')
      .content({ content: 'body' }, pageBreak())
      .summary(spacer(0.1), {
        type: 'signature',
        slots: [{ label: 'Prepared by' }, { label: 'Approved by' }],
      })
      .build();

    // page 1 = title + body; pageBreak → page 2; the summary must pin to the BOTTOM of page 2.
    // Before the fix, the per-child ensureSpace spuriously broke the signature to a 3rd page.
    expect(report.doc.getNumberOfPages()).toBe(2);
  });
});
