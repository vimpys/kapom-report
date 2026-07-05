# Kapom Report — Concept Summary

Wrapper library ครอบ **jsPDF + jspdf-autotable** แก้ปัญหา manual x/y positioning, รองรับ report แบบ multi-page (100+ หน้า) เน้น vector text

## Tech decision (confirmed)

- **jsPDF + AutoTable** ชนะ html2pdf/html2canvas สำหรับ use case นี้
  - Vector text ไม่ใช่ raster → ไฟล์เล็ก, คมชัดตอน print, text selectable
  - ไม่มี DOM-render/rasterize overhead → memory scaling ดีกว่ามากตอน 100+ หน้า
  - html2pdf เหมาะกับ "แปลง HTML ที่มีอยู่แล้วเป็น PDF เร็วๆ" ไม่ใช่ report engine ที่ต้อง precise layout

## Architecture — Block/Component pattern

มองแต่ละส่วนของ report เป็น **Block** (คล้าย Vue component mindset):

- Block = หน่วยที่ render ได้ 1 อย่าง ต้องตอบได้ 2 อย่าง: **สูงเท่าไหร่** (page-break) + **วาดยังไง**
- Core engine รู้จักแค่ contract นี้ ไม่ผูกกับ feature เฉพาะ (text/image/table เป็นแค่ built-in block type)
- เพิ่ม feature ใหม่ = เขียน block type ใหม่ที่ implement contract เดียวกัน ไม่ต้องแก้ core (Open/Closed)
- **Registry pattern** สำหรับ plugin: `.use(somePlugin)` ลงทะเบียน block type ใหม่
- ยืมแค่ "contract + composition" จาก Vue component ไม่ยืม reactivity (PDF = one-shot imperative)

## API style (decided)

- **Declarative tree = core (บังคับ)** — `ReportNode` tree เป็น single source of truth ทุกอย่าง render ผ่านมัน
  - เหมาะ data-driven (map array → node), conditional/loop ปกติ, nested/group/composite เป็นธรรมชาติ (node มี children), test ง่าย
- **Fluent chain = optional convenience layer** — thin wrapper ที่ output เป็น tree เดียวกัน แล้วส่งเข้า renderer ตัวเดียวกัน
  - เหมาะเขียนมือ flat report, tree-shake ออกได้ถ้าไม่ใช้
  - ต้องเป็น subset ของ tree เสมอ (ห้ามมี feature ที่ declarative ทำไม่ได้ → กัน logic รั่วออกจาก tree)
  - Nested ผ่าน fluent ยังอึดอัด (callback/begin-end, state ซ่อน) → positioning เป็นทางลัดสำหรับ flat เท่านั้น ปล่อยเคส nested ให้ declarative

## Escape hatch (decided)

เปิด **ระดับ 2 (raw block) เป็นหลัก** — user วาด jsPDF เองได้ในขอบเขตที่ lib ยังคุม cursor/page-break ให้:

- Raw block implement contract `measure + draw` เดียวกับ Block อื่น → ปลอดภัยสุด ไม่ทำ layout engine เสีย invariant
- ระดับ 1 (expose `doc` ตรงๆ แบบ `readonly`) เปิดเผื่อ advanced user แต่ document ว่า "แตะแล้วรับผลเอง" (เทียบ `getCurrentInstance()` ของ Vue)
- ระดับ 3 (post-process hook `onAfterRender`) ค่อยเพิ่มทีหลังถ้ามี use case จริง (metadata, encryption)

## Report anatomy

**Page-level (ซ้ำทุกหน้า)**: Page Header, Page Footer

**Report-level (ครั้งเดียว)**: Report Header (Title, Subtitle, Meta Info), Report Footer (Grand Total, Signature)

**Detail Section**: Column Header, Detail Row, Summary Row, No-Data fallback

**Cross-cutting**: Watermark, Conditional formatting (zebra striping), Page-break/Orphan control, Multi-column, Chart block, Signature block

