/** base error for the whole lib — instanceof KapomError catches every error we throw ourselves */
export class KapomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** a layout invariant broke — margin/page size not valid, negative advance, etc. */
export class KapomLayoutError extends KapomError {}

/**
 * font config is invalid — jsPDF fails silently (glyphs disappear or turn into boxes, no throw)
 * so we validate ourselves, fail-fast at registration time, to catch problems before they show
 * up when the PDF is opened
 */
export class KapomFontError extends KapomError {}
