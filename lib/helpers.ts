/**
 * Small HTML helpers available to a site's AI-owned source code.
 *
 * These are the engine's "plumbing": escaping, money and opening-hours
 * formatting, and image tags. They let every site read facts from the record
 * consistently (and keep JSON-LD, GBP pricing and a11y in sync) without each
 * site re-implementing them.
 */
import type { Business, Image, OpeningHours } from "../schema/business.ts";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** Escape text for use in HTML element content. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape text for use inside a double-quoted attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/** Convert newlines in free text to <br> after escaping (bios keep emoji as-is). */
export function nl2br(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

/** Format a price in pence as a currency string, e.g. 2500 -> "£25.00". */
export function money(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(pence / 100);
}

export interface HoursRow {
  /** e.g. "Mon–Sat" or "Sun". */
  label: string;
  /** e.g. "09:00–20:00" or "Closed". */
  value: string;
}

/**
 * Group regular opening hours into human rows, collapsing consecutive days with
 * identical hours (e.g. Mon–Sat 09:00–20:00, Sun Closed). Days absent from the
 * record are omitted entirely.
 */
export function formatOpeningHours(hours: OpeningHours[]): HoursRow[] {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const rows: HoursRow[] = [];
  let run: { startIdx: number; value: string } | null = null;

  const valueFor = (h: OpeningHours): string =>
    h.closed || !h.opens || !h.closes ? "Closed" : `${h.opens}–${h.closes}`;

  const flush = (endIdx: number) => {
    if (!run) return;
    const startDay = DAY_SHORT[DAY_ORDER[run.startIdx]!]!;
    const endDay = DAY_SHORT[DAY_ORDER[endIdx]!]!;
    rows.push({
      label: run.startIdx === endIdx ? startDay : `${startDay}–${endDay}`,
      value: run.value,
    });
    run = null;
  };

  for (let i = 0; i < DAY_ORDER.length; i++) {
    const h = byDay.get(DAY_ORDER[i]!);
    if (!h) {
      flush(i - 1);
      continue;
    }
    const value = valueFor(h);
    if (run && run.value === value) continue;
    flush(i - 1);
    run = { startIdx: i, value };
  }
  flush(DAY_ORDER.length - 1);
  return rows;
}

export interface ImgOptions {
  class?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
}

/** Render an <img> tag from an Image, including alt and intrinsic dimensions. */
export function img(image: Image, opts: ImgOptions = {}): string {
  const attrs: string[] = [`src="${escapeAttr(image.src)}"`, `alt="${escapeAttr(image.alt)}"`];
  if (image.width) attrs.push(`width="${image.width}"`);
  if (image.height) attrs.push(`height="${image.height}"`);
  if (opts.class) attrs.push(`class="${escapeAttr(opts.class)}"`);
  if (opts.loading) attrs.push(`loading="${opts.loading}"`);
  if (opts.fetchPriority) attrs.push(`fetchpriority="${opts.fetchPriority}"`);
  if (opts.sizes) attrs.push(`sizes="${escapeAttr(opts.sizes)}"`);
  return `<img ${attrs.join(" ")}>`;
}

/** The full helper surface passed to a site at build time. */
export interface Helpers {
  escapeHtml: typeof escapeHtml;
  escapeAttr: typeof escapeAttr;
  nl2br: typeof nl2br;
  money: typeof money;
  formatOpeningHours: typeof formatOpeningHours;
  img: typeof img;
}

export const helpers: Helpers = {
  escapeHtml,
  escapeAttr,
  nl2br,
  money,
  formatOpeningHours,
  img,
};

export type { Business };