## Group Header/Footer

Group = **composite block** ตัวหนึ่ง ไม่ใช่ feature พิเศษ:

```
Group block (composite)
 ├─ Group header block      (label ตาม groupBy key)
 ├─ Detail row block × N    (rows ในกลุ่มนั้น)
 └─ Group footer block      (subtotal ของกลุ่ม)

↻ repeats per group in data

Summary block (นอก loop, ทำงานครั้งเดียวหลังจบทุกกลุ่ม)
```

- `groupBy(row)` แบ่ง flat array เป็นกลุ่ม, `headerLabel`/`footerLabel`/`summary.compute` เป็น function ที่ inject ได้
- มองเป็น composite block เดียว → measure ความสูงรวมทั้งก้อนก่อน page-break ได้เป็นธรรมชาติ
- Nested group รองรับได้ (recursive composition)
- **ยังไม่ solve**: true keep-together (orphan header ตกท้ายหน้า)

## Composite Report (Master Report)

รวมหลาย report เป็นเอกสารเดียว — ต่อยอด Block pattern ไม่ต้องแยก lib:

- **Report Section** = report สมบูรณ์ในตัว (Arrival, Departure, Payment) — เป็น Block ระดับหนึ่ง
- **Composite Report** = ประกอบหลาย Section ตามลำดับที่เลือก (เช่น Night Audit Summary)
- ต้องออกแบบเพิ่ม: Report Registry (เลือก section ด้วยชื่อ), page-break policy ระหว่าง section, shared context (hotel name/date ที่ Page Header ครั้งเดียว), page numbering ต่อเนื่องทั้งเล่ม

## Page Setup

- Page Size, Orientation (Portrait/Landscape), Margins (top/bottom/left/right), Unit (mm/pt/in)
- Default Font/Font Size (document-level, block inherit ได้)
- Page Number Format (ใช้ SystemField token)
- Show Header/Footer on First Page (flag)
- Header/Footer Reserved Height (คำนวณ safe area)
- Watermark (global)

## SystemField (+ Anchor Position)

ค่าที่ engine inject อัตโนมัติ (ต่างจาก data field ของ user):

| Field | ใช้ทำอะไร |
|---|---|
| `pageNumber` | เลขหน้า นับต่อเนื่องทั้ง document |
| `totalPages` | จำนวนหน้าทั้งหมด (two-pass) |
| `date` / `time` / `dateTime` | วันที่/เวลาพิมพ์ |
| `reportTitle` | อ้างอิง title จาก Report Header |
| `sectionName` | ชื่อ section ปัจจุบัน (สำคัญกับ Composite Report) |
| `sectionPageNumber` | เลขหน้าเฉพาะภายใน section (ต่างจาก pageNumber) |
| `generatedBy` | ผู้สั่ง generate (ถ้ามี auth context) |
| `groupName` | ชื่อกลุ่มปัจจุบันจาก Group block (running header) |

- **Anchor Position** grid 3×2: `top/bottom` × `left/center/right`, format string ด้วย `{token}`
- **Resolution timing**: `date`/`time` resolve ทันที, `totalPages`/`sectionPageNumber` (section ท้ายๆ) ต้อง two-pass
- Format วันที่ตาม locale (ไทย พ.ศ. vs ค.ศ.) อยู่ใน formatter config ไม่ hardcode ใน resolver

## Image / Chart

- **Image = core feature** — ใช้ `addImage()` ตรงๆ, เป็น layout primitive เดียวกับ text/spacer
- **Chart = image block ที่รับสำเร็จรูปจาก caller** (MVP) — caller render เอง (Chart.js/D3) ส่ง PNG/base64 เข้ามา, ไม่มี chart dependency ใน core, engine แยกทำเป็น plugin ทีหลังได้

## Font handling (decided)

