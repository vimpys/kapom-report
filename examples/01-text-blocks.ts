/**
 * Demo — primitive blocks: Text / Spacer / Divider / Image
 * Focus: style override, automatic word-wrap, auto page-break, image auto-scale
 * + text shorthand: a plain string or an object without `type` is a text node (no need for `type: 'text'`)
 * Uses createKapomReport({ blocks }) — no need to touch jsPDF/RenderEngine directly
 */
import { createKapomReport } from '../src/index';
import type { ReportNodeInput } from '../src/index';
import { fontConfig, saveReport } from './shared';

/** 160x160 cartoon smiley PNG — stands in for a real logo to demo addImage() + auto-scale to contentWidth */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAIAAAAErfB6AAADhklEQVR42u3dy5WDQAxEUYXj/POYmPBqdv5gaEml6leHAKCvxbFxS8RBrBMsAcAEYAIwAZgATAAmAANMACYAE4AJwARgAvB/Ho8HwLP97gdgN1Fj78DVWzpw9ZYOP9fjL+4cZtJhQHtT9L43wCm0qa4XpAFeQ1vs+qs0wBdp211/kgb4B11B2jPMAI+nHcEcmrqDaL8y7wtsULj6pRwUrncpB7rexqGga0b7mdkceCtdBeNA19s4unQ3of3AbAWMbpdxoOttHOh6Gwe63saBrrdxoOttHAW6ADf+Pg7K17uIA11v40DX2xhggNGdbBzoehsDDDC6k43XA4O00FgCmPJVLuKgfL2LOChf7yIOyte7iGNK+ap9gIonC/QDVzfgqjUEqxaxKHDNvBXx82kGzru2ypk6yuez5C4dauV7ZWqVjG7qagAM8DrgpEu6PnpORjd1QXqAnRZU8HwABng1sMj35w2BLxiHQfkmGeucjwkwFQwwwAADfBO47EoAXvI9K3TKlydZGUUMMMDlWzj4N8kcmP+D/YHZ0bEF8M57srYDZpMlwAADDDDAWwPTqDKumYUKpoIBBpgDYA6AOQAGGGCAAQYYYIAB3gAYY/2hO1r7ojnMN75z7NXZMPguCjDAM4CzO0gn6o7vD6aIp5QvwABzl558f1ackzXLWH+aIcAAa3SCb67bAFw/y0Fc123abPYzy3HAUk8o1wNvZVw/pasHuL6IFYzrx7DdAVJ/64qaccuQvU7grrEsxrqH1HuTavZ4yM7oUNu/kQLcO3rHTPcQfHdh2UYtqUl3gtuvEoEtjQ10j4kviM4eViUyDEsO+Ch/091aCbWZiatQVgILGi/MRN3ZwGXM4lvbS4G7Wh/m0qbqpgD3trcMci3QLQJuebIo7vr2X6kRwMo9amonk6qbCEwfooJuLjDG7brpwBj36lYAY9yoWwSMcZduHTDGLbqlwCK/j1V2YValFHhP40bdBuDdjHt1e4BfGvsxv77G8vQA2xuL6HYCvzOezvz2oprSCexXylK0KsAepaxWuFrAo5llaeWAPxhP6fBX05UD/sos2z4qSKsLfIa5Xvr7+UhGF/gks8QOe+GoA59nLmtdmUI7CfiadOJW+DkZBtwrPXGhpgJXSo9en/HAGd5OC+IGfOYTsNX1bge8WwAGmABMACYAE4AJwARggAnABGACMAGY3MoTEXc+yRCgCHMAAAAASUVORK5CYII=';

const paragraph =
  'Sample text for testing the PdfCursor engine\'s automatic word wrap. When a line does not fit the available width, the engine computes the real line count via jsPDF\'s splitTextToSize and advances the cursor by the measured height. ';

const blocks: ReportNodeInput[] = [
  // text shorthand: an object without `type` is a text node
  { content: 'Text / Spacer / Divider / Image', style: { fontSize: 18, fontStyle: 'bold' } },
  { type: 'spacer', height: 4 },
  {
    content: 'Gray text at fontSize 10 — style override on top of DEFAULT_TEXT_STYLE',
    style: { fontSize: 10, color: [100, 100, 100] },
  },
  { type: 'spacer', height: 6 },
  { type: 'divider' },
  { type: 'spacer', height: 6 },
  {
    type: 'image',
    data: TINY_PNG_BASE64,
    format: 'PNG',
    width: 400, // intentionally exceeds contentWidth (~180mm) → auto-scales down, keeping aspect ratio
    height: 400, // matches the source PNG's 160x160 (1:1) aspect ratio so the scaled-down box isn't stretched
  },
  { type: 'spacer', height: 6 },
  paragraph.repeat(3), // text shorthand: a plain string is a text node
  { type: 'spacer', height: 10 },
  { type: 'divider', thickness: 1, color: [200, 0, 0] },
  { type: 'spacer', height: 4 },
  {
    content: 'Testing auto page-break: the repeated lines below will overflow onto the next page automatically',
    style: { fontStyle: 'bold' },
  },
  ...Array.from(
    { length: 60 },
    (_, i) => `Test line ${i + 1} — RenderEngine starts a new page on its own when space runs out`,
  ),
];

saveReport(createKapomReport({ blocks, font: fontConfig }), '01-text-blocks');
