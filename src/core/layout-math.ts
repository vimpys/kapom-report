/**
 * Plain arithmetic over layout geometry (mm) — deliberately NOT routed through NumericStrategy,
 * which governs *data* arithmetic (aggregates/computed columns, where a Decimalish string from a
 * DB column and decimal precision matter). Widths/heights are internal float geometry: summing
 * them directly is correct and cheap.
 */

/** sum of a number list */
export const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);