- **รับ font config เข้ามา ไม่ bundle font ใน lib** — ปลอดภัยกว่าทุกมิติ: license (user รับผิดชอบ font ตัวเอง), bundle size (zero cost ถ้าไม่ใช้ Thai), flexibility (เลือก font เองได้)
- `FontConfig`: `fonts: FontSource[]` + `defaultFamily` (required, ต้องมีใน fonts)
- `FontSource`: family + data (base64 หรือ Uint8Array) + weight/style
- **Validation fail-fast ตอน register** — font error ของ jsPDF เป็น silent failure (ตัวอักษรหาย/กลายเป็นสี่เหลี่ยม ไม่ throw) ต้อง validate เอง:
  - fonts ไม่ว่าง, defaultFamily มีใน fonts, base64 valid
  - weight/style ที่ถูกอ้างใน report ต้องมี source ครบ (jsPDF แยก font ด้วย family+fontStyle)
- **VFS timing**: `addFileToVFS()` + `addFont()` ต้องเรียกก่อน block แรก render (ผูกใน document init phase)
- Thai font ที่ embed ต้อง support Thai shaping (สระ/วรรณยุกต์ combining marks) — เทสต์กับ font จริงที่เลือก

## Text normalization (decided) — บังคับใช้ทุก text

jsPDF คำนวณ width แบบ glyph-by-glyph → control/whitespace chars ทำ layout พัง ต้องผ่าน normalizer ก่อนถึง jsPDF เสมอ (facade pattern + ESLint enforcement กันเรียก `.text()` ตรงข้าม normalizer)

อักษรที่ต้อง handle:
- **Tab (`\t`)** → normalize เป็น spaces คงที่ (jsPDF ไม่รู้จัก tab stop)
- **Line endings** `\r\n`/`\r` → `\n` (ก่อน splitTextToSize)
- **NBSP** `\u00A0`/`\u202F` → space ปกติ (default; ปิดได้ถ้าตั้งใจใช้กันตัวเลขตัด)
- **Zero-width** `\u200B`–`\u200D`, `\u2060` → strip (มองไม่เห็นแต่กิน width)
- **Control chars** `\u0000`–`\u001F` (ยกเว้น `\n`), BOM `\uFEFF` → strip
- **Bidi marks** `\u200E`/`\u200F`, `\u202A`–`\u202E` → strip (ถ้าไม่รองรับ RTL)
- **Thai combining marks** — ไม่ strip แต่ต้องพึ่ง font shaping ที่ถูกต้อง (เชื่อมกับ font config)

## Nested table (Master-Detail) — 2 ระดับ (decided)

- AutoTable ไม่ native support → orchestrate เอง (loop `autoTable()`, เชื่อม Y ผ่าน `lastAutoTable.finalY`)
- custom-handle: height calc รวม nested, keep-together, repeat nested header ข้ามหน้า
- **MVP: บังคับ 2 ระดับ** (`maxNestingDepth: 2`) — type ออกแบบ recursive รองรับ N (ไม่ต้อง refactor ถ้าจะขยาย) แต่ runtime throw/warn เมื่อเกิน
- เหตุผล: report จริงเกือบทั้งหมดจบที่ 2 ระดับ; ระดับ 3+ ทำ height calc แพงขึ้น, horizontal space บีบจนอ่านไม่ออก, keep-together combinatorial

## Distribution

- Build ทั้ง **ESM + CJS + `.d.ts`** จาก source เดียว (tsup/unbuild generate ให้ครบ)
- `package.json`: `main` (CJS), `module` (ESM), `types` (.d.ts), `exports` (map ทั้ง import/require)
- JS project ใช้ได้ปกติ + ได้ autocomplete จาก `.d.ts` แม้ไม่เขียน TS (VS Code อ่าน .d.ts)

## Page-break: keep-together + recursive measure (decided)

กลไกกลาง: **pre-measure recursive ก่อน commit วาด** (declarative tree รองรับอยู่แล้ว — ทุก node ตอบ `measureHeight()` ได้)

