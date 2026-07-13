/**
 * Demo — raw block (the level-2 escape hatch)
 * Focus: when the lib has no block for what you need (here: a simple bar chart), drop down to a
 * { type: 'raw' } block and draw with jsPDF yourself. The engine still positions the block and
 * handles page-breaks; you only fill in measure() + draw(). Text still goes through the exported
 * drawText() facade (normalizer + Thai font guard), while shapes use doc.rect/setFillColor directly.
 */
import { createKapomReport, drawText } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, outPath } from './shared';

interface Bar {
  label: string;
  value: number;
}

const data: Bar[] = [
  { label: 'Room Booking', value: 152000 },
  { label: 'Restaurant', value: 48500 },
  { label: 'Spa', value: 21300 },
  { label: 'Events', value: 63400 },
];

const BAR_HEIGHT = 8;
const BAR_GAP = 4;
const LABEL_WIDTH = 45; // reserved on the left for the category label
const VALUE_WIDTH = 30; // reserved on the right for the value label
const maxValue = Math.max(...data.map((d) => d.value));

const barChart: ReportNodeInput = {
  type: 'raw',
  // the total height the engine reserves (and uses to decide a page-break before drawing)
  measure: () => data.length * (BAR_HEIGHT + BAR_GAP),
  draw: (doc, { x, y, contentWidth }) => {
    const trackWidth = contentWidth - LABEL_WIDTH - VALUE_WIDTH;
    data.forEach((d, i) => {
      const rowY = y + i * (BAR_HEIGHT + BAR_GAP);
      const baseline = rowY + BAR_HEIGHT - 2;
      drawText(doc, d.label, x, baseline);

      const barWidth = (d.value / maxValue) * trackWidth;
      doc.setFillColor(41, 128, 185);
      doc.rect(x + LABEL_WIDTH, rowY, barWidth, BAR_HEIGHT, 'F');

      drawText(doc, d.value.toLocaleString('en-US'), x + LABEL_WIDTH + barWidth + 2, baseline);
    });
  },
};

const report = createKapomReport({
  font: fontConfig,
  blocks: [
    { content: 'Raw block — a bar chart the lib has no block for', style: { fontSize: 14, fontStyle: 'bold' } },
    { type: 'spacer', height: 6 },
    barChart,
  ],
});

report.save(outPath('15-raw-escape-hatch'));
console.log(`OK 15-raw-escape-hatch.pdf (${report.doc.getNumberOfPages()} pages)`);
