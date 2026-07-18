# Demo 0 — Report anatomy

Get to know a report before you build one. Every region maps to **one `reportBuilder()` call** — learn the map, and you'll always reach for the right method.

A report has **two layers stacked on top of each other**:

- **Page frame** — the header/footer/number that **repeat on every page**. Configured as separate parts of the builder.
- **Content** — the title, body, and summary that **flow once** through the pages. Configured as a sequence.

The frame wraps the content. That's the whole mental model.

## The page

```
┌─ Page header ─────────────────────────┐   report.pageHeader.addBlock(…)    frame · every page
├───────────────────────────────────────┤
│  Title                                │   .title('…')          content · once, first page ┐
│                                       │                                                   │
│  Content                              │   .content(…)          content · flows            │ one
│    …                                  │                                                   │ sequence
│                                       │                                                   │
│  Summary                              │   .summary(…)          content · once, bottom     ┘
├───────────────────────────────────────┤
└─ Page footer          ·   Page 1 of 2 ┘   .pageFooter.addBlock() · .pageNumber()   frame · every page
```

> **Where is the title?** Right under the page header — it's the *first block of content*, not the top of the page. The page header (frame) always sits above it.

## anatomy → method

| Region | Call it with | When it prints | Layer |
| --- | --- | --- | --- |
| Page header | `report.pageHeader.addBlock(…)` | Every page — reserves height at the top | frame |
| Title | `.title('…')` | Once, first page — under the header | content |
| Content | `.content(table, spacer(4), text, …)` | Flows and paginates | content |
| Summary | `.summary(signature, …)` | Once, last page — pinned to the bottom | content |
| Page footer | `report.pageFooter.addBlock(…)` | Every page — reserves height at the bottom | frame |
| Page number | `.pageNumber('bottom-right')` | Every page — drawn in the margin (no reserved space) | frame |
| Settings | `.font()` · `.pageSetup()` · `.margins()` | Set once, up front | setup |

## Once vs. every page

```
        page 1                    page 2
   ┌─ header ──────┐         ┌─ header ──────┐   ← frame: reprints
   │ Title         │         │ (no title)    │   ← content: once, first page only
   │ Content …     │         │ Content …     │   ← content: keeps flowing
   │ Summary       │         │ (no summary)  │   ← content: once, last page only
   └─ footer · 1/2 ┘         └─ footer · 2/2 ┘   ← frame: reprints (number updates)
```

The **frame** reprints on every page. **Title** and **summary** print once. Only **content** keeps flowing.

## Putting it together

```ts
import { reportBuilder, spacer } from 'kapom-report';

const report = reportBuilder<Sale>()
  // ── settings (once, up front) ──
  .font(fontConfig)
  .pageSetup({ orientation: 'portrait', margins: { top: 15, bottom: 15, left: 15, right: 15 } })
  // ── content (one flowing sequence) ──
  .title('Sales Report')
  .content(salesTable, spacer(6), notesBlock)
  .summary({ type: 'signature', slots: [{ label: 'Approved by' }] });

// ── page frame (repeats every page — configured separately) ──
report.pageHeader.addBlock(brandHeader);
report.pageFooter.addBlock(footerNote);
report.pageNumber('bottom-right');

report.build().save('report.pdf');
```

Notice the two layers in the code, mirroring the diagram: the **content flow** is chained (`.title` → `.content` → `.summary`), while the **frame** is set on `report.pageHeader` / `report.pageFooter` / `.pageNumber` — separate, because it isn't part of the flow.

## Next

- **[01 · basic report](../01-basic-report/)** — the smallest table, then zebra styling, then aggregates
- **[02 · text & layout](../02-text-and-layout/)** — text, spacer, divider, image
- Tables in depth: **[05 grouped](../05-group-report/)** · **[06 nested groups](../06-nested-group/)** · **[07 master-detail](../07-master-detail/)** · **[08 multi-level headers](../08-multi-header/)**