**True keep-together (orphan header) — เข้า MVP**
- ปัญหา: group header วางท้ายหน้าพอดี → detail row แถวแรกขึ้นหน้าใหม่ = header ลอยเดียวดาย (orphan)
- แก้: measure `header + N rows` เป็นก้อนเดียว ถ้าที่เหลือไม่พอทั้งก้อน → break ก่อนวาด header
- `KeepTogetherPolicy.minRowsWithHeader` (default 1) — header ต้องอยู่กับอย่างน้อย N row แรก
- เหตุผลเข้า MVP: orphan เจอบ่อยจริงใน 100+ หน้า + mechanism (measure + break decision) เป็นแกนที่ทั้ง lib ใช้อยู่แล้ว

**Nested table + Group integration — defer แต่ measure recursive แต่แรก**
- ปัญหา: report เดียวมีทั้ง group + nested → page-break ซ้อน 2 ชั้น ("master row + nested" เป็นก้อน keep-together ซ้อนภายใน group keep-together)
- แก้: `measureHeight` เป็น recursive (group = header + Σ(row + nested) + footer)
- defer ตัว integration (จับคู่ตอนเปิด nested table จริง) แต่ **ออกแบบ `measureHeight` ให้ recursive ตั้งแต่ตอนนี้** → ไม่ต้อง refactor ทีหลัง

## Column system (decided)

Column เป็น discriminated union — TS แยก field ที่จำเป็นต่อแต่ละชนิด, ไม่มี `any`:

```
ReportColumn<T> =
  | DataColumn<T>         // ข้อมูลจาก key + optional aggregate/visible/renderer
  | RowNumberColumn       // เลขลำดับ (derived, engine generate)
  | ComputedColumn<T>     // คำนวณจาก row เช่น qty×price (derived)
  | RunningTotalColumn<T> // ยอดสะสม (derived, stateful ต่อ render order)
```

**Alignment แยก header/data**: `align` (data cell) + `headerAlign` (header) — `headerAlign` fallback → `align` เมื่อไม่ระบุ, `align` default 'left'. AutoTable `columnStyles.halign` มีผลแค่ body → header ต่าง column ต้อง set ผ่าน `didParseCell` (section === 'head')

**RowNumber**: `mode: 'continuous' | 'per-group' | 'per-page'` (per-page ต้อง two-pass), `startAt`, `formatter`. ข้อดี: data ไม่ต้องมี field `no` → ลด payload + เลขต่อเนื่องจาก render order จริง (ไม่เพี้ยนเวลา filter/sort)

**Column-level aggregate**: `aggregate?: 'sum'|'avg'|'count'|'min'|'max'|fn` — declare ที่ column ครั้งเดียว engine รวมให้ทุกระดับ (group footer + grand total) ไม่ต้องเขียน reduce เอง

**MVP**: rowNumber + computed + aggregate; runningTotal/cellRenderer/visible เป็น advanced เพิ่มทีหลัง

## Auto-compute + precision (decided)

- **Engine auto-compute total — ไม่ให้ user ส่งเอง** (auto subtotal คือ core value; ให้ user ส่ง = แค่ย้าย float bug ไปที่อื่น + เสี่ยง total ไม่ตรง detail)
- **`NumericStrategy` boundary** — arithmetic ทุกจุด (aggregate/computed/runningTotal) ผ่าน interface เดียว ห้ามเขียน `a + b` ตรงๆ; MVP ใช้ `nativeNumeric`, migrate decimal.js ทีหลัง zero-refactor
- **รับ `Decimalish = number | string`** — user ส่งเลขเป็น string จาก DB `DECIMAL` column (mysql2/pg คืน string อยู่แล้ว) ได้ตรงๆ ไม่แปลง number
- **decimal.js — ยัง defer** แต่ boundary รองรับแล้ว
- **Display rounding แยกจาก calculation** — `NumberFormat` (locale/min/maxFractionDigits) ผ่าน `Intl.NumberFormat`, ตั้งได้ 3 ระดับ (report → column), default 'th-TH' 2 ตำแหน่ง — ตัด float artifact (`7.7000...1`) บนหน้า report ได้แม้ยังไม่มี decimal.js

## Styling system (decided)

Style แยกจาก content (theme object + resolver) — declarative, test ได้โดยไม่แตะ jsPDF:

- **Static color** (title/header bg/border), **Zebra striping** (สลับ row คู่/คี่), **Conditional formatting** (สีตามเงื่อนไข data เช่น ยอดติดลบ = แดง)
- แปลง theme + resolver → `didParseCell` hook อัตโนมัติ user ไม่แตะ AutoTable API
- **Precedence** (สูง→ต่ำ): Conditional → Zebra → Row-type base → Table default

## Typography (decided)

Font sizing เป็น theme-level token ไม่ set ทีละจุด — เปลี่ยนทั้ง report ที่เดียว:

- `Typography` มี token ต่อ row-type: reportTitle, reportSubtitle, sectionHeading, columnHeader, detailRow, groupHeader, groupFooter, summary, pageHeaderFooter
- แต่ละ token: fontSize + fontStyle + color + fontFamily (type ชื่อ `TextStyle` — align กับ `CellStyle` เป็น family เดียวกัน; "token" ใช้ที่ระดับ Typography)
- `DEFAULT_TYPOGRAPHY` เป็น constant, override ด้วย `DeepPartial<Typography>`
- **Precedence**: column-level (headerStyle/cellStyle) → typography token → DEFAULT_TYPOGRAPHY
- ระวัง: `fontStyle: 'bold'` ต้องมี font variant embed จริง ไม่งั้น jsPDF fallback เงียบ → cross-check กับ registered font variants ตอน resolve config

## Default font (decided — option B)

- `FontConfig.defaultFamily` เป็น **optional** → auto-fallback ไป `fonts[0].family` ถ้าไม่ระบุ (zero-config)
- ระบุแล้ว → validate ว่ามีใน registered fonts (throw `KapomFontError` ถ้าไม่มี)
- `fonts` เป็น **non-empty tuple** `[FontSource, ...FontSource[]]` → บังคับมีอย่างน้อย 1 ตัวที่ระดับ type, `fonts[0]` type-safe ไม่ต้องเช็ค undefined
- กัน silent helvetica fallback ที่ทำไทยพัง (□□□)

## Progressive Disclosure — API design principle (decided)

"Simple by default, powerful when needed" — API 3 ชั้นจาก config เดียว:

- **ชั้น 1 zero-config**: ใส่แค่ `columns` + `data` — theme/margin/font/format ใช้ default หมด
- **ชั้น 2 partial override**: `group: { by: 'category' }` (string key), `theme: 'striped'` (preset name)
- **ชั้น 3 full control**: `group.by` เป็น function + labels + keepTogether, `theme` เป็น object เต็ม, `raw` escape hatch
- Type: union รับได้ทั้งง่าย/เต็ม (`GroupOption`, `ThemeOption`) discriminate ด้วย shape; `Partial`/`DeepPartial` สำหรับ override
- Defaults เป็น constant merge เข้ามาใน `resolveConfig()`
- ทั้ง 3 ชั้นแปลงเป็น `ReportNode` tree เดียวกัน — ต่างแค่ระดับรายละเอียดที่ user เขียน

## TypeScript policy (decided)

- โค้ดเราเอง (node/column/style) — generic + discriminated union, **ไม่มี any/unknown**
- Generic ที่ยังไม่ผูก type — `unknown` + narrow (เครื่องมือกัน any ไม่ใช่สิ่งที่เลี่ยง)
- รับค่าจาก AutoTable hook — `unknown` + type guard
- Type ที่ lib ไม่ export (`lastAutoTable`) — module augmentation ครั้งเดียวใน `.d.ts` ไม่มี any รั่ว

## ยังไม่ได้ตัดสินใจ

(ตัดสินใจครบแล้ว — เหลือรายละเอียด implementation ตอนลงมือเขียนจริง)
